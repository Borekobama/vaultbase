import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { localPool } from './db.js'
import { secretStore } from './secret-store.js'

export async function runKeepAlive(projectId: string) {
  const project = await localPool.query('SELECT plan, enabled, secret_ref FROM vaultbase.projects WHERE id=$1', [projectId])
  if (!project.rowCount) throw new Error('Project not found.')
  if (!project.rows[0].enabled) throw new Error('Project is disabled.')
  if (project.rows[0].plan !== 'free') throw new Error('Keep-alive is only available for Free projects.')
  const connectionString = await secretStore.get(project.rows[0].secret_ref)
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15_000, application_name: 'vaultbase-keep-alive' })
  const started = Date.now()
  try { await client.connect(); await client.query('SELECT 1') } finally { await client.end().catch(() => undefined) }
  const duration = Date.now() - started
  await localPool.query(`INSERT INTO vaultbase.activities(id, project_id, event_type, status, message, duration_ms, occurred_at) VALUES ($1,$2,'keep_alive','success','Keep-alive query succeeded',$3,now())`, [randomUUID(), projectId, duration])
  return { duration }
}
