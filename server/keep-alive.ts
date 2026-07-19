import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { localPool } from './db.js'
import { secretStore } from './secret-store.js'
import { withJobLock } from './job-lock.js'
import { verifiedDatabaseSsl, withoutSslQueryParameters } from './database-ssl.js'

async function runKeepAliveUnlocked(projectId: string) {
  const project = await localPool.query('SELECT plan, enabled, secret_ref FROM vaultbase.projects WHERE id=$1', [projectId])
  if (!project.rowCount) throw new Error('Project not found.')
  if (!project.rows[0].enabled) throw new Error('Project is disabled.')
  if (project.rows[0].plan !== 'free') throw new Error('Keep-alive is only available for Free projects.')
  const connectionString = await secretStore.get(project.rows[0].secret_ref)
  const client = new pg.Client({ connectionString: withoutSslQueryParameters(connectionString), ssl: verifiedDatabaseSsl(), connectionTimeoutMillis: 15_000, application_name: 'vaultbase-keep-alive' })
  const started = Date.now()
  try {
    await client.connect()
    await client.query('SELECT 1')
    const duration = Date.now() - started
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, event_type, status, message, duration_ms, occurred_at) VALUES ($1,$2,'keep_alive','success','Keep-alive query succeeded',$3,now())`, [randomUUID(), projectId, duration])
    return { duration }
  } catch (error) {
    const duration = Date.now() - started
    const message = error instanceof Error ? error.message : 'Unknown keep-alive error'
    await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, event_type, status, message, details, duration_ms, occurred_at) VALUES ($1,$2,'keep_alive','failed','Keep-alive query failed',$3,$4,now())`, [randomUUID(), projectId, { error: message.slice(0, 500) }, duration]).catch(activityError => console.error('[keep-alive:activity]', activityError))
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

export function runKeepAlive(projectId: string) {
  return withJobLock(`keep-alive:${projectId}`, () => runKeepAliveUnlocked(projectId))
}
