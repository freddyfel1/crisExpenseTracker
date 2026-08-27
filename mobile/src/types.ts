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

export interface Budget {
  categoryId: CategoryId
  monthlyLimit: number
}

export interface BudgetSection {
  id: string
  name: string
  sortOrder: number
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

export interface Profile {
  id: string
  name: string
  currency: string
  monthlyIncome: number
  monthlySavings: number
  notifyBudgetAlerts: boolean
  notifyWeeklySummary: boolean
  notifyReceiptSync: boolean
}
