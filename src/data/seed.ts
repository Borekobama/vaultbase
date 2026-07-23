import type { RegistryState } from '../domain'

const now = Date.now()
const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString()

export const seedState: RegistryState = {
  projects: [
    { id: 'customer-portal', displayName: 'Customer Portal', environment: 'production', notes: 'Primary customer accounts and billing workspace.', ref: 'abcdefghijkl', region: 'eu-central-1', plan: 'pro', enabled: true, backupMode: 'full_project', backupSchedule: 'Daily', keepAliveSchedule: 'Disabled', createdAt: hoursAgo(720), nextBackupAt: hoursAgo(-22), lastBackupAt: hoursAgo(2), latestBackupAttemptAt: hoursAgo(2), storageBytes: 284_000_000, snapshotCount: 18, successfulBackupCount: 18, failedBackupCount: 0, status: 'healthy', secretPath: 'supabase/customer-portal/database', secretConfigured: true },
    { id: 'internal-tools', displayName: 'Internal Tools', environment: 'staging', notes: 'Operations dashboard and internal automations.', ref: 'mnopqrstuv', region: 'eu-west-1', plan: 'pro', enabled: true, backupMode: 'database', backupSchedule: 'Every 6 hours', keepAliveSchedule: 'Disabled', createdAt: hoursAgo(480), nextBackupAt: hoursAgo(-2), lastBackupAt: hoursAgo(4), latestBackupAttemptAt: hoursAgo(4), storageBytes: 96_000_000, snapshotCount: 42, successfulBackupCount: 41, failedBackupCount: 1, status: 'healthy', secretPath: 'supabase/internal-tools/database', secretConfigured: true },
    { id: 'marketing-site', displayName: 'Marketing Site', environment: 'production', notes: '', ref: 'wxyz123456', region: 'us-east-1', plan: 'free', enabled: true, backupMode: 'database', backupSchedule: 'Weekly', keepAliveSchedule: 'Every 5 days', createdAt: hoursAgo(960), nextBackupAt: hoursAgo(-72), lastBackupAt: hoursAgo(27), latestBackupAttemptAt: hoursAgo(27), storageBytes: 41_000_000, snapshotCount: 7, successfulBackupCount: 7, failedBackupCount: 0, status: 'warning', secretPath: 'supabase/marketing-site/database', secretConfigured: true },
  ],
  activities: [
    { id: 'a1', projectId: 'customer-portal', type: 'backup', status: 'success', occurredAt: hoursAgo(2), durationMs: 28_400, bytes: 284_000_000, message: 'Backup completed' },
    { id: 'a2', projectId: 'internal-tools', type: 'keep_alive', status: 'success', occurredAt: hoursAgo(3), durationMs: 42, bytes: null, message: 'Keep-alive query succeeded' },
    { id: 'a3', projectId: 'internal-tools', type: 'backup', status: 'success', occurredAt: hoursAgo(4), durationMs: 12_800, bytes: 96_000_000, message: 'Backup completed' },
    { id: 'a4', projectId: 'marketing-site', type: 'keep_alive', status: 'success', occurredAt: hoursAgo(26), durationMs: 39, bytes: null, message: 'Keep-alive query succeeded' },
  ],
}
