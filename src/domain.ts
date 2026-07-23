export type View = 'Overview' | 'Projects' | 'Planner' | 'Secrets' | 'Activity' | 'Settings'
export type SupabasePlan = 'free' | 'pro' | 'team' | 'enterprise'
export type BackupMode = 'database' | 'full_project'
export type ProjectStatus = 'healthy' | 'warning' | 'pending' | 'running' | 'failed'
export type JobType = 'backup' | 'keep_alive' | 'retention'
export type ActivityStatus = 'success' | 'running' | 'warning' | 'failed'

export interface Project {
  id: string
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
