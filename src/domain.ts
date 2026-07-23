export type View = 'Overview' | 'Projects' | 'Planner' | 'Secrets' | 'Activity' | 'Settings'
export type SupabasePlan = 'free' | 'pro' | 'team' | 'enterprise'
export type BackupMode = 'database' | 'full_project'
export type ProjectEnvironment = 'production' | 'staging' | 'development'
export type ProjectStatus = 'healthy' | 'warning' | 'pending' | 'running' | 'failed'
export type JobType = 'backup' | 'keep_alive' | 'retention'
export type ActivityStatus = 'success' | 'running' | 'warning' | 'failed'

export interface RecoveryCoverage {
  database: boolean
  roles: boolean
  auth: boolean
  storageMetadata: boolean
  storageObjects: boolean
  configuration: boolean
  managementApi: boolean
}

export interface LatestRecoveryPoint {
  id: string
  status: 'uploaded' | 'verified' | 'restore_verified'
  startedAt: string
  completedAt: string | null
  verifiedAt: string | null
  fileCount: number
  tablesVerified: number | null
  filesVerified: number | null
  warnings: string[]
  coverage: RecoveryCoverage
}

export interface RestoreDrill {
  snapshotId: string
  verifiedAt: string
  snapshotStartedAt: string
  tablesVerified: number | null
  filesVerified: number | null
}

export interface Project {
  id: string
  displayName: string
  environment: ProjectEnvironment
  notes: string
  ref: string
  region: string
  plan: SupabasePlan
  enabled: boolean
  backupMode: BackupMode
  backupSchedule: string
  keepAliveSchedule: string
  createdAt: string
  nextBackupAt: string | null
  lastBackupAt: string | null
  latestBackupAttemptAt: string | null
  storageBytes: number
  snapshotCount: number
  successfulBackupCount: number
  failedBackupCount: number
  status: ProjectStatus
  secretPath: string
  secretConfigured: boolean
  storageSecretConfigured: boolean
  managementSecretConfigured: boolean
  latestRecoveryPoint: LatestRecoveryPoint | null
  restoreDrills: RestoreDrill[]
}

export interface ActivityItem {
  id: string
  projectId: string
  type: JobType
  status: ActivityStatus
  occurredAt: string
  durationMs: number | null
  bytes: number | null
  message: string
}

export interface RegistryState {
  projects: Project[]
  activities: ActivityItem[]
}

export interface NewProjectInput {
  name: string
  plan: SupabasePlan
  backupMode: BackupMode
  databaseUrl: string
  backupSchedule: string
  keepAliveSchedule: string
}

export interface UpdateProjectInput {
  displayName: string
  environment: ProjectEnvironment
  notes: string
  plan: SupabasePlan
  backupMode: BackupMode
  backupSchedule: string
  keepAliveSchedule: string | null
}

export interface StorageCredentialsInput {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}
