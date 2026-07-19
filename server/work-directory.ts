import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.js'

const PREFIX = 'vaultbase-'

export async function createWorkDirectory(label: string) {
  await mkdir(config.WORK_DIRECTORY, { recursive: true, mode: 0o700 })
  return mkdtemp(join(config.WORK_DIRECTORY, `${PREFIX}${label}-`))
}

export async function cleanupStaleWorkDirectories(maxAgeMs = 24 * 60 * 60 * 1000) {
  await mkdir(config.WORK_DIRECTORY, { recursive: true, mode: 0o700 })
  const cutoff = Date.now() - maxAgeMs
  for (const entry of await readdir(config.WORK_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(PREFIX)) continue
    const path = join(config.WORK_DIRECTORY, entry.name)
    if ((await stat(path)).mtimeMs < cutoff) await rm(path, { recursive: true, force: true })
  }
}
