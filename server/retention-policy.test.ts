import { describe, expect, it } from 'vitest'
import { planCatalogReconciliation, retentionArguments, snapshotIdIsPresent, snapshotsMissingFromRepository } from './retention-policy'

describe('backup retention policy', () => {
  it('uses a rolling seven-day window and always keeps the latest snapshot', () => {
    expect(retentionArguments()).toEqual([
      'forget',
      '--keep-within', '7d',
      '--keep-last', '1',
      '--keep-tag', 'protected',
      '--group-by', 'tags',
    ])
  })

  it('adds project filtering and pruning only when requested', () => {
    expect(retentionArguments('customer-prod', true)).toEqual([
      'forget',
      '--keep-within', '7d',
      '--keep-last', '1',
      '--keep-tag', 'protected',
      '--group-by', 'tags',
      '--tag', 'project:customer-prod',
      '--prune',
    ])
  })

  it('matches both full and safely abbreviated Restic snapshot identifiers', () => {
    const fullId = '1980afccb5730d9c50316a56f539bd579a3aff84be7234469a47e34c167b39c2'
    expect(snapshotIdIsPresent(fullId, new Set([fullId]))).toBe(true)
    expect(snapshotIdIsPresent('1980afcc', new Set([fullId]))).toBe(true)
    expect(snapshotIdIsPresent(fullId, new Set(['1980afcc']))).toBe(true)
    expect(snapshotIdIsPresent('1980afcb', new Set([fullId]))).toBe(false)
  })

  it('refuses a reconciliation that would expire every active snapshot for a project', () => {
    expect(() => snapshotsMissingFromRepository([
      { id: 'catalog-1', project_id: 'customer-prod', restic_snapshot_id: 'aaaaaaaa', status: 'uploaded' },
      { id: 'catalog-2', project_id: 'customer-prod', restic_snapshot_id: 'bbbbbbbb', status: 'verified' },
    ], new Set(['cccccccc']))).toThrow(/refused to expire every active snapshot/)
  })

  it('returns only genuinely missing snapshots when at least one recovery point remains', () => {
    expect(snapshotsMissingFromRepository([
      { id: 'catalog-1', project_id: 'customer-prod', restic_snapshot_id: 'aaaaaaaa', status: 'uploaded' },
      { id: 'catalog-2', project_id: 'customer-prod', restic_snapshot_id: 'bbbbbbbb', status: 'restore_verified' },
    ], new Set(['bbbbbbbb']))).toEqual([
      { id: 'catalog-1', project_id: 'customer-prod', restic_snapshot_id: 'aaaaaaaa', status: 'uploaded' },
    ])
  })

  it('repairs an inverted catalog without tripping the all-expired safety check', () => {
    const retained = { id: 'catalog-retained', project_id: 'customer-prod', restic_snapshot_id: 'aaaaaaaa', status: 'expired' as const }
    const removed = { id: 'catalog-removed', project_id: 'customer-prod', restic_snapshot_id: 'bbbbbbbb', status: 'uploaded' as const }
    expect(planCatalogReconciliation([retained, removed], new Set(['aaaaaaaa']))).toEqual({
      expired: [removed],
      reactivated: [retained],
    })
  })
})
