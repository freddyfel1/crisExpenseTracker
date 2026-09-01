import type { MonthlyIncome, Transaction } from '../types'
import { monthKey } from '../utils/format'

export const transactionsForMonth = (transactions: Transaction[], month: string): Transaction[] =>
  transactions.filter((t) => monthKey(t.date) === month)

export const totalSpend = (transactions: Transaction[]): number =>
  transactions.reduce((sum, t) => sum + t.amount, 0)

export interface CategorySpend {
  categoryId: string | null
  total: number
  count: number
}

export const spendByCategory = (transactions: Transaction[]): CategorySpend[] => {
  const map = new Map<string | null, CategorySpend>()
  for (const t of transactions) {
    const entry = map.get(t.categoryId) ?? { categoryId: t.categoryId, total: 0, count: 0 }
    entry.total += t.amount
    entry.count += 1
    map.set(t.categoryId, entry)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export const transactionsForCurrentWeek = (transactions: Transaction[]): Transaction[] => {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay() // Mon=1..Sun=7
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(now.getDate() - (day - 1))
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return transactions.filter((t) => {
    const d = new Date(t.date)
    return d >= start && d < end
  })
}

export const currentCalendarMonth = (): number => new Date().getMonth() + 1

// All months of `year` from January up through `cutoffMonth` (1-12) — e.g.
// monthsUpTo('2025', 2) is Jan-Feb 2025, regardless of what year/month it
// actually is right now. Callers default cutoffMonth to
// currentCalendarMonth() when the user hasn't picked a specific month.
export const monthsUpTo = (year: string, cutoffMonth: number): string[] =>
  Array.from({ length: cutoffMonth }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

const monthsBetween = (a: string, b: string): number => {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return Math.abs((ay - by) * 12 + (am - bm))
}

// A month with no monthly_income row yet isn't "no income" — it just hasn't
// been touched. Income tends to hold steady month to month, so fall back to
// the nearest month that *does* have a row (preferring the closest earlier
// month, since that's the most recently known real figure; falling back to
// the closest later month only for a brand-new user whose only data point is
// in the future relative to the gap, e.g. everything seeded from the current
// month). The fallback is capped to within a year either way so a single
// recorded month doesn't get copied across a decade of unrelated history
// (e.g. old imported transactions from years before income was ever
// tracked) — beyond that gap, an untouched month is genuinely 0, not a
// guess.
const MAX_CARRY_FORWARD_MONTHS = 12

export const monthlyIncomeEntryForMonth = (
  entries: MonthlyIncome[],
  month: string,
): { monthlyIncome: number; otherIncome: number } => {
  const exact = entries.find((e) => e.monthKey === month)
  if (exact) return { monthlyIncome: exact.monthlyIncome, otherIncome: exact.otherIncome }

  const nearby = entries.filter((e) => monthsBetween(e.monthKey, month) <= MAX_CARRY_FORWARD_MONTHS)

  const earlier = nearby.filter((e) => e.monthKey < month).sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0]
  if (earlier) return { monthlyIncome: earlier.monthlyIncome, otherIncome: earlier.otherIncome }

  const later = nearby.filter((e) => e.monthKey > month).sort((a, b) => a.monthKey.localeCompare(b.monthKey))[0]
  if (later) return { monthlyIncome: later.monthlyIncome, otherIncome: later.otherIncome }

  return { monthlyIncome: 0, otherIncome: 0 }
}

export const incomeForMonth = (entries: MonthlyIncome[], month: string): number => {
  const { monthlyIncome, otherIncome } = monthlyIncomeEntryForMonth(entries, month)
  return monthlyIncome + otherIncome
}

export const totalIncomeForMonths = (entries: MonthlyIncome[], months: string[]): number =>
  months.reduce((sum, m) => sum + incomeForMonth(entries, m), 0)

export const spendTrend = (transactions: Transaction[], monthsBack: number) => {
  const now = new Date()
  const months: { key: string; label: string; total: number }[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    const total = totalSpend(transactionsForMonth(transactions, key))
    months.push({ key, label, total: Math.round(total * 100) / 100 })
  }
  return months
}
