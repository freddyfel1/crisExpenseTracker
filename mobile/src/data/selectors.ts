import type { AssetType, InvestmentTransaction, Transaction } from '../types'

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

export const totalInvested = (transactions: InvestmentTransaction[], accountIds: string[]): number =>
  accountIds.reduce(
    (sum, id) => sum + holdingsForAccount(transactions, id).reduce((s, h) => s + h.costBasis, 0),
    0,
  )

// Mirrors web/src/data/selectors.ts marketValue — falls back to cost basis for a holding
// whose live price hasn't been fetched yet (or couldn't be matched by Finnhub).
export const marketValue = (holdings: Holding[], prices: Record<string, number>): number =>
  holdings.reduce((sum, h) => sum + (prices[h.symbol] != null ? prices[h.symbol] * h.quantity : h.costBasis), 0)
