import { randomUUID } from 'node:crypto'
import { localPool } from './db.js'
import { createRecoveryPack } from './recovery-pack.js'
import { JobAlreadyRunningError } from './job-lock.js'

const dispatched = new Set<string>()

async function executeBackupJob(jobId: string) {
  if (dispatched.has(jobId)) return
  dispatched.add(jobId)
  try {
    const claimed = await localPool.query(`UPDATE vaultbase.jobs SET status='running', started_at=now() WHERE id=$1 AND status='queued' RETURNING project_id`, [jobId])
    if (!claimed.rowCount) return
    const projectId = claimed.rows[0].project_id as string
    try {
      const result = await createRecoveryPack(projectId)
      const payload = { snapshotId: result.snapshotId, resticSnapshotId: result.resticSnapshotId, bytes: result.dumpBytes }
      await localPool.query(`UPDATE vaultbase.jobs SET status='success', result=$2, completed_at=now() WHERE id=$1`, [jobId, payload])
      await localPool.query(`INSERT INTO vaultbase.audit_events(actor, action, target_type, target_id, metadata) VALUES ('api-token','backup.manual.completed','project',$1,$2)`, [projectId, { jobId, snapshotId: result.snapshotId }])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown backup error'
      await localPool.query(`UPDATE vaultbase.jobs SET status='failed', error_summary=$2, completed_at=now() WHERE id=$1`, [jobId, message.slice(0, 500)])
      await localPool.query(`INSERT INTO vaultbase.audit_events(actor, action, target_type, target_id, metadata) VALUES ('api-token','backup.manual.failed','project',$1,$2)`, [projectId, { jobId, error: message.slice(0, 500) }]).catch(() => undefined)
    }
  } finally {
    dispatched.delete(jobId)
  }
}

function dispatch(jobId: string) {
  setImmediate(() => void executeBackupJob(jobId).catch(error => console.error(`[manual-job:${jobId}]`, error)))
}

export async function enqueueBackup(projectId: string) {
  const project = await localPool.query('SELECT 1 FROM vaultbase.projects WHERE id=$1 AND enabled=true', [projectId])
  if (!project.rowCount) throw new Error('Enabled project not found.')
  const id = randomUUID()
  try {
    await localPool.query(`INSERT INTO vaultbase.jobs(id, project_id, job_type, status) VALUES ($1,$2,'backup','queued')`, [id, projectId])
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') throw new JobAlreadyRunningError(`backup:${projectId}`)
    throw error
  }
  dispatch(id)
  return { id, projectId, jobType: 'backup' as const, status: 'queued' as const }
}

export async function getJob(id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null
  const result = await localPool.query(`SELECT id, project_id, job_type, status, result, error_summary, created_at, started_at, completed_at FROM vaultbase.jobs WHERE id=$1`, [id])
  return result.rows[0] ?? null
}

export async function resumeManualJobs() {
  await localPool.query(`UPDATE vaultbase.jobs SET status='failed', error_summary='Application restarted while the job was running.', completed_at=now() WHERE status='running'`)
  const queued = await localPool.query(`SELECT id FROM vaultbase.jobs WHERE status='queued' ORDER BY created_at`)
  for (const job of queued.rows) dispatch(job.id)
}
