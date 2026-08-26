import { supabase } from '../lib/supabase'
import type { Budget, Category, Profile, Transaction } from '../types'

type TransactionRow = {
  id: string
  category_id: string | null
  merchant: string
  amount: number
  occurred_on: string
  tax: number | null
  tip: number | null
  payment_method: string | null
  notes: string | null
  tags: string[]
  receipt_image_path: string | null
}

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  date: row.occurred_on,
  merchant: row.merchant,
  categoryId: row.category_id,
  amount: Number(row.amount),
  paymentMethod: row.payment_method,
  tax: row.tax !== null ? Number(row.tax) : null,
  tip: row.tip !== null ? Number(row.tip) : null,
  notes: row.notes,
  tags: row.tags ?? [],
  receiptImagePath: row.receipt_image_path,
})

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('occurred_on', { ascending: false })
  if (error) throw error
  return (data as TransactionRow[]).map(toTransaction)
}

export async function upsertTransaction(userId: string, t: Partial<Transaction> & { id: string }) {
  const { error } = await supabase.from('transactions').upsert({
    id: t.id,
    user_id: userId,
    category_id: t.categoryId ?? null,
    merchant: t.merchant,
    amount: t.amount,
    occurred_on: t.date,
    tax: t.tax ?? null,
    tip: t.tip ?? null,
    payment_method: t.paymentMethod ?? null,
    notes: t.notes ?? null,
    tags: t.tags ?? [],
    receipt_image_path: t.receiptImagePath ?? null,
  })
  if (error) throw error
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data as Category[]
}

export async function upsertCategory(userId: string, c: Category) {
  const { error } = await supabase.from('categories').upsert({
    id: c.id,
    user_id: userId,
    name: c.name,
    icon: c.icon,
    color: c.color,
  })
  if (error) throw error
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select('category_id, monthly_limit')
  if (error) throw error
  return (data as { category_id: string; monthly_limit: number }[]).map((b) => ({
    categoryId: b.category_id,
    monthlyLimit: Number(b.monthly_limit),
  }))
}

export async function upsertBudget(userId: string, categoryId: string, monthlyLimit: number) {
  const { error } = await supabase
    .from('budgets')
    .upsert({ user_id: userId, category_id: categoryId, monthly_limit: monthlyLimit })
  if (error) throw error
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    currency: data.currency,
    notifyBudgetAlerts: data.notify_budget_alerts,
    notifyWeeklySummary: data.notify_weekly_summary,
    notifyReceiptSync: data.notify_receipt_sync,
  }
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.currency !== undefined && { currency: patch.currency }),
      ...(patch.notifyBudgetAlerts !== undefined && { notify_budget_alerts: patch.notifyBudgetAlerts }),
      ...(patch.notifyWeeklySummary !== undefined && { notify_weekly_summary: patch.notifyWeeklySummary }),
      ...(patch.notifyReceiptSync !== undefined && { notify_receipt_sync: patch.notifyReceiptSync }),
    })
    .eq('id', userId)
  if (error) throw error
}

export async function getReceiptSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}
