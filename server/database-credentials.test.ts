import { describe, expect, it } from 'vitest'
import { databaseRouteCandidates } from './database-credentials'

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
})
