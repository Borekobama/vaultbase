import { describe, expect, it } from 'vitest'
import { recommendBackupFrequency } from './planner'

describe('backup frequency planner', () => {
  it('requires an actual first dump measurement', () => {
    expect(recommendBackupFrequency('free', 0)).toMatchObject({ measured: false, label: 'Measure first dump' })
  })

  it('recommends faster schedules when the quota supports them', () => {
    expect(recommendBackupFrequency('pro', 96_000_000).label).toBe('Hourly')
    expect(recommendBackupFrequency('pro', 284_000_000).label).toBe('Every 3 hours')
  })

  it('protects free-plan egress with a conservative budget', () => {
    expect(recommendBackupFrequency('free', 41_000_000).label).toBe('Every 12 hours')
    expect(recommendBackupFrequency('free', 284_000_000).label).toBe('Weekly')
  })
})
