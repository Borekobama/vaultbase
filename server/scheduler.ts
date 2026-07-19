import { Cron } from 'croner'
import type { Cron as CronType } from 'croner'
import { createRecoveryPack } from './recovery-pack.js'
import { runKeepAlive } from './keep-alive.js'
import { syncMirror } from './mirror.js'
import { applyRetention } from './retention.js'
import { localPool } from './db.js'
import { randomUUID } from 'node:crypto'
import { cleanupStaleWorkDirectories } from './work-directory.js'

const jobs = new Map<string, CronType>()
const timezone = process.env.TZ || 'UTC'

async function locked(name: string, operation: () => Promise<unknown>) {
  const client = await localPool.connect()
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) locked', [name])
    if (!lock.rows[0].locked) return
    try { await operation() } finally { await client.query('SELECT pg_advisory_unlock(hashtext($1))', [name]) }
  } finally { client.release() }
}

function schedule(key: string, expression: string, operation: () => Promise<unknown>, acquireLock = true) {
  const existing = jobs.get(key)
  if (existing?.getPattern() === expression) return
  existing?.stop()
  jobs.set(key, new Cron(expression, { timezone, protect: true }, async () => {
    try { await (acquireLock ? locked(key, operation) : operation()) }
    catch (error) { console.error(`[scheduler:${key}]`, error instanceof Error ? error.message : error) }
  }))
}

async function refresh() {
  const stuck = await localPool.query(`UPDATE vaultbase.snapshots SET status='failed', completed_at=now(), error_code='job_timeout', error_summary='Backup was still running after 24 hours.' WHERE status='running' AND started_at < now() - interval '24 hours' RETURNING id, project_id`)
  for (const snapshot of stuck.rows) {
    await localPool.query(`UPDATE vaultbase.projects SET status='failed', updated_at=now() WHERE id=$1`, [snapshot.project_id])
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, snapshot_id, event_type, status, message, occurred_at) VALUES ($1,$2,$3,'backup','failed','Stale running backup was reconciled',now())`, [randomUUID(), snapshot.project_id, snapshot.id])
  }
  const projects = await localPool.query('SELECT id, plan, backup_schedule, keep_alive_schedule FROM vaultbase.projects WHERE enabled=true')
  const expected = new Set(['system:mirror', 'system:retention'])
  schedule('system:mirror', '15 3 * * *', () => syncMirror())
  schedule('system:retention', '0 5 * * 0', () => applyRetention(undefined, true))
  for (const project of projects.rows) {
    const backupKey = `backup:${project.id}`
    expected.add(backupKey)
    schedule(backupKey, project.backup_schedule, () => createRecoveryPack(project.id), false)
    if (project.plan === 'free' && project.keep_alive_schedule) {
      const keepAliveKey = `keep-alive:${project.id}`
      expected.add(keepAliveKey)
      schedule(keepAliveKey, project.keep_alive_schedule, () => runKeepAlive(project.id), false)
    }
  }
  for (const [key, job] of jobs) if (!expected.has(key)) { job.stop(); jobs.delete(key) }
}

await cleanupStaleWorkDirectories()
await refresh()
const refreshTimer = setInterval(() => void refresh().catch(error => console.error('[scheduler:refresh]', error)), 60_000)
const shutdown = async () => { clearInterval(refreshTimer); for (const job of jobs.values()) job.stop(); await localPool.end(); process.exit(0) }
process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
console.log(`Vaultbase scheduler active (${timezone}).`)
