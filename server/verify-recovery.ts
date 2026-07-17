import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config } from './config.js'
import { localPool } from './db.js'
import { runProcess } from './process.js'

async function environmentFile(path: string) {
  const values: NodeJS.ProcessEnv = {}
  for (const line of (await readFile(path, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return values
}

async function findManifest(root: string): Promise<string> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      try { return await findManifest(path) } catch { /* continue */ }
    } else if (entry.name === 'manifest.json') return path
  }
  throw new Error('Recovery pack manifest was not found.')
}

export async function verifyResticSnapshot(resticSnapshotId: string) {
  if (!/^[a-f0-9]{8,64}$/i.test(resticSnapshotId)) throw new Error('Invalid Restic snapshot ID.')
  const target = await mkdtemp(join(tmpdir(), 'vaultbase-verify-'))
  const databaseName = `vaultbase_verify_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
  let createdDatabase = false
  try {
    const r2 = await environmentFile(config.R2_ENV_FILE)
    await runProcess('restic', ['restore', resticSnapshotId, '--target', target], { env: { ...process.env, ...r2, RESTIC_PASSWORD_FILE: config.RESTIC_PASSWORD_FILE } })
    const manifestPath = await findManifest(target)
    const root = join(manifestPath, '..')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { snapshotId: string; projectId: string; files: Array<{ path: string; bytes: number; sha256: string }> }
    for (const file of manifest.files) {
      const content = await readFile(join(root, file.path))
      if (content.byteLength !== file.bytes || createHash('sha256').update(content).digest('hex') !== file.sha256) throw new Error(`Checksum verification failed for ${file.path}.`)
    }
    await runProcess(join(config.PG_BIN_DIRECTORY, 'pg_restore'), ['--list', join(root, 'database', 'data.dump')])

    await localPool.query(`CREATE DATABASE ${databaseName}`)
    createdDatabase = true
    const localUrl = new URL(config.LOCAL_DATABASE_URL.replace('postgresql:///', 'postgresql://localhost/'))
    const env = { ...process.env, PGHOST: localUrl.hostname || 'localhost', PGPORT: localUrl.port || '5432', PGUSER: localUrl.username || process.env.USER, PGDATABASE: databaseName, PGSSLMODE: 'disable' }
    const schemaPath = join(root, 'database', 'schema.sql')
    const compatibleSchemaPath = join(root, 'database', 'schema.verify.sql')
    const compatibleSchema = (await readFile(schemaPath, 'utf8')).replace(/^SET transaction_timeout = 0;\r?\n/gm, '')
    await writeFile(compatibleSchemaPath, compatibleSchema, { mode: 0o600 })
    await runProcess(join(config.PG_BIN_DIRECTORY, 'psql'), ['--set', 'ON_ERROR_STOP=1', '--file', compatibleSchemaPath], { env })
    const dataSqlPath = join(root, 'database', 'data.verify.sql')
    await runProcess(join(config.PG_BIN_DIRECTORY, 'pg_restore'), ['--no-owner', '--no-privileges', '--file', dataSqlPath, join(root, 'database', 'data.dump')], { env })
    const compatibleData = (await readFile(dataSqlPath, 'utf8')).replace(/^SET transaction_timeout = 0;\r?\n/gm, '')
    await writeFile(dataSqlPath, compatibleData, { mode: 0o600 })
    await runProcess(join(config.PG_BIN_DIRECTORY, 'psql'), ['--set', 'ON_ERROR_STOP=1', '--file', dataSqlPath], { env })
    await runProcess(join(config.PG_BIN_DIRECTORY, 'psql'), ['--set', 'ON_ERROR_STOP=1', '--command', 'ANALYZE;'], { env })
    const tableCheck = await runProcess(join(config.PG_BIN_DIRECTORY, 'psql'), ['--tuples-only', '--no-align', '--command', `SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');`], { env })
    const tableCount = Number(tableCheck.stdout.trim())
    if (!Number.isFinite(tableCount) || tableCount === 0) throw new Error('Test restore contained no user tables.')
    await localPool.query(`UPDATE vaultbase.snapshots SET status='restore_verified', verified_at=now() WHERE restic_snapshot_id=$1`, [resticSnapshotId])
    return { verified: true, snapshotId: manifest.snapshotId, projectId: manifest.projectId, files: manifest.files.length, tables: tableCount }
  } finally {
    if (createdDatabase) await localPool.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`).catch(() => undefined)
    await rm(target, { recursive: true, force: true })
  }
}
