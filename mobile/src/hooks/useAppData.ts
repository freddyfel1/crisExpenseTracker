import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteTransaction, fetchBudgets, fetchCategories, fetchProfile, fetchTransactions, updateProfile, upsertTransaction } from '../data/api'
import type { Profile, Transaction } from '../types'
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

export function useBudgets() {
  const { session } = useSession()
  return useQuery({
    queryKey: ['budgets', session?.user.id],
    queryFn: fetchBudgets,
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
