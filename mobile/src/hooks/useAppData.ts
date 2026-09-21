import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteBudgetLineItem,
  deleteBudgetSection,
  deleteInvestmentAccount,
  deleteInvestmentTransaction,
  deleteTransaction,
  fetchBudgetLineItems,
  fetchBudgetSections,
  fetchCategories,
  fetchInvestmentAccounts,
  fetchInvestmentPrices,
  fetchInvestmentTransactions,
  fetchProfile,
  fetchTransactions,
  refreshInvestmentPrices,
  updateProfile,
  upsertBudgetLineItem,
  upsertBudgetSection,
  upsertInvestmentAccount,
  upsertInvestmentTransaction,
  upsertTransaction,
} from '../data/api'
import type {
  AssetType,
  BudgetLineItem,
  BudgetSection,
  InvestmentAccount,
  InvestmentTransaction,
  Profile,
  Transaction,
} from '../types'
import { useSession } from './useSession'

export function useTransactions() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['transactions', session?.user.id],
    queryFn: fetchTransactions,
    enabled: Boolean(session),
  })
}

export function useCategories() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['categories', session?.user.id],
    queryFn: fetchCategories,
    enabled: Boolean(session),
  })
}

export function useProfile() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: () => fetchProfile(session!.user.id),
    enabled: Boolean(session),
  })
}

export function useUpdateProfile() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => updateProfile(session!.user.id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', session?.user.id] }),
  })
}

export function useSaveTransaction() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (t: Partial<Transaction> & { id: string }) => upsertTransaction(session!.user.id, t),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions', session?.user.id] }),
  })
}

export function useDeleteTransaction() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions', session?.user.id] }),
  })
}

export function useBudgetSections() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['budgetSections', session?.user.id],
    queryFn: fetchBudgetSections,
    enabled: Boolean(session),
  })
}

export function useBudgetLineItems() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['budgetLineItems', session?.user.id],
    queryFn: fetchBudgetLineItems,
    enabled: Boolean(session),
  })
}

export function useSaveBudgetSection() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (s: Partial<BudgetSection> & { id?: string }) => upsertBudgetSection(session!.user.id, s),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgetSections', session?.user.id] }),
  })
}

export function useDeleteBudgetSection() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBudgetSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgetSections', session?.user.id] })
      queryClient.invalidateQueries({ queryKey: ['budgetLineItems', session?.user.id] })
    },
  })
}

export function useSaveBudgetLineItem() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) =>
      upsertBudgetLineItem(session!.user.id, item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgetLineItems', session?.user.id] }),
  })
}

export function useDeleteBudgetLineItem() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBudgetLineItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgetLineItems', session?.user.id] }),
  })
}

export function useInvestmentAccounts() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['investmentAccounts', session?.user.id],
    queryFn: fetchInvestmentAccounts,
    enabled: Boolean(session),
  })
}

export function useSaveInvestmentAccount() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (a: Partial<InvestmentAccount> & { id: string }) => upsertInvestmentAccount(session!.user.id, a),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investmentAccounts', session?.user.id] }),
  })
}

export function useDeleteInvestmentAccount() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvestmentAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investmentAccounts', session?.user.id] })
      queryClient.invalidateQueries({ queryKey: ['investmentTransactions', session?.user.id] })
    },
  })
}

export function useInvestmentTransactions() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['investmentTransactions', session?.user.id],
    queryFn: fetchInvestmentTransactions,
    enabled: Boolean(session),
  })
}

export function useSaveInvestmentTransaction() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (t: Partial<InvestmentTransaction> & { id: string; accountId: string }) =>
      upsertInvestmentTransaction(session!.user.id, t),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investmentTransactions', session?.user.id] }),
  })
}

export function useDeleteInvestmentTransaction() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvestmentTransaction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investmentTransactions', session?.user.id] }),
  })
}

// Not user-scoped data (a symbol's price is the same for everyone), but still gated on
// being signed in since the table itself requires it.
export function useInvestmentPrices() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['investmentPrices', session?.user.id],
    queryFn: fetchInvestmentPrices,
    enabled: Boolean(session),
  })
}

export function useRefreshInvestmentPrices() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (symbols: { symbol: string; assetType: AssetType }[]) => refreshInvestmentPrices(symbols),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['investmentPrices', session?.user.id] }),
  })
}
