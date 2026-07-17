export function formatDateTime(value: string | null, locale = navigator.language): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatBytes(bytes: number, locale = navigator.language): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1)
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index > 2 ? 1 : 0 }).format(bytes / 1000 ** index)} ${units[index]}`
}

export function formatDuration(ms: number | null, locale = navigator.language): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${new Intl.NumberFormat(locale).format(ms)} ms`
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(ms / 1000)} sec`
}
