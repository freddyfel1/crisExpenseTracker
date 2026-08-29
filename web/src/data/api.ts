import { supabase } from '../lib/supabase'
import type { BudgetLineItem, BudgetSection, Category, Profile, Transaction } from '../types'
import { currentMonthKey } from '../utils/format'

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
    monthlyIncome: Number(data.monthly_income),
    otherIncome: Number(data.other_income),
    monthlySavings: Number(data.monthly_savings),
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
      ...(patch.monthlyIncome !== undefined && { monthly_income: patch.monthlyIncome }),
      ...(patch.otherIncome !== undefined && { other_income: patch.otherIncome }),
      ...(patch.monthlySavings !== undefined && { monthly_savings: patch.monthlySavings }),
    })
    .eq('id', userId)
  if (error) throw error
}

export async function fetchBudgetSections(): Promise<BudgetSection[]> {
  const { data, error } = await supabase.from('budget_sections').select('*').order('sort_order')
  if (error) throw error
  return (data as { id: string; name: string; sort_order: number; month_key: string }[]).map((s) => ({
    id: s.id,
    name: s.name,
    sortOrder: s.sort_order,
    monthKey: s.month_key,
  }))
}

export async function upsertBudgetSection(userId: string, s: Partial<BudgetSection> & { id?: string }) {
  const { data, error } = await supabase
    .from('budget_sections')
    .upsert({ id: s.id, user_id: userId, name: s.name, sort_order: s.sortOrder ?? 0, month_key: s.monthKey })
    .select()
    .single()
  if (error) throw error
  return { id: data.id, name: data.name, sortOrder: data.sort_order, monthKey: data.month_key } as BudgetSection
}

/** Copies a month's sections + line items forward/backward into a month that has no data yet. */
export async function duplicateBudgetMonth(
  userId: string,
  fromSections: BudgetSection[],
  fromItemsBySection: Map<string, BudgetLineItem[]>,
  toMonthKey: string,
) {
  if (fromSections.length === 0) return

  const { data: newSections, error: sectionsError } = await supabase
    .from('budget_sections')
    .insert(
      fromSections.map((s) => ({
        user_id: userId,
        name: s.name,
        sort_order: s.sortOrder,
        month_key: toMonthKey,
      })),
    )
    .select()
  if (sectionsError) throw sectionsError

  const idMap = new Map<string, string>()
  fromSections.forEach((s, i) => idMap.set(s.id, newSections[i].id))

  // Only the month the user is actually editing keeps real amounts — every
  // duplicated month (past or future) starts blank so it's not just a copy
  // of whatever the source month happened to have.
  const clearAmounts = toMonthKey !== currentMonthKey()

  const newItems = fromSections.flatMap((s) =>
    (fromItemsBySection.get(s.id) ?? []).map((item) => ({
      user_id: userId,
      section_id: idMap.get(s.id)!,
      name: item.name,
      monthly_amount: clearAmounts ? 0 : item.monthlyAmount,
      misc_info: item.miscInfo,
      remarks: item.remarks,
      sort_order: item.sortOrder,
    })),
  )
  if (newItems.length > 0) {
    const { error: itemsError } = await supabase.from('budget_line_items').insert(newItems)
    if (itemsError) throw itemsError
  }
}

export async function deleteBudgetSection(id: string) {
  const { error } = await supabase.from('budget_sections').delete().eq('id', id)
  if (error) throw error
}

export async function fetchBudgetLineItems(): Promise<BudgetLineItem[]> {
  const { data, error } = await supabase.from('budget_line_items').select('*').order('sort_order')
  if (error) throw error
  return (
    data as {
      id: string
      section_id: string
      name: string
      monthly_amount: number
      misc_info: string | null
      remarks: string | null
      sort_order: number
    }[]
  ).map((i) => ({
    id: i.id,
    sectionId: i.section_id,
    name: i.name,
    monthlyAmount: Number(i.monthly_amount),
    miscInfo: i.misc_info,
    remarks: i.remarks,
    sortOrder: i.sort_order,
  }))
}

export async function upsertBudgetLineItem(
  userId: string,
  item: Partial<BudgetLineItem> & { id?: string; sectionId: string },
) {
  const { error } = await supabase.from('budget_line_items').upsert({
    id: item.id,
    user_id: userId,
    section_id: item.sectionId,
    name: item.name,
    monthly_amount: item.monthlyAmount ?? 0,
    misc_info: item.miscInfo ?? null,
    remarks: item.remarks ?? null,
    sort_order: item.sortOrder ?? 0,
  })
  if (error) throw error
}

export async function deleteBudgetLineItem(id: string) {
  const { error } = await supabase.from('budget_line_items').delete().eq('id', id)
  if (error) throw error
}

export async function getReceiptSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60)
  if (error) return null
  return data.signedUrl
}

export async function uploadReceiptPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('receipts').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
  })
  if (error) throw error
  return path
}

export interface ParsedReceipt {
  merchant?: string
  date?: string | null
  amount?: number
  tax?: number | null
  tip?: number | null
  categoryId?: string | null
  confidence?: 'high' | 'medium' | 'low'
  error?: string
}

export async function parseReceipt(path: string): Promise<ParsedReceipt> {
  const { data, error } = await supabase.functions.invoke('parse-receipt', { body: { path } })
  if (error) throw error
  return data as ParsedReceipt
}
