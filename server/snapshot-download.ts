import { ZipArchive } from 'archiver'
import type { Response } from 'express'
import { readFile, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { config } from './config.js'
import { localPool } from './db.js'
import { runProcess } from './process.js'
import { createWorkDirectory } from './work-directory.js'

async function resticEnvironment() {
  const values: NodeJS.ProcessEnv = {}
  for (const line of (await readFile(config.R2_ENV_FILE, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return { ...process.env, ...values, RESTIC_PASSWORD_FILE: config.RESTIC_PASSWORD_FILE }
}

async function findManifest(root: string): Promise<string> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      try { return await findManifest(path) } catch { /* continue */ }
    } else if (entry.name === 'manifest.json') return path
  }
  throw new Error('Snapshot manifest was not found.')
}

export async function streamSnapshotDownload(snapshotId: string, response: Response) {
  if (!/^[a-f0-9-]{36}$/i.test(snapshotId)) throw new Error('Invalid snapshot identifier.')
  const result = await localPool.query(`SELECT s.restic_snapshot_id, s.started_at, p.id project_id FROM vaultbase.snapshots s JOIN vaultbase.projects p ON p.id=s.project_id WHERE s.id=$1 AND s.status IN ('uploaded','verified','restore_verified')`, [snapshotId])
  if (!result.rowCount || !result.rows[0].restic_snapshot_id) throw new Error('Downloadable snapshot not found.')
  const snapshot = result.rows[0]
  const target = await createWorkDirectory('download')
  let cleaned = false
  const cleanup = async () => { if (!cleaned) { cleaned = true; await rm(target, { recursive: true, force: true }) } }
  try {
    await runProcess('restic', ['restore', snapshot.restic_snapshot_id, '--target', target], { env: await resticEnvironment() })
    const packRoot = dirname(await findManifest(target))
    const timestamp = new Date(snapshot.started_at).toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
    response.status(200)
    response.setHeader('Content-Type', 'application/zip')
    response.setHeader('Content-Disposition', `attachment; filename="vaultbase-${snapshot.project_id}-${timestamp}.zip"`)
    response.setHeader('Cache-Control', 'private, no-store')
    const archive = new ZipArchive({ zlib: { level: 6 } })
    archive.on('error', (error: Error) => response.destroy(error))
    response.on('close', () => { void cleanup() })
    archive.pipe(response)
    archive.directory(packRoot, false)
    await archive.finalize()
  } catch (error) {
    await cleanup()
    throw error
  }
}
