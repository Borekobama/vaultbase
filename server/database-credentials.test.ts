import { describe, expect, it } from 'vitest'
import { databaseRouteCandidates, isDatabaseRouteUnavailable } from './database-credentials'

describe('database route priority', () => {
  it('prefers a configured Direct route and keeps Session as fallback', () => {
    expect(databaseRouteCandidates('session-secret', 'direct-secret', true)).toEqual([
      { route: 'direct', reference: 'direct-secret' },
      { route: 'session', reference: 'session-secret' },
    ])
  })

  it('uses Session when Direct is not configured', () => {
    expect(databaseRouteCandidates('session-secret', 'direct-secret', false)).toEqual([
      { route: 'session', reference: 'session-secret' },
    ])
  })

  it('identifies network-only failures that can safely fall back to Session', () => {
    expect(isDatabaseRouteUnavailable(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }))).toBe(true)
    expect(isDatabaseRouteUnavailable(Object.assign(new Error('network is unreachable'), { code: 'ENETUNREACH' }))).toBe(true)
    expect(isDatabaseRouteUnavailable(Object.assign(new Error('password authentication failed'), { code: '28P01' }))).toBe(false)
    expect(isDatabaseRouteUnavailable(new Error('certificate verify failed'))).toBe(false)
  })
})
