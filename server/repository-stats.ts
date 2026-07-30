import { readFile } from 'node:fs/promises'
import { config } from './config.js'
import { runProcess } from './process.js'

const CACHE_TTL_MS = 60_000
const STATS_TIMEOUT_MS = 15_000

export interface RepositoryStorageStats {
  bytes: number | null
  measuredAt: string | null
}

let cached: { expiresAt: number; value: RepositoryStorageStats } | null = null
let pending: Promise<RepositoryStorageStats> | null = null

export function parseResticRawDataStats(output: string): number {
  const parsed = JSON.parse(output) as { total_size?: unknown }
  if (typeof parsed.total_size !== 'number' || !Number.isSafeInteger(parsed.total_size) || parsed.total_size < 0) {
    throw new Error('Restic returned an invalid repository size.')
  }
  return parsed.total_size
}

async function resticEnvironment() {
  const values: NodeJS.ProcessEnv = {}
  for (const line of (await readFile(config.R2_ENV_FILE, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return { ...process.env, ...values, RESTIC_PASSWORD_FILE: config.RESTIC_PASSWORD_FILE }
}

async function measureRepositoryStorage(): Promise<RepositoryStorageStats> {
  try {
    const result = await runProcess('restic', ['stats', '--mode', 'raw-data', '--json'], {
      env: await resticEnvironment(),
      timeoutMs: STATS_TIMEOUT_MS,
    })
    return { bytes: parseResticRawDataStats(result.stdout), measuredAt: new Date().toISOString() }
  } catch (error) {
    console.error('[repository:stats]', error)
    return { bytes: null, measuredAt: null }
  }
}

export async function getRepositoryStorageStats(): Promise<RepositoryStorageStats> {
  if (cached && cached.expiresAt > Date.now()) return cached.value
  if (pending) return pending
  pending = measureRepositoryStorage().then(value => {
    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS }
    return value
  }).finally(() => { pending = null })
  return pending
}
