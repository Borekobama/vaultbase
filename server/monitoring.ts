import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { config } from './config.js'
import { localPool } from './db.js'

type HealthcheckSignal = 'start' | 'success' | 'fail'

export interface MonitoredJobOptions {
  scope: string
  label: string
  useHealthcheck?: boolean
}

export function sanitizeMonitoringError(error: unknown) {
  const raw = error instanceof Error ? error.message : 'Unknown error'
  return raw
    .replace(/\b(?:postgres(?:ql)?|https?):\/\/\S+/gi, '[redacted-url]')
    .replace(/\b(?:token|password|secret|authorization)\s*[=:]\s*\S+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300) || 'Unknown error'
}

function errorFingerprint(message: string) {
  return createHash('sha256').update(message).digest('hex')
}

async function readSecret(path: string | undefined) {
  if (!path) return null
  try {
    const value = (await readFile(path, 'utf8')).trim()
    return value || null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function telegramRequest(text: string) {
  if (!config.TELEGRAM_BOT_TOKEN_FILE || !config.TELEGRAM_CHAT_ID) return
  const token = await readSecret(config.TELEGRAM_BOT_TOKEN_FILE)
  if (!token) return
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`Telegram returned ${response.status}.`)
}

async function deliverTelegram(text: string) {
  try {
    await telegramRequest(text)
  } catch (error) {
    console.error('[monitoring:telegram]', sanitizeMonitoringError(error))
  }
}

async function healthchecksPingUrl(scope: string) {
  const raw = await readSecret(config.HEALTHCHECKS_PING_URLS_FILE)
  if (!raw) return null
  let value: string | undefined
  if (raw.startsWith('{')) {
    const mapping = JSON.parse(raw) as Record<string, string>
    value = mapping[scope] ?? (scope.startsWith('backup:') ? mapping['backup:*'] : undefined)
  } else if (scope.startsWith('backup:')) {
    value = raw
  }
  if (!value) return null
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'hc-ping.com') throw new Error('Healthchecks ping URL must use https://hc-ping.com.')
  return url
}

async function pingHealthchecks(scope: string, signal: HealthcheckSignal, runId: string) {
  try {
    const url = await healthchecksPingUrl(scope)
    if (!url) return
    const signaled = healthchecksSignalUrl(url, signal, runId)
    const response = await fetch(signaled, { method: 'POST', signal: AbortSignal.timeout(5_000) })
    if (!response.ok) throw new Error(`Healthchecks returned ${response.status}.`)
  } catch (error) {
    console.error('[monitoring:healthchecks]', sanitizeMonitoringError(error))
  }
}

export function healthchecksSignalUrl(base: URL, signal: HealthcheckSignal, runId: string) {
  const url = new URL(base)
  if (signal !== 'success') url.pathname = `${url.pathname.replace(/\/$/, '')}/${signal}`
  url.searchParams.set('rid', runId)
  return url
}

async function firstFailure(scope: string, label: string, message: string) {
  try {
    const result = await localPool.query(
      `WITH previous AS (
         SELECT status FROM vaultbase.monitoring_state WHERE scope=$1
       ), updated AS (
         INSERT INTO vaultbase.monitoring_state(scope, label, status, failure_started_at, last_failure_at, last_error_fingerprint)
         VALUES ($1,$2,'failed',now(),now(),$3)
         ON CONFLICT (scope) DO UPDATE SET
           label=excluded.label,
           status='failed',
           failure_started_at=CASE WHEN vaultbase.monitoring_state.status='failed' THEN vaultbase.monitoring_state.failure_started_at ELSE now() END,
           last_failure_at=now(),
           last_error_fingerprint=excluded.last_error_fingerprint,
           updated_at=now()
         RETURNING 1
       )
       SELECT coalesce((SELECT status <> 'failed' FROM previous), true) AS notify FROM updated`,
      [scope, label, errorFingerprint(message)],
    )
    return Boolean(result.rows[0]?.notify)
  } catch {
    // If the catalog itself is unavailable, sending an undeduplicated alert is safer.
    return true
  }
}

async function markHealthy(scope: string, label: string) {
  try {
    const result = await localPool.query(
      `WITH previous AS (
         SELECT status, failure_started_at FROM vaultbase.monitoring_state WHERE scope=$1
       ), updated AS (
         INSERT INTO vaultbase.monitoring_state(scope, label, status, recovered_at)
         VALUES ($1,$2,'healthy',now())
         ON CONFLICT (scope) DO UPDATE SET
           label=excluded.label,
           status='healthy',
           recovered_at=CASE WHEN vaultbase.monitoring_state.status='failed' THEN now() ELSE vaultbase.monitoring_state.recovered_at END,
           updated_at=now()
         RETURNING 1
       )
       SELECT coalesce((SELECT status='failed' FROM previous), false) AS notify,
              (SELECT failure_started_at FROM previous) AS failure_started_at
       FROM updated`,
      [scope, label],
    )
    return { notify: Boolean(result.rows[0]?.notify), failureStartedAt: result.rows[0]?.failure_started_at as Date | null }
  } catch {
    return { notify: false, failureStartedAt: null }
  }
}

export async function notifyFailure(scope: string, label: string, error: unknown) {
  const message = sanitizeMonitoringError(error)
  if (!await firstFailure(scope, label, message)) return
  await deliverTelegram([
    '🔴 VaultBase job failed',
    '',
    `Job: ${label}`,
    `Time: ${new Date().toISOString()}`,
    `Error: ${message}`,
    '',
    'VaultBase will keep the failure recorded and retry on the next scheduled run.',
  ].join('\n'))
}

export async function notifyRecovery(scope: string, label: string) {
  const state = await markHealthy(scope, label)
  if (!state.notify) return
  await deliverTelegram([
    '🟢 VaultBase job recovered',
    '',
    `Job: ${label}`,
    `Recovered: ${new Date().toISOString()}`,
    ...(state.failureStartedAt ? [`Failure began: ${new Date(state.failureStartedAt).toISOString()}`] : []),
  ].join('\n'))
}

export async function runMonitoredJob<T>(options: MonitoredJobOptions, operation: () => Promise<T>) {
  const runId = randomUUID()
  if (options.useHealthcheck) await pingHealthchecks(options.scope, 'start', runId)
  try {
    const result = await operation()
    if (options.useHealthcheck) await pingHealthchecks(options.scope, 'success', runId)
    await notifyRecovery(options.scope, options.label)
    return result
  } catch (error) {
    if (options.useHealthcheck) await pingHealthchecks(options.scope, 'fail', runId)
    await notifyFailure(options.scope, options.label, error)
    throw error
  }
}

export async function sendMonitoringTest() {
  await telegramRequest([
    '🟢 VaultBase monitoring connected',
    '',
    'Direct Telegram alerts are configured.',
    `Time: ${new Date().toISOString()}`,
  ].join('\n'))
}
