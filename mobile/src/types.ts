// Mirrors web/src/types.ts — keep the two in sync until this becomes a shared package.

export type CategoryId = string

export interface Category {
  id: CategoryId
  name: string
  icon: string
  color: string
}

export interface Transaction {
  id: string
  date: string // ISO date, mapped from the `occurred_on` column
  merchant: string
  categoryId: CategoryId | null
  amount: number
  paymentMethod: string | null
  tax?: number | null
  tip?: number | null
  notes?: string | null
  tags: string[]
  receiptImagePath?: string | null
}

export interface Profile {
  id: string
  name: string
  currency: string
  notifyBudgetAlerts: boolean
  notifyWeeklySummary: boolean
  notifyReceiptSync: boolean
  monthlySavings: number
}

export interface MonthlyIncome {
  id: string
  monthKey: string // YYYY-MM
  monthlyIncome: number
  otherIncome: number
}

export interface BudgetSection {
  id: string
  name: string
  sortOrder: number
  monthKey: string // YYYY-MM
}

export interface BudgetLineItem {
  id: string
  sectionId: string
  name: string
  monthlyAmount: number
  miscInfo: string | null
  remarks: string | null
  sortOrder: number
}

export type InvestmentAccountType = 'brokerage' | 'crypto' | 'retirement' | 'other'

export interface InvestmentAccount {
  id: string
  name: string
  institution: string | null
  accountType: InvestmentAccountType
  sortOrder: number
}

export type AssetType = 'etf' | 'stock' | 'crypto' | 'other'
export type InvestmentTransactionType = 'buy' | 'sell' | 'dividend' | 'other'

export interface InvestmentTransaction {
  id: string
  accountId: string
  symbol: string
  assetType: AssetType
  transactionType: InvestmentTransactionType
  quantity: number
  pricePerUnit: number
  fees: number
  date: string // ISO date
  notes: string | null
}

export type DebtType = 'mortgage' | 'personal_loan' | 'credit_card' | 'friend_loan' | 'other'

export interface Debt {
  id: string
  name: string
  debtType: DebtType
  institution: string | null
  principal: number // original loan amount
  interestRate: number // annual %, 0 for a no-interest loan
  termMonths: number // original term; 0 if open-ended/unknown
  monthlyPayment: number
  startDate: string // YYYY-MM-DD
  notes: string | null
  sortOrder: number
}

export interface DebtPayment {
  id: string
  debtId: string
  date: string // ISO date
  amount: number
  notes: string | null
}
