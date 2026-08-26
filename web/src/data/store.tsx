import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteCategory as apiDeleteCategory,
  deleteTransaction as apiDeleteTransaction,
  fetchBudgets,
  fetchCategories,
  fetchTransactions,
  upsertBudget,
  upsertCategory,
  upsertTransaction,
} from './api'
import type { Budget, Category, Transaction } from '../types'
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
  const budgetsQuery = useQuery({
    queryKey: ['budgets', userId],
    queryFn: fetchBudgets,
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
  const saveCategory = useMutation({
    mutationFn: (c: Category) => upsertCategory(userId!, c),
    onSuccess: () => invalidate('categories'),
  })
  const removeCategory = useMutation({
    mutationFn: (id: string) => apiDeleteCategory(id),
    onSuccess: () => {
      invalidate('categories')
      invalidate('budgets')
    },
  })
  const saveBudget = useMutation({
    mutationFn: ({ categoryId, monthlyLimit }: { categoryId: string; monthlyLimit: number }) =>
      upsertBudget(userId!, categoryId, monthlyLimit),
    onSuccess: () => invalidate('budgets'),
  })

  return {
    transactions: transactionsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    budgets: budgetsQuery.data ?? ([] as Budget[]),
    isLoading: transactionsQuery.isLoading || categoriesQuery.isLoading || budgetsQuery.isLoading,

    addTransaction: (t: Transaction) => saveTransaction.mutate(t),
    updateTransaction: (id: string, patch: Partial<Transaction>) => saveTransaction.mutate({ id, ...patch }),
    deleteTransaction: (id: string) => removeTransaction.mutate(id),

    addCategory: (c: Category) => saveCategory.mutate(c),
    updateCategory: (id: string, patch: Partial<Category>) => {
      const existing = categoriesQuery.data?.find((c) => c.id === id)
      if (existing) saveCategory.mutate({ ...existing, ...patch })
    },
    deleteCategory: (id: string) => removeCategory.mutate(id),

    setBudget: (categoryId: string, monthlyLimit: number) => saveBudget.mutate({ categoryId, monthlyLimit }),
  }
}
