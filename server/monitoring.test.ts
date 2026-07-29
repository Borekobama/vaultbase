import { describe, expect, it } from 'vitest'
import { healthchecksSignalUrl, sanitizeMonitoringError } from './monitoring'

describe('monitoring safety', () => {
  it('redacts connection URLs and credential-like values from alerts', () => {
    const message = sanitizeMonitoringError(new Error(
      'failed postgresql://user:pass@example.com/db token=abc123 password:secret',
    ))
    expect(message).not.toContain('user:pass')
    expect(message).not.toContain('abc123')
    expect(message).not.toContain('secret')
    expect(message).toContain('[redacted-url]')
  })

  it('constructs start, success, and failure signals without mutating the base URL', () => {
    const base = new URL('https://hc-ping.com/example/vaultbase')
    const runId = '123e4567-e89b-12d3-a456-426614174000'
    expect(healthchecksSignalUrl(base, 'start', runId).pathname).toBe('/example/vaultbase/start')
    expect(healthchecksSignalUrl(base, 'success', runId).pathname).toBe('/example/vaultbase')
    expect(healthchecksSignalUrl(base, 'fail', runId).pathname).toBe('/example/vaultbase/fail')
    expect(base.search).toBe('')
  })
})
