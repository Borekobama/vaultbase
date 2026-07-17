import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { createMirrorPool, localPool } from './db.js'
import { migrate } from './migrate.js'

const tables = ['settings', 'projects', 'project_secret_refs', 'snapshots', 'activities', 'audit_events'] as const

async function readSnapshot(client: PoolClient) {
  const data: Record<string, unknown[]> = {}
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  try {
    for (const table of tables) {
      const result = await client.query(`SELECT to_jsonb(source) AS row FROM vaultbase.${table} source`)
      data[table] = result.rows.map(item => item.row)
    }
    await client.query('COMMIT')
    return data
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function writeSnapshot(client: PoolClient, data: Record<string, unknown[]>) {
  await client.query('BEGIN')
  try {
    await client.query(`TRUNCATE ${tables.map(table => `vaultbase.${table}`).join(', ')} RESTART IDENTITY CASCADE`)
    for (const table of tables) {
      const rows = data[table]
      if (rows.length) await client.query(`INSERT INTO vaultbase.${table} SELECT * FROM jsonb_populate_recordset(null::vaultbase.${table}, $1::jsonb)`, [JSON.stringify(rows)])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function syncMirror(local: Pool = localPool) {
  const id = randomUUID()
  const startedAt = new Date()
  await local.query(`INSERT INTO vaultbase.mirror_runs(id, status, started_at) VALUES ($1, 'running', $2)`, [id, startedAt])
  const localClient = await local.connect()
  const mirror = createMirrorPool()
  try {
    await migrate(mirror)
    const data = await readSnapshot(localClient)
    const remoteClient = await mirror.connect()
    try { await writeSnapshot(remoteClient, data) } finally { remoteClient.release() }
    const rowCounts = Object.fromEntries(tables.map(table => [table, data[table].length]))
    await local.query(`UPDATE vaultbase.mirror_runs SET status='success', row_counts=$2, completed_at=now() WHERE id=$1`, [id, rowCounts])
    return { id, status: 'success' as const, rowCounts, startedAt, completedAt: new Date() }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown mirror error'
    await local.query(`UPDATE vaultbase.mirror_runs SET status='failed', error_summary=$2, completed_at=now() WHERE id=$1`, [id, message.slice(0, 500)])
    throw error
  } finally {
    localClient.release()
    await mirror.end()
  }
}
