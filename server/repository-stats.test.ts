import { describe, expect, it } from 'vitest'
import { parseResticRawDataStats } from './repository-stats'

describe('repository stats', () => {
  it('reads the deduplicated raw-data size returned by Restic', () => {
    expect(parseResticRawDataStats('{"total_size":475000000,"total_file_count":15,"snapshots_count":5}\n')).toBe(475_000_000)
  })

  it('rejects missing or invalid sizes', () => {
    expect(() => parseResticRawDataStats('{}')).toThrow(/invalid repository size/i)
    expect(() => parseResticRawDataStats('{"total_size":null}')).toThrow(/invalid repository size/i)
    expect(() => parseResticRawDataStats('{"total_size":-1}')).toThrow(/invalid repository size/i)
  })
})
