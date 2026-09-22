import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteBudgetLineItem as apiDeleteBudgetLineItem,
  deleteBudgetSection as apiDeleteBudgetSection,
  deleteCategory as apiDeleteCategory,
  deleteInvestmentAccount as apiDeleteInvestmentAccount,
  deleteInvestmentTransaction as apiDeleteInvestmentTransaction,
  deleteSavingsGoal as apiDeleteSavingsGoal,
  deleteTransaction as apiDeleteTransaction,
  duplicateBudgetMonth as apiDuplicateBudgetMonth,
  fetchBudgetLineItems,
  fetchBudgetSections,
  fetchCategories,
  fetchInvestmentAccounts,
  fetchInvestmentPrices,
  fetchInvestmentsLastSynced,
  fetchInvestmentTransactions,
  fetchMonthlyIncome,
  fetchProfile,
  fetchSavingsGoals,
  fetchTransactions,
  importTransactions,
  refreshInvestmentPrices,
  updateProfile,
  upsertBudgetLineItem,
  upsertBudgetSection,
  upsertCategory,
  upsertInvestmentAccount,
  upsertInvestmentTransaction,
  upsertMonthlyIncome,
  upsertSavingsGoal,
  upsertTransaction,
} from './api'
import type { ImportableTransaction } from './api'
import type {
  AssetType,
  BudgetLineItem,
  BudgetSection,
  Category,
  InvestmentAccount,
  InvestmentTransaction,
  MonthlyIncome,
  Profile,
  SavingsGoal,
  Transaction,
} from '../types'
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
  const investmentAccountsQuery = useQuery({
    queryKey: ['investmentAccounts', userId],
    queryFn: fetchInvestmentAccounts,
    enabled: Boolean(userId),
  })
  const investmentTransactionsQuery = useQuery({
    queryKey: ['investmentTransactions', userId],
    queryFn: fetchInvestmentTransactions,
    enabled: Boolean(userId),
  })
  // Not user-scoped data (a symbol's price is the same for everyone), but still gated on
  // being signed in since the table itself requires it.
  const investmentPricesQuery = useQuery({
    queryKey: ['investmentPrices', userId],
    queryFn: fetchInvestmentPrices,
    enabled: Boolean(userId),
  })
  const investmentsLastSyncedQuery = useQuery({
    queryKey: ['investmentsLastSynced', userId],
    queryFn: fetchInvestmentsLastSynced,
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
    mutationFn: (entry: { monthKey: string; monthlyIncome?: number; otherIncome?: number }) =>
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
  const saveInvestmentAccount = useMutation({
    mutationFn: (a: Partial<InvestmentAccount> & { id?: string }) => upsertInvestmentAccount(userId!, a),
    onSuccess: () => invalidate('investmentAccounts'),
  })
  const removeInvestmentAccount = useMutation({
    mutationFn: (id: string) => apiDeleteInvestmentAccount(id),
    onSuccess: () => {
      invalidate('investmentAccounts')
      invalidate('investmentTransactions')
    },
  })
  const saveInvestmentTransaction = useMutation({
    mutationFn: (t: Partial<InvestmentTransaction> & { id?: string; accountId: string }) =>
      upsertInvestmentTransaction(userId!, t),
    onSuccess: () => invalidate('investmentTransactions'),
  })
  const removeInvestmentTransaction = useMutation({
    mutationFn: (id: string) => apiDeleteInvestmentTransaction(id),
    onSuccess: () => invalidate('investmentTransactions'),
  })
  const refreshPrices = useMutation({
    mutationFn: (symbols: { symbol: string; assetType: AssetType }[]) => refreshInvestmentPrices(symbols),
    onSuccess: () => invalidate('investmentPrices'),
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
    investmentAccounts: investmentAccountsQuery.data ?? ([] as InvestmentAccount[]),
    investmentTransactions: investmentTransactionsQuery.data ?? ([] as InvestmentTransaction[]),
    investmentPrices: investmentPricesQuery.data ?? ({} as Record<string, number>),
    investmentsLastSynced: investmentsLastSyncedQuery.data ?? null,
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

    saveMonthlyIncome: (entry: { monthKey: string; monthlyIncome?: number; otherIncome?: number }) =>
      saveMonthlyIncome.mutate(entry),

    addBudgetSection: (s: Partial<BudgetSection>) => saveBudgetSection.mutate(s),
    isSavingBudgetSection: saveBudgetSection.isPending,
    deleteBudgetSection: (id: string) => removeBudgetSection.mutate(id),
    saveBudgetLineItem: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) =>
      saveBudgetLineItem.mutate(item),
    isSavingBudgetLineItem: saveBudgetLineItem.isPending,
    deleteBudgetLineItem: (id: string) => removeBudgetLineItem.mutate(id),
    duplicateBudgetMonth: (
      fromSections: BudgetSection[],
      fromItemsBySection: Map<string, BudgetLineItem[]>,
      toMonthKey: string,
    ) => duplicateBudgetMonth.mutate({ fromSections, fromItemsBySection, toMonthKey }),
    isDuplicatingBudgetMonth: duplicateBudgetMonth.isPending,

    saveSavingsGoal: (g: Partial<SavingsGoal> & { id?: string }) => saveSavingsGoal.mutate(g),
    isSavingSavingsGoal: saveSavingsGoal.isPending,
    deleteSavingsGoal: (id: string) => removeSavingsGoal.mutate(id),

    saveInvestmentAccount: (a: Partial<InvestmentAccount> & { id?: string }) => saveInvestmentAccount.mutate(a),
    deleteInvestmentAccount: (id: string) => removeInvestmentAccount.mutate(id),
    saveInvestmentTransaction: (t: Partial<InvestmentTransaction> & { id?: string; accountId: string }) =>
      saveInvestmentTransaction.mutate(t),
    deleteInvestmentTransaction: (id: string) => removeInvestmentTransaction.mutate(id),
    refreshInvestmentPrices: (symbols: { symbol: string; assetType: AssetType }[]) =>
      refreshPrices.mutateAsync(symbols),
    isRefreshingPrices: refreshPrices.isPending,
  }
}
