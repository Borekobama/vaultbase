import { randomUUID } from 'node:crypto'
import { localPool } from './db.js'
import { withJobLock } from './job-lock.js'
import { resolveDatabaseConnection } from './database-credentials.js'

async function runKeepAliveUnlocked(projectId: string) {
  const project = await localPool.query('SELECT plan, enabled, secret_ref FROM vaultbase.projects WHERE id=$1', [projectId])
  if (!project.rowCount) throw new Error('Project not found.')
  if (!project.rows[0].enabled) throw new Error('Project is disabled.')
  if (project.rows[0].plan !== 'free') throw new Error('Keep-alive is only available for Free projects.')
  const started = Date.now()
  try {
    const { route } = await resolveDatabaseConnection(project.rows[0].secret_ref, `supabase/${projectId}/database-direct`)
    const duration = Date.now() - started
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, event_type, status, message, duration_ms, details, occurred_at) VALUES ($1,$2,'keep_alive','success','Keep-alive query succeeded',$3,$4,now())`, [randomUUID(), projectId, duration, { databaseRoute: route }])
    return { duration }
  } catch (error) {
    const duration = Date.now() - started
    const message = error instanceof Error ? error.message : 'Unknown keep-alive error'
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, event_type, status, message, details, duration_ms, occurred_at) VALUES ($1,$2,'keep_alive','failed','Keep-alive query failed',$3,$4,now())`, [randomUUID(), projectId, { error: message.slice(0, 500) }, duration]).catch(activityError => console.error('[keep-alive:activity]', activityError))
    throw error
  }
}

export function runKeepAlive(projectId: string) {
  return withJobLock(`keep-alive:${projectId}`, () => runKeepAliveUnlocked(projectId))
}
