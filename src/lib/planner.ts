import type { SupabasePlan } from '../domain'

export const PLAN_EGRESS_GB: Record<Exclude<SupabasePlan, 'enterprise'>, number> = {
  free: 5,
  pro: 250,
  team: 250,
}

export const BACKUP_BUDGET_RATIO = 0.6
export const RETENTION_DAYS = 7

const schedules = [
  { hours: 1, label: 'Hourly' },
  { hours: 3, label: 'Every 3 hours' },
  { hours: 6, label: 'Every 6 hours' },
  { hours: 12, label: 'Every 12 hours' },
  { hours: 24, label: 'Daily' },
  { hours: 48, label: 'Every 2 days' },
  { hours: 168, label: 'Weekly' },
] as const

export interface BackupRecommendation {
  measured: boolean
  label: string
  intervalHours: number | null
  planQuotaBytes: number
  backupBudgetBytes: number
  projectedMonthlyEgressBytes: number
  projectedR2Bytes: number
  backupsPerMonth: number
  warning: string | null
}

const GB = 1_000_000_000
const MONTH_HOURS = 30 * 24

export function recommendBackupFrequency(plan: SupabasePlan, dumpBytes: number): BackupRecommendation {
  if (plan === 'enterprise') {
    return { measured: false, label: 'Custom contract', intervalHours: null, planQuotaBytes: 0, backupBudgetBytes: 0, projectedMonthlyEgressBytes: 0, projectedR2Bytes: 0, backupsPerMonth: 0, warning: 'Configure the egress allowance from your Enterprise contract before calculating a schedule.' }
  }
  const planQuotaBytes = PLAN_EGRESS_GB[plan] * GB
  const backupBudgetBytes = planQuotaBytes * BACKUP_BUDGET_RATIO
  if (!Number.isFinite(dumpBytes) || dumpBytes <= 0) {
    return { measured: false, label: 'Measure first dump', intervalHours: null, planQuotaBytes, backupBudgetBytes, projectedMonthlyEgressBytes: 0, projectedR2Bytes: 0, backupsPerMonth: 0, warning: 'Run the first backup to measure its exported size.' }
  }

  const selected = schedules.find(schedule => dumpBytes * (MONTH_HOURS / schedule.hours) <= backupBudgetBytes)
  const schedule = selected ?? schedules[schedules.length - 1]
  const backupsPerMonth = MONTH_HOURS / schedule.hours
  const projectedMonthlyEgressBytes = dumpBytes * backupsPerMonth
  const retainedSnapshots = Math.ceil((RETENTION_DAYS * 24) / schedule.hours)
  const projectedR2Bytes = dumpBytes * retainedSnapshots
  const warning = selected ? null : 'Even weekly full dumps exceed the conservative backup budget. Exclude data or increase the egress budget.'

  return { measured: true, label: schedule.label, intervalHours: schedule.hours, planQuotaBytes, backupBudgetBytes, projectedMonthlyEgressBytes, projectedR2Bytes, backupsPerMonth, warning }
}
