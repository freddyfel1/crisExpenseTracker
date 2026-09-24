import type { AssetType, BudgetLineItem, BudgetSection, InvestmentTransaction, MonthlyIncome, Transaction } from '../types'

export const monthKey = (iso: string): string => iso.slice(0, 7)
export const currentMonthKey = (): string => new Date().toISOString().slice(0, 7)

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

export interface Holding {
  symbol: string
  assetType: AssetType
  quantity: number
  avgCost: number
  costBasis: number
  dividends: number
}

// Mirrors web/src/data/selectors.ts holdingsForAccount — holdings aren't
// stored, they're derived from the buy/sell/dividend log. Average cost uses
// all buys ever made (not just the ones still held), which is a
// simplification but keeps a sale from needing to pick which lot it closed.
export const holdingsForAccount = (transactions: InvestmentTransaction[], accountId: string): Holding[] => {
  const bySymbol = new Map<
    string,
    { assetType: AssetType; buyQty: number; buyCost: number; sellQty: number; dividends: number }
  >()
  for (const t of transactions) {
    if (t.accountId !== accountId) continue
    const entry = bySymbol.get(t.symbol) ?? { assetType: t.assetType, buyQty: 0, buyCost: 0, sellQty: 0, dividends: 0 }
    if (t.transactionType === 'buy') {
      entry.buyQty += t.quantity
      entry.buyCost += t.quantity * t.pricePerUnit + t.fees
    } else if (t.transactionType === 'sell') {
      entry.sellQty += t.quantity
    } else if (t.transactionType === 'dividend') {
      entry.dividends += t.quantity * t.pricePerUnit
    }
    // 'other' (fees, transfers, cash deposits/withdrawals) doesn't affect holdings or dividends.
    bySymbol.set(t.symbol, entry)
  }
  return [...bySymbol.entries()]
    .map(([symbol, e]) => {
      const quantity = e.buyQty - e.sellQty
      const avgCost = e.buyQty > 0 ? e.buyCost / e.buyQty : 0
      return {
        symbol,
        assetType: e.assetType,
        quantity,
        avgCost,
        costBasis: quantity * avgCost,
        dividends: e.dividends,
      }
    })
    .filter((h) => h.quantity > 0 || h.dividends > 0)
    .sort((a, b) => b.costBasis - a.costBasis)
}

// Combines the same symbol held across multiple accounts into one row (summing quantity,
// cost basis, and dividends, and recomputing avgCost from the combined totals) — without
// this, a portfolio-wide view built from `accounts.flatMap(a => holdingsForAccount(...))`
// shows the same symbol as separate rows per account: a duplicate React key wherever it's
// used as a list key, an inflated holdings count, and confusingly duplicate chart bars.
export const mergeHoldingsBySymbol = (holdings: Holding[]): Holding[] => {
  const bySymbol = new Map<string, Holding>()
  for (const h of holdings) {
    const existing = bySymbol.get(h.symbol)
    if (!existing) {
      bySymbol.set(h.symbol, { ...h })
      continue
    }
    existing.quantity += h.quantity
    existing.costBasis += h.costBasis
    existing.dividends += h.dividends
    existing.avgCost = existing.quantity > 0 ? existing.costBasis / existing.quantity : 0
  }
  return [...bySymbol.values()].sort((a, b) => b.costBasis - a.costBasis)
}

export const totalInvested = (transactions: InvestmentTransaction[], accountIds: string[]): number =>
  accountIds.reduce(
    (sum, id) => sum + holdingsForAccount(transactions, id).reduce((s, h) => s + h.costBasis, 0),
    0,
  )

// Mirrors web/src/data/selectors.ts marketValue — falls back to cost basis for a holding
// whose live price hasn't been fetched yet (or couldn't be matched by Finnhub).
export const marketValue = (holdings: Holding[], prices: Record<string, number>): number =>
  holdings.reduce((sum, h) => sum + (prices[h.symbol] != null ? prices[h.symbol] * h.quantity : h.costBasis), 0)

const monthsBetween = (a: string, b: string): number => {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return Math.abs((ay - by) * 12 + (am - bm))
}

// Mirrors web/src/data/selectors.ts monthlyIncomeEntryForMonth — a month with no
// monthly_income row yet isn't "no income", it just hasn't been touched, so fall back to
// the nearest month that does have a row (preferring the closest earlier month, then the
// closest later one), capped to within a year so a single recorded month doesn't get
// copied across a decade of unrelated history.
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

export interface SectionBudget {
  sectionId: string
  name: string
  total: number
}

// Mirrors budgetStatsForMonth's `expenses` figure (savings section excluded) broken down
// per section, so its total lines up with the "Budgeted" side of the Dashboard's
// budget-vs-actual comparison instead of double-counting money already earmarked as savings.
export const budgetBySection = (
  budgetSections: BudgetSection[],
  itemsBySection: Map<string, BudgetLineItem[]>,
  month: string,
): SectionBudget[] => {
  const sections = budgetSections.filter((s) => s.monthKey === month)
  const savingsSection = sections.find((s) => s.name.toLowerCase().includes('saving'))
  return sections
    .filter((s) => s.id !== savingsSection?.id)
    .map((s) => ({
      sectionId: s.id,
      name: s.name,
      total: (itemsBySection.get(s.id) ?? []).reduce((sum, i) => sum + i.monthlyAmount, 0),
    }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
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

export const groupBudgetItemsBySection = (items: BudgetLineItem[]): Map<string, BudgetLineItem[]> => {
  const map = new Map<string, BudgetLineItem[]>()
  for (const item of items) {
    const list = map.get(item.sectionId) ?? []
    list.push(item)
    map.set(item.sectionId, list)
  }
  return map
}

export interface BudgetStats {
  income: number
  expenses: number
  savings: number
  difference: number
  balance: number
}

// A "savings" section is identified by name (see the app's own convention) rather than a
// dedicated flag, so its line items count toward `savings` instead of `expenses` — mirrors
// web/src/data/selectors.ts budgetStatsForMonth exactly.
export function budgetStatsForMonth(
  month: string,
  budgetSections: BudgetSection[],
  itemsBySection: Map<string, BudgetLineItem[]>,
  monthlyIncomes: MonthlyIncome[],
): BudgetStats {
  const sections = budgetSections.filter((s) => s.monthKey === month)
  const savingsSection = sections.find((s) => s.name.toLowerCase().includes('saving'))
  const savings = (itemsBySection.get(savingsSection?.id ?? '') ?? []).reduce((sum, i) => sum + i.monthlyAmount, 0)
  const expenses = sections
    .filter((s) => s.id !== savingsSection?.id)
    .reduce((sum, s) => sum + (itemsBySection.get(s.id) ?? []).reduce((a, i) => a + i.monthlyAmount, 0), 0)
  const { monthlyIncome, otherIncome } = monthlyIncomeEntryForMonth(monthlyIncomes, month)
  const income = monthlyIncome + otherIncome
  const difference = income - expenses
  const balance = difference - savings
  return { income, expenses, savings, difference, balance }
}
