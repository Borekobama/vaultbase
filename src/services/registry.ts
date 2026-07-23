import { seedState } from '../data/seed'
import type { ActivityItem, LatestRecoveryPoint, NewProjectInput, Project, RecoveryCoverage, RegistryState, RestoreDrill, StorageCredentialsInput, UpdateProjectInput } from '../domain'
import { normalizeProjectId } from '../lib/validation'
import { strToU8, zipSync } from 'fflate'

const STORAGE_KEY = 'vaultbase.mock.registry.v2'
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function readState(): RegistryState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return clone(seedState)
    const parsed = JSON.parse(stored) as RegistryState
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.activities)) throw new Error('Invalid registry')
    if (parsed.projects.some(project => !project || typeof project.id !== 'string' || typeof project.secretPath !== 'string')) throw new Error('Invalid project metadata')
    if (parsed.activities.some(activity => !activity || typeof activity.id !== 'string' || typeof activity.projectId !== 'string')) throw new Error('Invalid activity metadata')
    parsed.projects = parsed.projects.map(project => ({
      ...project,
      displayName: project.displayName ?? project.id,
      environment: project.environment ?? 'production',
      notes: project.notes ?? '',
      plan: project.plan ?? 'free',
      backupMode: project.backupMode ?? 'database',
      createdAt: project.createdAt ?? new Date().toISOString(),
      nextBackupAt: project.nextBackupAt ?? null,
      latestBackupAttemptAt: project.latestBackupAttemptAt ?? project.lastBackupAt ?? null,
      snapshotCount: project.snapshotCount ?? (project.lastBackupAt ? 1 : 0),
      successfulBackupCount: project.successfulBackupCount ?? (project.lastBackupAt ? 1 : 0),
      failedBackupCount: project.failedBackupCount ?? 0,
      storageSecretConfigured: project.storageSecretConfigured ?? false,
      managementSecretConfigured: project.managementSecretConfigured ?? false,
      latestRecoveryPoint: project.latestRecoveryPoint ?? null,
      restoreDrills: project.restoreDrills ?? [],
    }))
    return parsed
  } catch {
    return clone(seedState)
  }
}

function writeState(state: RegistryState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const delay = (ms = 180) => new Promise(resolve => window.setTimeout(resolve, ms))
const activityId = () => globalThis.crypto?.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(16).slice(2)}`

const mockRegistryService = {
  async load(): Promise<RegistryState> {
    await delay()
    return readState()
  },

  async addProject(input: NewProjectInput): Promise<RegistryState> {
    await delay(300)
    const state = readState()
    const id = normalizeProjectId(input.name)
    const url = new URL(input.databaseUrl)
    const ref = decodeURIComponent(url.username).match(/^[a-z_][a-z0-9_-]*\.([a-z0-9]+)$/i)?.[1] ?? url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1] ?? 'unknown'
    const region = url.hostname.match(/^aws-\d+-([a-z]+-[a-z]+-\d+)\.pooler\.supabase\.com$/i)?.[1] ?? 'direct'
    if (state.projects.some(project => project.id === id)) throw new Error('A project with this name already exists.')

    // Mock boundary: the connection string is validated by the form and deliberately
    // never persisted. A production API must encrypt it server-side with sops/age or Vault.
    const project: Project = {
      id,
      displayName: input.name.trim(),
      environment: 'production',
      notes: '',
      ref,
      region,
      plan: input.plan,
      enabled: true,
      backupMode: input.backupMode,
      backupSchedule: input.backupSchedule,
      keepAliveSchedule: input.keepAliveSchedule,
      createdAt: new Date().toISOString(),
      nextBackupAt: null,
      lastBackupAt: null,
      latestBackupAttemptAt: null,
      storageBytes: 0,
      snapshotCount: 0,
      successfulBackupCount: 0,
      failedBackupCount: 0,
      status: 'pending',
      secretPath: `supabase/${id}/database`,
      secretConfigured: true,
      storageSecretConfigured: false,
      managementSecretConfigured: false,
      latestRecoveryPoint: null,
      restoreDrills: [],
    }
    state.projects.unshift(project)
    writeState(state)
    return clone(state)
  },

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<RegistryState> {
    await delay(240)
    const state = readState()
    const project = state.projects.find(item => item.id === projectId)
    if (!project) throw new Error('Project not found. Refresh the registry and try again.')
    Object.assign(project, input, { keepAliveSchedule: input.keepAliveSchedule ?? 'Disabled' })
    writeState(state)
    return clone(state)
  },

  async updateDatabaseSecret(projectId: string, _databaseUrl: string): Promise<RegistryState> {
    const state = readState()
    const project = state.projects.find(item => item.id === projectId)
    if (!project) throw new Error('Project not found.')
    project.secretConfigured = true
    writeState(state)
    return clone(state)
  },

  async updateStorageSecret(projectId: string, _input: StorageCredentialsInput): Promise<RegistryState> {
    const state = readState()
    const project = state.projects.find(item => item.id === projectId)
    if (!project) throw new Error('Project not found.')
    project.storageSecretConfigured = true
    writeState(state)
    return clone(state)
  },

  async updateManagementSecret(projectId: string, _accessToken: string): Promise<RegistryState> {
    const state = readState()
    const project = state.projects.find(item => item.id === projectId)
    if (!project) throw new Error('Project not found.')
    project.managementSecretConfigured = true
    writeState(state)
    return clone(state)
  },

  async runBackup(projectId: string): Promise<RegistryState> {
    const state = readState()
    const project = state.projects.find(item => item.id === projectId)
    if (!project) throw new Error('Project not found. Refresh the registry and try again.')
    if (!project.secretConfigured) throw new Error('Configure the database secret before starting a backup.')
    if (!project.enabled) throw new Error('Enable this project before starting a backup.')

    project.status = 'running'
    writeState(state)
    await delay(650)

    const completedAt = new Date().toISOString()
    const bytes = project.storageBytes || 1_000_000
    project.status = 'healthy'
    project.lastBackupAt = completedAt
    project.latestBackupAttemptAt = completedAt
    project.storageBytes = bytes
    project.snapshotCount += 1
    project.successfulBackupCount += 1
    const activity: ActivityItem = {
      id: activityId(), projectId, type: 'backup', status: 'success',
      occurredAt: completedAt, durationMs: 650, bytes, message: 'Backup completed',
    }
    project.latestRecoveryPoint = {
      id: activity.id,
      status: 'uploaded',
      startedAt: completedAt,
      completedAt,
      verifiedAt: null,
      fileCount: project.backupMode === 'full_project' ? 7 : 3,
      tablesVerified: null,
      filesVerified: null,
      warnings: project.backupMode === 'full_project' && !project.storageSecretConfigured ? ['Storage object bodies require Storage S3 credentials.'] : [],
      coverage: {
        database: true,
        roles: true,
        auth: project.backupMode === 'full_project',
        storageMetadata: project.backupMode === 'full_project',
        storageObjects: project.backupMode === 'full_project' && project.storageSecretConfigured,
        configuration: project.backupMode === 'full_project',
        managementApi: project.backupMode === 'full_project' && project.managementSecretConfigured,
      },
    }
    state.activities.unshift(activity)
    writeState(state)
    return clone(state)
  },

  async runKeepAlive(projectId: string): Promise<RegistryState> {
    const state = readState()
    const project = state.projects.find(item => item.id === projectId)
    if (!project) throw new Error('Project not found. Refresh the registry and try again.')
    if (!project.secretConfigured) throw new Error('Configure the database secret before starting a keep-alive check.')
    if (!project.enabled) throw new Error('Enable this project before starting a keep-alive check.')
    await delay(280)
    state.activities.unshift({ id: activityId(), projectId, type: 'keep_alive', status: 'success', occurredAt: new Date().toISOString(), durationMs: 280, bytes: null, message: 'Keep-alive query succeeded' })
    writeState(state)
    return clone(state)
  },

  async verifyRecoveryPoint(projectId: string): Promise<RegistryState> {
    await delay(460)
    const state = readState()
    const project = state.projects.find(item => item.id === projectId)
    if (!project?.latestRecoveryPoint) throw new Error('No recovery point is available to verify.')
    project.latestRecoveryPoint.status = 'restore_verified'
    project.latestRecoveryPoint.verifiedAt = new Date().toISOString()
    project.latestRecoveryPoint.filesVerified = project.latestRecoveryPoint.fileCount
    project.latestRecoveryPoint.tablesVerified = 3
    project.restoreDrills.unshift({
      snapshotId: project.latestRecoveryPoint.id,
      verifiedAt: project.latestRecoveryPoint.verifiedAt,
      snapshotStartedAt: project.latestRecoveryPoint.startedAt,
      filesVerified: project.latestRecoveryPoint.filesVerified,
      tablesVerified: project.latestRecoveryPoint.tablesVerified,
    })
    project.restoreDrills = project.restoreDrills.slice(0, 3)
    writeState(state)
    return clone(state)
  },

  async downloadBackup(activityId: string): Promise<{ blob: Blob; filename: string }> {
    await delay(220)
    const state = readState()
    const activity = state.activities.find(item => item.id === activityId && item.type === 'backup' && item.status === 'success')
    if (!activity) throw new Error('That backup is not available for download.')
    const project = state.projects.find(item => item.id === activity.projectId)
    if (!project) throw new Error('The project for this backup no longer exists.')

    const timestamp = activity.occurredAt.replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
    const notice = '-- Vaultbase local mock dump. This file does not contain production database data.\n'
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify({ mock: true, projectId: project.id, projectRef: project.ref, snapshotId: activity.id, createdAt: activity.occurredAt, files: ['roles.sql', 'schema.sql', 'data.sql'] }, null, 2)),
      'roles.sql': strToU8(`${notice}-- Production downloads contain the exported PostgreSQL roles.\n`),
      'schema.sql': strToU8(`${notice}CREATE TABLE IF NOT EXISTS vaultbase_mock_restore_check (id bigint PRIMARY KEY, restored_at timestamptz NOT NULL);\n`),
      'data.sql': strToU8(`${notice}INSERT INTO vaultbase_mock_restore_check VALUES (1, '${activity.occurredAt}');\n`),
      'README.txt': strToU8('LOCAL MOCK ONLY\n\nA production Vaultbase download is assembled on the authenticated VPS by restoring the selected Restic snapshot, then streamed as a private attachment.\n'),
    }, { level: 6 })
    return { blob: new Blob([archive], { type: 'application/zip' }), filename: `vaultbase-${project.id}-${timestamp}-mock.zip` }
  },

  async reset(): Promise<RegistryState> {
    localStorage.removeItem(STORAGE_KEY)
    await delay(80)
    return clone(seedState)
  },
}

function mapRecoveryPoint(project: Record<string, unknown>): LatestRecoveryPoint | null {
  if (!project.latest_snapshot_id) return null
  const components = (project.latest_snapshot_components ?? {}) as { files?: Array<{ path?: string }>; warnings?: unknown[]; coverage?: Partial<RecoveryCoverage> }
  const paths = new Set((components.files ?? []).map(file => String(file.path ?? '')))
  const explicit = components.coverage ?? {}
  const verification = (project.latest_snapshot_verification_details ?? {}) as { tables?: unknown; files?: unknown }
  const finiteNumber = (value: unknown) => value !== undefined && value !== null && Number.isFinite(Number(value)) ? Number(value) : null
  return {
    id: String(project.latest_snapshot_id),
    status: project.latest_snapshot_status as LatestRecoveryPoint['status'],
    startedAt: String(project.latest_snapshot_started_at),
    completedAt: project.latest_snapshot_completed_at ? String(project.latest_snapshot_completed_at) : null,
    verifiedAt: project.latest_snapshot_verified_at ? String(project.latest_snapshot_verified_at) : null,
    fileCount: components.files?.length ?? 0,
    tablesVerified: finiteNumber(verification.tables),
    filesVerified: finiteNumber(verification.files),
    warnings: (components.warnings ?? []).map(String),
    coverage: {
      database: explicit.database ?? (paths.has('database/schema.sql') && paths.has('database/data.dump')),
      roles: explicit.roles ?? paths.has('database/roles.sql'),
      auth: explicit.auth ?? paths.has('auth/users-and-identities.dump'),
      storageMetadata: explicit.storageMetadata ?? paths.has('storage/metadata.dump'),
      storageObjects: explicit.storageObjects ?? paths.has('storage/objects/manifest.json'),
      configuration: explicit.configuration ?? (paths.has('configuration/managed-schema.sql') && paths.has('configuration/extensions.sql')),
      managementApi: explicit.managementApi ?? paths.has('configuration/management-api.json'),
    },
  }
}

function mapRestoreDrills(project: Record<string, unknown>): RestoreDrill[] {
  const rows = Array.isArray(project.restore_drills) ? project.restore_drills as Array<Record<string, unknown>> : []
  return rows.map(row => {
    const details = (row.verification_details ?? {}) as { tables?: unknown; files?: unknown }
    const finiteNumber = (value: unknown) => value !== undefined && value !== null && Number.isFinite(Number(value)) ? Number(value) : null
    return {
      snapshotId: String(row.id),
      verifiedAt: String(row.verified_at),
      snapshotStartedAt: String(row.snapshot_started_at),
      tablesVerified: finiteNumber(details.tables),
      filesVerified: finiteNumber(details.files),
    }
  })
}

function mapState(payload: { projects: Array<Record<string, unknown>>; activities: Array<Record<string, unknown>> }): RegistryState {
  return {
    projects: payload.projects.map(project => ({
      id: String(project.id), displayName: String(project.display_name ?? project.id), environment: (project.environment ?? 'production') as Project['environment'],
      notes: String(project.notes ?? ''), ref: String(project.ref), region: String(project.region), plan: project.plan as Project['plan'], enabled: Boolean(project.enabled),
      backupMode: project.backup_mode as Project['backupMode'],
      backupSchedule: String(project.backup_schedule), keepAliveSchedule: project.keep_alive_schedule ? String(project.keep_alive_schedule) : 'Disabled',
      createdAt: String(project.created_at), nextBackupAt: project.next_backup_at ? String(project.next_backup_at) : null,
      lastBackupAt: project.last_backup_at ? String(project.last_backup_at) : null, latestBackupAttemptAt: project.latest_backup_attempt_at ? String(project.latest_backup_attempt_at) : null,
      storageBytes: Number(project.storage_bytes), snapshotCount: Number(project.snapshot_count), successfulBackupCount: Number(project.successful_backup_count),
      failedBackupCount: Number(project.failed_backup_count), status: project.status as Project['status'],
      secretPath: String(project.secret_path), secretConfigured: Boolean(project.secret_configured),
      storageSecretConfigured: Boolean(project.storage_secret_configured), managementSecretConfigured: Boolean(project.management_secret_configured), latestRecoveryPoint: mapRecoveryPoint(project),
      restoreDrills: mapRestoreDrills(project),
    })),
    activities: payload.activities.map(activity => ({
      id: String(activity.id), projectId: String(activity.project_id), type: activity.type as ActivityItem['type'], status: activity.status as ActivityItem['status'],
      occurredAt: String(activity.occurred_at), durationMs: activity.duration_ms === null ? null : Number(activity.duration_ms), bytes: activity.bytes === null ? null : Number(activity.bytes), message: String(activity.message),
    })),
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(init?.method && init.method !== 'GET' ? { 'X-Vaultbase-CSRF': '1' } : {}), ...init?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed (${response.status}).`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

const productionRegistryService = {
  async load() { return mapState(await api('/api/state')) },
  async addProject(input: NewProjectInput) {
    const schedules: Record<string, string> = { 'Every 6 hours': '0 */6 * * *', Daily: '0 3 * * *', Weekly: '0 3 * * 0' }
    const keepAlive: Record<string, string> = { 'Every day': '0 9 * * *', 'Every 3 days': '0 9 */3 * *', 'Every 5 days': '0 9 */5 * *' }
    await api('/api/projects', { method: 'POST', body: JSON.stringify({ displayName: input.name, plan: input.plan, databaseUrl: input.databaseUrl, backupSchedule: schedules[input.backupSchedule] ?? input.backupSchedule, keepAliveSchedule: input.plan === 'free' ? keepAlive[input.keepAliveSchedule] ?? input.keepAliveSchedule : null, backupMode: input.backupMode }) })
    return this.load()
  },
  async updateProject(projectId: string, input: UpdateProjectInput) {
    await api(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: JSON.stringify(input) })
    return this.load()
  },
  async updateDatabaseSecret(projectId: string, databaseUrl: string) {
    await api(`/api/projects/${encodeURIComponent(projectId)}/secrets/database`, { method: 'PUT', body: JSON.stringify({ databaseUrl }) })
    return this.load()
  },
  async updateStorageSecret(projectId: string, input: StorageCredentialsInput) {
    await api(`/api/projects/${encodeURIComponent(projectId)}/secrets/storage`, { method: 'PUT', body: JSON.stringify(input) })
    return this.load()
  },
  async updateManagementSecret(projectId: string, accessToken: string) {
    await api(`/api/projects/${encodeURIComponent(projectId)}/secrets/management`, { method: 'PUT', body: JSON.stringify({ accessToken }) })
    return this.load()
  },
  async runBackup(projectId: string) {
    const queued = await api<{ id: string }>(`/api/projects/${encodeURIComponent(projectId)}/backups`, { method: 'POST' })
    for (;;) {
      await new Promise(resolve => window.setTimeout(resolve, 1_000))
      const job = await api<{ status: 'queued' | 'running' | 'success' | 'failed'; error_summary?: string }>(`/api/jobs/${encodeURIComponent(queued.id)}`)
      if (job.status === 'success') return this.load()
      if (job.status === 'failed') throw new Error(job.error_summary ?? 'Backup job failed.')
    }
  },
  async runKeepAlive(projectId: string) { await api(`/api/projects/${encodeURIComponent(projectId)}/keep-alive`, { method: 'POST' }); return this.load() },
  async verifyRecoveryPoint(projectId: string) {
    const state = await this.load()
    const snapshotId = state.projects.find(project => project.id === projectId)?.latestRecoveryPoint?.id
    if (!snapshotId) throw new Error('No recovery point is available to verify.')
    await api(`/api/snapshots/${encodeURIComponent(snapshotId)}/verify`, { method: 'POST' })
    return this.load()
  },
  async downloadBackup(activityId: string) {
    const response = await fetch(`/api/activities/${encodeURIComponent(activityId)}/download`, { credentials: 'same-origin' })
    if (!response.ok) throw new Error('That backup could not be downloaded.')
    const disposition = response.headers.get('content-disposition') ?? ''
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `vaultbase-backup-${activityId}.zip`
    return { blob: await response.blob(), filename }
  },
  async reset() { throw new Error('Production data cannot be reset from the dashboard.') },
}

export const registryService = import.meta.env.MODE === 'test' ? mockRegistryService : productionRegistryService
