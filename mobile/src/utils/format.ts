export const formatMoney = (amount: number): string =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const formatMoneyCompact = (amount: number): string =>
  Math.abs(amount) >= 1000 ? `$${(amount / 1000).toFixed(1)}k` : formatMoney(amount)

// Parses the YYYY-MM-DD part as a local calendar date, not UTC — `new Date(iso)`
// on a date-only string parses as UTC midnight, which rolls back a day when
// displayed in any timezone behind UTC.
const toLocalDate = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const formatDate = (iso: string): string =>
  toLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const monthKeyLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
