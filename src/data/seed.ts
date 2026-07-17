import type { RegistryState } from '../domain'

const now = Date.now()
const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString()

export const seedState: RegistryState = {
  projects: [
    { id: 'customer-portal', ref: 'abcdefghijkl', region: 'eu-central-1', plan: 'pro', enabled: true, backupSchedule: 'Daily', keepAliveSchedule: 'Every 3 days', lastBackupAt: hoursAgo(2), storageBytes: 284_000_000, status: 'healthy', secretPath: 'supabase/customer-portal/database', secretConfigured: true },
    { id: 'internal-tools', ref: 'mnopqrstuv', region: 'eu-west-1', plan: 'pro', enabled: true, backupSchedule: 'Every 6 hours', keepAliveSchedule: 'Every 3 days', lastBackupAt: hoursAgo(4), storageBytes: 96_000_000, status: 'healthy', secretPath: 'supabase/internal-tools/database', secretConfigured: true },
    { id: 'marketing-site', ref: 'wxyz123456', region: 'us-east-1', plan: 'free', enabled: true, backupSchedule: 'Weekly', keepAliveSchedule: 'Every 5 days', lastBackupAt: hoursAgo(27), storageBytes: 41_000_000, status: 'warning', secretPath: 'supabase/marketing-site/database', secretConfigured: true },
  ],
  activities: [
    { id: 'a1', projectId: 'customer-portal', type: 'backup', status: 'success', occurredAt: hoursAgo(2), durationMs: 28_400, bytes: 284_000_000, message: 'Backup completed' },
    { id: 'a2', projectId: 'internal-tools', type: 'keep_alive', status: 'success', occurredAt: hoursAgo(3), durationMs: 42, bytes: null, message: 'Keep-alive query succeeded' },
    { id: 'a3', projectId: 'internal-tools', type: 'backup', status: 'success', occurredAt: hoursAgo(4), durationMs: 12_800, bytes: 96_000_000, message: 'Backup completed' },
    { id: 'a4', projectId: 'marketing-site', type: 'keep_alive', status: 'success', occurredAt: hoursAgo(26), durationMs: 39, bytes: null, message: 'Keep-alive query succeeded' },
  ],
}
