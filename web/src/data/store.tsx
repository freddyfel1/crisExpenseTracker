import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteBudgetLineItem as apiDeleteBudgetLineItem,
  deleteBudgetSection as apiDeleteBudgetSection,
  deleteCategory as apiDeleteCategory,
  deleteSavingsGoal as apiDeleteSavingsGoal,
  deleteTransaction as apiDeleteTransaction,
  duplicateBudgetMonth as apiDuplicateBudgetMonth,
  fetchBudgetLineItems,
  fetchBudgetSections,
  fetchCategories,
  fetchMonthlyIncome,
  fetchProfile,
  fetchSavingsGoals,
  fetchTransactions,
  importTransactions,
  updateProfile,
  upsertBudgetLineItem,
  upsertBudgetSection,
  upsertCategory,
  upsertMonthlyIncome,
  upsertSavingsGoal,
  upsertTransaction,
} from './api'
import type { ImportableTransaction } from './api'
import type { BudgetLineItem, BudgetSection, Category, MonthlyIncome, Profile, SavingsGoal, Transaction } from '../types'
import { useSession } from '../hooks/useSession'

// A thin wrapper over TanStack Query so every page can keep reading
// `useStore()` for plain arrays + mutator functions, same as before this was
// backed by Supabase instead of localStorage.
export function useStore() {
  const { session } = useSession()
  const userId = session?.user.id
  const queryClient = useQueryClient()

  const transactionsQuery = useQuery({
    queryKey: ['transactions', userId],
    queryFn: fetchTransactions,
    enabled: Boolean(userId),
  })
  const categoriesQuery = useQuery({
    queryKey: ['categories', userId],
    queryFn: fetchCategories,
    enabled: Boolean(userId),
  })
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: Boolean(userId),
  })
  const budgetSectionsQuery = useQuery({
    queryKey: ['budgetSections', userId],
    queryFn: fetchBudgetSections,
    enabled: Boolean(userId),
  })
  const budgetLineItemsQuery = useQuery({
    queryKey: ['budgetLineItems', userId],
    queryFn: fetchBudgetLineItems,
    enabled: Boolean(userId),
  })
  const monthlyIncomeQuery = useQuery({
    queryKey: ['monthlyIncome', userId],
    queryFn: fetchMonthlyIncome,
    enabled: Boolean(userId),
  })
  const savingsGoalsQuery = useQuery({
    queryKey: ['savingsGoals', userId],
    queryFn: fetchSavingsGoals,
    enabled: Boolean(userId),
  })

  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key, userId] })

  const saveTransaction = useMutation({
    mutationFn: (t: Partial<Transaction> & { id: string }) => upsertTransaction(userId!, t),
    onSuccess: () => invalidate('transactions'),
  })
  const removeTransaction = useMutation({
    mutationFn: (id: string) => apiDeleteTransaction(id),
    onSuccess: () => invalidate('transactions'),
  })
  const bulkImportTransactions = useMutation({
    mutationFn: (rows: ImportableTransaction[]) => importTransactions(userId!, rows),
    onSuccess: () => invalidate('transactions'),
  })
  const saveCategory = useMutation({
    mutationFn: (c: Category) => upsertCategory(userId!, c),
    onSuccess: () => invalidate('categories'),
  })
  const removeCategory = useMutation({
    mutationFn: (id: string) => apiDeleteCategory(id),
    onSuccess: () => invalidate('categories'),
  })
  const saveProfile = useMutation({
    mutationFn: (patch: Partial<Profile>) => updateProfile(userId!, patch),
    onSuccess: () => invalidate('profile'),
  })
  const saveBudgetSection = useMutation({
    mutationFn: (s: Partial<BudgetSection> & { id?: string }) => upsertBudgetSection(userId!, s),
    onSuccess: () => invalidate('budgetSections'),
  })
  const removeBudgetSection = useMutation({
    mutationFn: (id: string) => apiDeleteBudgetSection(id),
    onSuccess: () => {
      invalidate('budgetSections')
      invalidate('budgetLineItems')
    },
  })
  const saveBudgetLineItem = useMutation({
    mutationFn: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) =>
      upsertBudgetLineItem(userId!, item),
    onSuccess: () => invalidate('budgetLineItems'),
  })
  const removeBudgetLineItem = useMutation({
    mutationFn: (id: string) => apiDeleteBudgetLineItem(id),
    onSuccess: () => invalidate('budgetLineItems'),
  })
  const saveMonthlyIncome = useMutation({
    mutationFn: (entry: { monthKey: string; monthlyIncome: number; otherIncome: number }) =>
      upsertMonthlyIncome(userId!, entry),
    onSuccess: () => invalidate('monthlyIncome'),
  })
  const saveSavingsGoal = useMutation({
    mutationFn: (g: Partial<SavingsGoal> & { id?: string }) => upsertSavingsGoal(userId!, g),
    onSuccess: () => invalidate('savingsGoals'),
  })
  const removeSavingsGoal = useMutation({
    mutationFn: (id: string) => apiDeleteSavingsGoal(id),
    onSuccess: () => invalidate('savingsGoals'),
  })
  const duplicateBudgetMonth = useMutation({
    mutationFn: ({ fromSections, fromItemsBySection, toMonthKey }: {
      fromSections: BudgetSection[]
      fromItemsBySection: Map<string, BudgetLineItem[]>
      toMonthKey: string
    }) => apiDuplicateBudgetMonth(userId!, fromSections, fromItemsBySection, toMonthKey),
    onSuccess: () => {
      invalidate('budgetSections')
      invalidate('budgetLineItems')
    },
  })

  return {
    transactions: transactionsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    profile: profileQuery.data,
    budgetSections: budgetSectionsQuery.data ?? ([] as BudgetSection[]),
    budgetLineItems: budgetLineItemsQuery.data ?? ([] as BudgetLineItem[]),
    monthlyIncomes: monthlyIncomeQuery.data ?? ([] as MonthlyIncome[]),
    savingsGoals: savingsGoalsQuery.data ?? ([] as SavingsGoal[]),
    isLoading: transactionsQuery.isLoading || categoriesQuery.isLoading,

    addTransaction: (t: Transaction) => saveTransaction.mutate(t),
    updateTransaction: (id: string, patch: Partial<Transaction>) => saveTransaction.mutate({ id, ...patch }),
    deleteTransaction: (id: string) => removeTransaction.mutate(id),
    importTransactions: (rows: ImportableTransaction[]) => bulkImportTransactions.mutateAsync(rows),
    isImportingTransactions: bulkImportTransactions.isPending,

    addCategory: (c: Category) => saveCategory.mutate(c),
    updateCategory: (id: string, patch: Partial<Category>) => {
      const existing = categoriesQuery.data?.find((c) => c.id === id)
      if (existing) saveCategory.mutate({ ...existing, ...patch })
    },
    deleteCategory: (id: string) => removeCategory.mutate(id),

    updateProfile: (patch: Partial<Profile>) => saveProfile.mutate(patch),

    saveMonthlyIncome: (entry: { monthKey: string; monthlyIncome: number; otherIncome: number }) =>
      saveMonthlyIncome.mutate(entry),

    addBudgetSection: (s: Partial<BudgetSection>) => saveBudgetSection.mutate(s),
    deleteBudgetSection: (id: string) => removeBudgetSection.mutate(id),
    saveBudgetLineItem: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) =>
      saveBudgetLineItem.mutate(item),
    deleteBudgetLineItem: (id: string) => removeBudgetLineItem.mutate(id),
    duplicateBudgetMonth: (
      fromSections: BudgetSection[],
      fromItemsBySection: Map<string, BudgetLineItem[]>,
      toMonthKey: string,
    ) => duplicateBudgetMonth.mutate({ fromSections, fromItemsBySection, toMonthKey }),
    isDuplicatingBudgetMonth: duplicateBudgetMonth.isPending,

    saveSavingsGoal: (g: Partial<SavingsGoal> & { id?: string }) => saveSavingsGoal.mutate(g),
    deleteSavingsGoal: (id: string) => removeSavingsGoal.mutate(id),
  }
}
