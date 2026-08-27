import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import {
  deleteBudgetLineItem,
  deleteBudgetSection,
  fetchBudgetLineItems,
  fetchBudgetSections,
  fetchProfile,
  updateProfile,
  upsertBudgetLineItem,
  upsertBudgetSection,
} from '../data/api'
import { useSession } from '../hooks/useSession'
import { Card } from '../components/Card'
import { StatCard } from '../components/StatCard'
import { formatMoney } from '../utils/format'
import type { BudgetLineItem, BudgetSection, Profile } from '../types'

export function Planner() {
  const { session } = useSession()
  const userId = session!.user.id
  const queryClient = useQueryClient()

  const profileQuery = useQuery({ queryKey: ['profile', userId], queryFn: () => fetchProfile(userId) })
  const sectionsQuery = useQuery({ queryKey: ['budgetSections', userId], queryFn: fetchBudgetSections })
  const itemsQuery = useQuery({ queryKey: ['budgetLineItems', userId], queryFn: fetchBudgetLineItems })

  const saveProfile = useMutation({
    mutationFn: (patch: Partial<Profile>) => updateProfile(userId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
  })

  const invalidateSections = () => queryClient.invalidateQueries({ queryKey: ['budgetSections', userId] })
  const saveSection = useMutation({
    mutationFn: (s: BudgetSection) => upsertBudgetSection(userId, s),
    onSuccess: invalidateSections,
  })
  const removeSection = useMutation({
    mutationFn: (id: string) => deleteBudgetSection(id),
    onSuccess: invalidateSections,
  })

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: ['budgetLineItems', userId] })
  const saveItem = useMutation({
    mutationFn: (i: BudgetLineItem) => upsertBudgetLineItem(userId, i),
    onSuccess: invalidateItems,
  })
  const removeItem = useMutation({
    mutationFn: (id: string) => deleteBudgetLineItem(id),
    onSuccess: invalidateItems,
  })

  if (!profileQuery.data || !sectionsQuery.data || !itemsQuery.data) {
    return <div className="max-w-2xl text-[13px] text-[var(--text-soft)]">Loading…</div>
  }

  const profile = profileQuery.data
  const sections = [...sectionsQuery.data].sort((a, b) => a.sortOrder - b.sortOrder)
  const items = itemsQuery.data

  const totalPlanned = items.reduce((sum, i) => sum + i.monthlyAmount, 0)
  const leftover = profile.monthlyIncome - profile.monthlySavings - totalPlanned

  const addSection = () => {
    saveSection.mutate({ id: crypto.randomUUID(), name: 'New section', sortOrder: sections.length })
  }

  const addItem = (sectionId: string) => {
    const sortOrder = items.filter((i) => i.sectionId === sectionId).length
    saveItem.mutate({
      id: crypto.randomUUID(),
      sectionId,
      name: 'New item',
      monthlyAmount: 0,
      miscInfo: null,
      remarks: null,
      sortOrder,
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] text-[var(--ink)]">Budget Planner</h1>
        <p className="text-[13px] text-[var(--text-soft)]">Plan income, savings, and monthly expenses by section</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="mb-1.5 block text-[12px] uppercase tracking-wide text-[var(--text-soft)]">
            Monthly income
          </span>
          <input
            type="number"
            step="10"
            defaultValue={profile.monthlyIncome}
            onBlur={(e) => saveProfile.mutate({ monthlyIncome: Number(e.target.value) })}
            className="input font-mono"
          />
        </label>
        <label className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="mb-1.5 block text-[12px] uppercase tracking-wide text-[var(--text-soft)]">
            Savings goal
          </span>
          <input
            type="number"
            step="10"
            defaultValue={profile.monthlySavings}
            onBlur={(e) => saveProfile.mutate({ monthlySavings: Number(e.target.value) })}
            className="input font-mono"
          />
        </label>
        <StatCard label="Planned expenses" value={formatMoney(totalPlanned)} />
        <StatCard
          label="Leftover"
          value={formatMoney(leftover)}
          tone={leftover < 0 ? 'warn' : 'good'}
          sub={leftover < 0 ? 'Over your income + savings goal' : undefined}
        />
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const sectionItems = items
            .filter((i) => i.sectionId === section.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          const sectionTotal = sectionItems.reduce((sum, i) => sum + i.monthlyAmount, 0)

          return (
            <Card key={section.id}>
              <div className="mb-3 flex items-center gap-3">
                <input
                  defaultValue={section.name}
                  onBlur={(e) => {
                    if (e.target.value.trim()) saveSection.mutate({ ...section, name: e.target.value })
                  }}
                  className="font-display min-w-0 flex-1 bg-transparent text-[16px] text-[var(--ink)] outline-none"
                />
                <span className="font-mono text-[13px] text-[var(--text-soft)]">{formatMoney(sectionTotal)}</span>
                <button
                  onClick={() => removeSection.mutate(section.id)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--warn)] hover:bg-[var(--warn-soft)]"
                  aria-label="Delete section"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
                      <th className="w-2/5 py-1.5 pr-2 font-medium">Item</th>
                      <th className="py-1.5 pr-2 font-medium">Monthly</th>
                      <th className="py-1.5 pr-2 font-medium">Misc info</th>
                      <th className="py-1.5 pr-2 font-medium">Remarks</th>
                      <th className="w-8 py-1.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {sectionItems.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border-soft)]">
                        <td className="py-1.5 pr-2">
                          <input
                            defaultValue={item.name}
                            onBlur={(e) => {
                              if (e.target.value.trim()) saveItem.mutate({ ...item, name: e.target.value })
                            }}
                            className="input py-1.5"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            step="10"
                            defaultValue={item.monthlyAmount}
                            onBlur={(e) => saveItem.mutate({ ...item, monthlyAmount: Number(e.target.value) })}
                            className="input py-1.5 font-mono"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            defaultValue={item.miscInfo ?? ''}
                            onBlur={(e) => saveItem.mutate({ ...item, miscInfo: e.target.value || null })}
                            className="input py-1.5"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            defaultValue={item.remarks ?? ''}
                            onBlur={(e) => saveItem.mutate({ ...item, remarks: e.target.value || null })}
                            className="input py-1.5"
                          />
                        </td>
                        <td className="py-1.5">
                          <button
                            onClick={() => removeItem.mutate(item.id)}
                            className="grid h-8 w-8 place-items-center rounded-md text-[var(--warn)] hover:bg-[var(--warn-soft)]"
                            aria-label="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sectionItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-3 text-center text-[var(--text-soft)]">
                          No items in this section yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => addItem(section.id)}
                className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--primary)]"
              >
                <Plus size={14} /> Add item
              </button>
            </Card>
          )
        })}
      </div>

      <button
        onClick={addSection}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
      >
        <Plus size={15} /> Add section
      </button>
    </div>
  )
}
