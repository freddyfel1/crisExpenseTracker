import type { Budget, Transaction } from '../types'

export const monthKey = (iso: string): string => iso.slice(0, 7)
export const currentMonthKey = (): string => new Date().toISOString().slice(0, 7)

export const transactionsForMonth = (transactions: Transaction[], month: string): Transaction[] =>
  transactions.filter((t) => monthKey(t.date) === month)

export const totalSpend = (transactions: Transaction[]): number =>
  transactions.reduce((sum, t) => sum + t.amount, 0)

export const totalBudget = (budgets: Budget[]): number =>
  budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)

export interface CategorySpend {
  categoryId: string | null
  total: number
  count: number
}

export const spendByCategory = (transactions: Transaction[]): CategorySpend[] => {
  const map = new Map<string, CategorySpend>()
  for (const t of transactions) {
    const key = t.categoryId ?? 'uncategorized'
    const entry = map.get(key) ?? { categoryId: t.categoryId, total: 0, count: 0 }
    entry.total += t.amount
    entry.count += 1
    map.set(key, entry)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}
