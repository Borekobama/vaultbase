import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { config } from './config.js'
import { localPool } from './db.js'
import { runProcess } from './process.js'
import { syncStorageObjects } from './storage-sync.js'
import { withJobLock } from './job-lock.js'
import { createWorkDirectory } from './work-directory.js'
import { postgresSslEnvironment } from './database-ssl.js'
import { syncManagementConfiguration } from './management-sync.js'
import { resolveDatabaseConnection } from './database-credentials.js'

const excludedManagedSchemas = ['auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'supabase_functions', 'realtime', '_analytics', '_realtime']

function postgresEnvironment(rawUrl: string) {
  const url = new URL(rawUrl)
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: url.pathname.slice(1) || 'postgres',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    ...postgresSslEnvironment(url.hostname),
  }
}

async function fileDigest(path: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function parseEnvironmentFile(path: string) {
  const values: NodeJS.ProcessEnv = {}
  for (const line of (await readFile(path, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return values
}

async function createRecoveryPackUnlocked(projectId: string) {
  const projectResult = await localPool.query('SELECT id, project_ref, backup_mode, secret_ref FROM vaultbase.projects WHERE id=$1 AND enabled=true', [projectId])
  if (!projectResult.rowCount) throw new Error('Enabled project not found.')
  const project = projectResult.rows[0]
  const snapshotId = randomUUID()
  const startedAt = new Date()
  const directory = await createWorkDirectory(projectId)
  const databaseDirectory = join(directory, 'database')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(databaseDirectory, { mode: 0o700 })
  await localPool.query(`INSERT INTO vaultbase.snapshots(id, project_id, status, components, started_at) VALUES ($1,$2,'running',$3,$4)`, [snapshotId, projectId, { database: 'running' }, startedAt])

  try {
    let storageObjects = { configured: false, objects: 0 }
    let managementConfiguration = { configured: false, captured: 0, warnings: [] as string[] }
    const directReference = `supabase/${projectId}/database-direct`
    const { databaseUrl, route: databaseRoute } = await resolveDatabaseConnection(project.secret_ref, directReference)
    const env = postgresEnvironment(databaseUrl)
    const pgDump = join(config.PG_BIN_DIRECTORY, 'pg_dump')
    const pgDumpAll = join(config.PG_BIN_DIRECTORY, 'pg_dumpall')
    const exclusions = excludedManagedSchemas.flatMap(schema => ['--exclude-schema', schema])

    await runProcess(pgDumpAll, ['--roles-only', '--no-role-passwords'], { env, stdoutFile: join(databaseDirectory, 'roles.sql') })
    await runProcess(pgDump, ['--schema-only', '--no-owner', '--no-privileges', ...exclusions], { env, stdoutFile: join(databaseDirectory, 'schema.sql') })
    await runProcess(pgDump, ['--data-only', '--format=custom', '--no-owner', '--no-privileges', ...exclusions, '--file', join(databaseDirectory, 'data.dump')], { env })

    if (project.backup_mode === 'full_project') {
      const authDirectory = join(directory, 'auth')
      const storageDirectory = join(directory, 'storage')
      const configurationDirectory = join(directory, 'configuration')
      await Promise.all([mkdir(authDirectory), mkdir(storageDirectory), mkdir(configurationDirectory)])
      await runProcess(pgDump, ['--data-only', '--format=custom', '--schema=auth', '--no-owner', '--no-privileges', '--file', join(authDirectory, 'users-and-identities.dump')], { env })
      await runProcess(pgDump, ['--data-only', '--format=custom', '--schema=storage', '--no-owner', '--no-privileges', '--file', join(storageDirectory, 'metadata.dump')], { env })
      await runProcess(pgDump, ['--schema-only', '--schema=auth', '--schema=storage', '--no-owner', '--no-privileges'], { env, stdoutFile: join(configurationDirectory, 'managed-schema.sql') })
      await runProcess(pgDump, ['--schema-only', '--schema=extensions', '--no-owner', '--no-privileges'], { env, stdoutFile: join(configurationDirectory, 'extensions.sql') })
      storageObjects = await syncStorageObjects(projectId, join(storageDirectory, 'objects'))
      managementConfiguration = await syncManagementConfiguration(projectId, project.project_ref, join(configurationDirectory, 'management-api.json'))
    }

    const files: Array<{ path: string; bytes: number; sha256: string }> = []
    async function collect(path: string, prefix = ''): Promise<void> {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        const absolute = join(path, entry.name)
        const relative = join(prefix, entry.name)
        if (entry.isDirectory()) await collect(absolute, relative)
        else files.push({ path: relative, bytes: (await stat(absolute)).size, sha256: await fileDigest(absolute) })
      }
    }
    await collect(directory)
    const paths = new Set(files.map(file => file.path))
    const coverage = {
      database: paths.has('database/schema.sql') && paths.has('database/data.dump'),
      roles: paths.has('database/roles.sql'),
      auth: project.backup_mode === 'full_project' && paths.has('auth/users-and-identities.dump'),
      storageMetadata: project.backup_mode === 'full_project' && paths.has('storage/metadata.dump'),
      storageObjects: project.backup_mode === 'full_project' && storageObjects.configured,
      configuration: project.backup_mode === 'full_project' && paths.has('configuration/managed-schema.sql') && paths.has('configuration/extensions.sql'),
      managementApi: project.backup_mode === 'full_project' && managementConfiguration.captured > 0 && paths.has('configuration/management-api.json'),
    }
    const warnings = [
      ...(!coverage.storageObjects && project.backup_mode === 'full_project' ? ['Storage object bodies require Storage S3 credentials.'] : []),
      ...(!coverage.managementApi && project.backup_mode === 'full_project' ? ['Management API configuration requires a read-scoped access token.'] : []),
      ...managementConfiguration.warnings,
    ]
    const manifest = { version: 2, snapshotId, projectId, projectRef: project.project_ref, mode: project.backup_mode, databaseRoute, createdAt: startedAt.toISOString(), files, coverage, storageObjectCount: storageObjects.objects, complete: project.backup_mode === 'database' || warnings.length === 0, warnings }
    await writeFile(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })

    const r2 = await parseEnvironmentFile(config.R2_ENV_FILE)
    const restic = await runProcess('restic', ['backup', '--json', '--tag', `project:${projectId}`, '--tag', `mode:${project.backup_mode}`, directory], { env: { ...process.env, ...r2, RESTIC_PASSWORD_FILE: config.RESTIC_PASSWORD_FILE } })
    const summary = restic.stdout.split(/\r?\n/).map(line => { try { return JSON.parse(line) } catch { return null } }).find(item => item?.message_type === 'summary')
    const resticSnapshotId = summary?.snapshot_id
    if (!resticSnapshotId) throw new Error('Restic completed without returning a snapshot identifier.')
    const dumpBytes = files.reduce((sum, file) => sum + file.bytes, 0)
    await localPool.query(`UPDATE vaultbase.snapshots SET restic_snapshot_id=$2, status='uploaded', components=$3, dump_bytes=$4, completed_at=now() WHERE id=$1`, [snapshotId, resticSnapshotId, manifest, dumpBytes])
    await localPool.query(`UPDATE vaultbase.projects SET last_backup_at=now(), measured_dump_bytes=$2, status='healthy', updated_at=now() WHERE id=$1`, [projectId, dumpBytes])
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, snapshot_id, event_type, status, message, bytes, occurred_at) VALUES ($1,$2,$3,'backup','success','Recovery pack uploaded',$4,now())`, [randomUUID(), projectId, snapshotId, dumpBytes])
    return { snapshotId, resticSnapshotId, dumpBytes, manifest }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown backup error'
    await localPool.query(`UPDATE vaultbase.snapshots SET status='failed', error_summary=$2, completed_at=now() WHERE id=$1`, [snapshotId, message.slice(0, 500)])
    await localPool.query(`UPDATE vaultbase.projects SET status='failed', updated_at=now() WHERE id=$1`, [projectId])
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, snapshot_id, event_type, status, message, details, occurred_at) VALUES ($1,$2,$3,'backup','failed','Recovery pack failed',$4,now())`, [randomUUID(), projectId, snapshotId, { error: message.slice(0, 500) }]).catch(activityError => console.error('[backup:activity]', activityError))
    throw error
  } finally { await rm(directory, { recursive: true, force: true }) }
}

export function createRecoveryPack(projectId: string) {
  return withJobLock(`backup:${projectId}`, () => createRecoveryPackUnlocked(projectId))
}
