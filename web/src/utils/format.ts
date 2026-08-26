export const formatMoney = (amount: number): string =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const formatMoneyCompact = (amount: number): string =>
  Math.abs(amount) >= 1000
    ? `$${(amount / 1000).toFixed(1)}k`
    : formatMoney(amount)

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const formatMonthLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short' })

export const monthKey = (iso: string): string => iso.slice(0, 7) // YYYY-MM

export const currentMonthKey = (): string => new Date().toISOString().slice(0, 7)

export const monthKeyLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
