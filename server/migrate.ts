import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Pool } from 'pg'
import { createMirrorPool, localPool } from './db.js'

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

export async function migrate(pool: Pool): Promise<void> {
  const files = (await readdir(migrationDirectory)).filter(file => file.endsWith('.sql')).sort()
  await pool.query('CREATE SCHEMA IF NOT EXISTS vaultbase')
  await pool.query('CREATE TABLE IF NOT EXISTS vaultbase.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  for (const file of files) {
    const existing = await pool.query('SELECT 1 FROM vaultbase.schema_migrations WHERE version = $1', [file])
    if (existing.rowCount) continue
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(await readFile(join(migrationDirectory, file), 'utf8'))
      await client.query('INSERT INTO vaultbase.schema_migrations(version) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

async function main() {
  await migrate(localPool)
  if (process.argv.includes('--mirror')) {
    const mirror = createMirrorPool()
    try { await migrate(mirror) } finally { await mirror.end() }
  }
  await localPool.end()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
