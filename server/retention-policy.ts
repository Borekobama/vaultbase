export const RETENTION_WINDOW = '7d'

export function retentionArguments(projectId?: string, prune = false) {
  const args = [
    'forget',
    '--keep-within', RETENTION_WINDOW,
    '--keep-last', '1',
    '--keep-tag', 'protected',
    '--group-by', 'tags',
  ]
  if (projectId) args.push('--tag', `project:${projectId}`)
  if (prune) args.push('--prune')
  return args
}

export function snapshotIdIsPresent(snapshotId: string, repositoryIds: ReadonlySet<string>) {
  if (repositoryIds.has(snapshotId)) return true
  if (snapshotId.length < 8) return false
  for (const repositoryId of repositoryIds) {
    if (repositoryId.length >= 8 && (repositoryId.startsWith(snapshotId) || snapshotId.startsWith(repositoryId))) return true
  }
  return false
}

export interface CataloguedSnapshot {
  id: string
  project_id: string
  restic_snapshot_id: string
  status: 'uploaded' | 'verified' | 'restore_verified' | 'expired'
}

export function snapshotsMissingFromRepository(catalogued: CataloguedSnapshot[], repositoryIds: ReadonlySet<string>) {
  const missing = catalogued.filter(snapshot => !snapshotIdIsPresent(snapshot.restic_snapshot_id, repositoryIds))
  const activeByProject = new Map<string, number>()
  const missingByProject = new Map<string, number>()

  for (const snapshot of catalogued) activeByProject.set(snapshot.project_id, (activeByProject.get(snapshot.project_id) ?? 0) + 1)
  for (const snapshot of missing) missingByProject.set(snapshot.project_id, (missingByProject.get(snapshot.project_id) ?? 0) + 1)

  for (const [projectId, activeCount] of activeByProject) {
    if (missingByProject.get(projectId) === activeCount) {
      throw new Error(`Retention safety check refused to expire every active snapshot for project "${projectId}".`)
    }
  }
  return missing
}

export function planCatalogReconciliation(catalogued: CataloguedSnapshot[], repositoryIds: ReadonlySet<string>) {
  const active = catalogued.filter(snapshot => snapshot.status !== 'expired')
  const reactivated = catalogued.filter(snapshot => snapshot.status === 'expired' && snapshotIdIsPresent(snapshot.restic_snapshot_id, repositoryIds))
  const expired = snapshotsMissingFromRepository([...active, ...reactivated], repositoryIds)
    .filter(snapshot => snapshot.status !== 'expired')
  return { expired, reactivated }
}
