import { readFile } from 'node:fs/promises'
import { config } from './config.js'
import { runProcess } from './process.js'
import { localPool } from './db.js'
import { randomUUID } from 'node:crypto'
import { retentionArguments, snapshotIdIsPresent, snapshotsMissingFromRepository, type CataloguedSnapshot } from './retention-policy.js'

async function resticEnvironment() {
  const values: NodeJS.ProcessEnv = {}
  for (const line of (await readFile(config.R2_ENV_FILE, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return { ...process.env, ...values, RESTIC_PASSWORD_FILE: config.RESTIC_PASSWORD_FILE }
}

export async function applyRetention(projectId?: string, prune = false) {
  if (projectId && !/^[a-z0-9-]{1,63}$/.test(projectId)) throw new Error('Invalid project identifier.')
  const env = await resticEnvironment()
  const result = await runProcess('restic', retentionArguments(projectId, prune), { env })
  const snapshotArgs = ['snapshots', '--json']
  if (projectId) snapshotArgs.push('--tag', `project:${projectId}`)
  const listed = await runProcess('restic', snapshotArgs, { env, stdoutLimit: 20_000_000 })
  const repositorySnapshots = JSON.parse(listed.stdout) as Array<{ id: string }>
  const present = new Set(repositorySnapshots.map(snapshot => snapshot.id))
  const catalogued = await localPool.query<CataloguedSnapshot>(`SELECT id, project_id, restic_snapshot_id, status FROM vaultbase.snapshots WHERE restic_snapshot_id IS NOT NULL AND status IN ('uploaded','verified','restore_verified','expired')${projectId ? ' AND project_id=$1' : ''}`, projectId ? [projectId] : [])
  const active = catalogued.rows.filter(snapshot => snapshot.status !== 'expired')
  const expired = snapshotsMissingFromRepository(active, present)
  for (const snapshot of expired) {
    await localPool.query(`UPDATE vaultbase.snapshots SET status='expired', expires_at=now() WHERE id=$1`, [snapshot.id])
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, snapshot_id, event_type, status, message, occurred_at) VALUES ($1,$2,$3,'retention','warning','Snapshot expired by retention policy',now())`, [randomUUID(), snapshot.project_id, snapshot.id])
  }
  const reactivated = catalogued.rows.filter(snapshot => snapshot.status === 'expired' && snapshotIdIsPresent(snapshot.restic_snapshot_id, present))
  for (const snapshot of reactivated) {
    await localPool.query(`UPDATE vaultbase.snapshots SET status='uploaded', expires_at=NULL WHERE id=$1`, [snapshot.id])
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, snapshot_id, event_type, status, message, occurred_at) VALUES ($1,$2,$3,'retention','success','Snapshot restored to active catalog after repository reconciliation',now())`, [randomUUID(), snapshot.project_id, snapshot.id])
  }
  const cataloguedIds = new Set(catalogued.rows.map(snapshot => snapshot.restic_snapshot_id))
  return { ...result, expiredSnapshots: expired.length, reactivatedSnapshots: reactivated.length, untrackedRepositorySnapshots: repositorySnapshots.filter(snapshot => !snapshotIdIsPresent(snapshot.id, cataloguedIds)).length }
}
