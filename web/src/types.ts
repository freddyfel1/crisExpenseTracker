export type CategoryId = string

export interface Category {
  id: CategoryId
  name: string
  icon: string
  color: string
}

export interface Transaction {
  id: string
  date: string // ISO date
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

export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null // YYYY-MM-DD
  sortOrder: number
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
