export const firstName = (fullName: string | null | undefined): string => fullName?.trim().split(/\s+/)[0] ?? ''

export const formatMoney = (amount: number): string =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const formatMoneyCompact = (amount: number): string =>
  Math.abs(amount) >= 1000
    ? `$${(amount / 1000).toFixed(1)}k`
    : formatMoney(amount)

// Parses the YYYY-MM-DD part as a local calendar date, not UTC — `new Date(iso)`
// on a date-only string parses as UTC midnight, which rolls back a day when
// displayed in any timezone behind UTC.
const toLocalDate = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const formatDate = (iso: string): string =>
  toLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// For a full timestamp (not a date-only string) where recency matters more than the exact
// date — e.g. "last synced 5 minutes ago" vs. a bare date that looks the same whether sync
// ran once this morning or hasn't run in weeks.
export const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatMonthLabel = (iso: string): string =>
  toLocalDate(iso).toLocaleDateString('en-US', { month: 'short' })

export const monthKey = (iso: string): string => iso.slice(0, 7) // YYYY-MM

export const todayKey = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const currentMonthKey = (): string => new Date().toISOString().slice(0, 7)

export const monthKeyLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
