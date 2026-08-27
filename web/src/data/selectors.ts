import type { Transaction } from '../types'
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
