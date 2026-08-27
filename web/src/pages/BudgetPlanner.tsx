import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { formatMoney } from '../utils/format'
import { Card } from '../components/Card'
import type { BudgetLineItem, BudgetSection } from '../types'

export function BudgetPlanner() {
  const {
    profile,
    budgetSections,
    budgetLineItems,
    updateProfile,
    addBudgetSection,
    deleteBudgetSection,
    saveBudgetLineItem,
    deleteBudgetLineItem,
  } = useStore()

  const income = profile?.monthlyIncome ?? 0
  const savings = profile?.monthlySavings ?? 0
  const expenses = budgetLineItems.reduce((sum, i) => sum + i.monthlyAmount, 0)
  const difference = income - expenses
  const balance = difference - savings

  const sections = [...budgetSections].sort((a, b) => a.sortOrder - b.sortOrder)
  const itemsBySection = new Map<string, BudgetLineItem[]>()
  for (const item of budgetLineItems) {
    const list = itemsBySection.get(item.sectionId) ?? []
    list.push(item)
    itemsBySection.set(item.sectionId, list)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] text-[var(--ink)]">Budget Planner</h1>
        <p className="text-[13px] text-[var(--text-soft)]">
          A planned monthly budget, organized into sections and line items — like a spreadsheet.
        </p>
      </div>

      <Card title="Summary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <SummaryStat label="Income" value={income} onSave={(v) => updateProfile({ monthlyIncome: v })} editable />
          <SummaryStat label="Expenses" value={expenses} />
          <SummaryStat label="Difference" value={difference} tone={difference < 0 ? 'warn' : 'good'} />
          <SummaryStat label="Savings" value={savings} onSave={(v) => updateProfile({ monthlySavings: v })} editable />
          <SummaryStat label="Balance" value={balance} tone={balance < 0 ? 'warn' : 'good'} />
        </div>
      </Card>

      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          items={(itemsBySection.get(section.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)}
          onAddItem={() =>
            saveBudgetLineItem({
              sectionId: section.id,
              name: 'New item',
              monthlyAmount: 0,
              sortOrder: (itemsBySection.get(section.id) ?? []).length,
            })
          }
          onDeleteItem={deleteBudgetLineItem}
          onSaveItem={saveBudgetLineItem}
          onRenameSection={(name) => addBudgetSection({ id: section.id, name, sortOrder: section.sortOrder })}
          onDeleteSection={() => {
            if (window.confirm(`Delete "${section.name}" and all its line items? This cannot be undone.`)) {
              deleteBudgetSection(section.id)
            }
          }}
        />
      ))}

      <button
        onClick={() => addBudgetSection({ name: 'New section', sortOrder: sections.length })}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-soft)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
      >
        <Plus size={15} /> Add section
      </button>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  tone = 'default',
  editable = false,
  onSave,
}: {
  label: string
  value: number
  tone?: 'default' | 'warn' | 'good'
  editable?: boolean
  onSave?: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const toneClass = tone === 'warn' ? 'text-[var(--warn)]' : tone === 'good' ? 'text-[var(--primary)]' : 'text-[var(--ink)]'

  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isNaN(parsed)) onSave?.(parsed)
    setEditing(false)
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">{label}</p>
      {editable && editing ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="font-display mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-1.5 py-0.5 text-[19px] leading-none text-[var(--ink)]"
        />
      ) : (
        <p
          className={`font-display mt-1 text-[19px] leading-none ${toneClass} ${editable ? 'cursor-pointer' : ''}`}
          onClick={
            editable
              ? () => {
                  setDraft(String(value))
                  setEditing(true)
                }
              : undefined
          }
        >
          {formatMoney(value)}
        </p>
      )}
    </div>
  )
}

function SectionCard({
  section,
  items,
  onAddItem,
  onDeleteItem,
  onSaveItem,
  onRenameSection,
  onDeleteSection,
}: {
  section: BudgetSection
  items: BudgetLineItem[]
  onAddItem: () => void
  onDeleteItem: (id: string) => void
  onSaveItem: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) => void
  onRenameSection: (name: string) => void
  onDeleteSection: () => void
}) {
  const total = items.reduce((sum, i) => sum + i.monthlyAmount, 0)

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          defaultValue={section.name}
          onBlur={(e) => e.target.value.trim() && onRenameSection(e.target.value.trim())}
          className="flex-1 bg-transparent text-[14px] font-semibold uppercase tracking-wide text-[var(--ink)] outline-none focus:border-b focus:border-[var(--border)]"
        />
        <span className="font-mono text-[13px] text-[var(--text-soft)]">{formatMoney(total)}/mo</span>
        <button onClick={onDeleteSection} className="text-[var(--text-soft)] hover:text-[var(--warn)]">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <LineItemRow key={item.id} item={item} onSave={onSaveItem} onDelete={() => onDeleteItem(item.id)} />
        ))}
        {items.length === 0 && <p className="text-[12.5px] text-[var(--text-soft)]">No line items yet.</p>}
      </div>

      <button
        onClick={onAddItem}
        className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--primary)] hover:underline"
      >
        <Plus size={14} /> Add line item
      </button>
    </Card>
  )
}

function LineItemRow({
  item,
  onSave,
  onDelete,
}: {
  item: BudgetLineItem
  onSave: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) => void
  onDelete: () => void
}) {
  return (
    <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr_1fr_auto] items-center gap-2 rounded-lg border border-[var(--border-soft)] p-2">
      <input
        defaultValue={item.name}
        placeholder="Name"
        onBlur={(e) => onSave({ ...item, name: e.target.value })}
        className="input py-1 text-[13px]"
      />
      <input
        defaultValue={item.monthlyAmount}
        type="text"
        inputMode="decimal"
        placeholder="Monthly"
        onBlur={(e) => onSave({ ...item, monthlyAmount: Number(e.target.value) || 0 })}
        className="input py-1 text-[13px] font-mono"
      />
      <p className="text-[12.5px] text-[var(--text-soft)]" title="Yearly (monthly x 12)">
        {formatMoney(item.monthlyAmount * 12)}/yr
      </p>
      <input
        defaultValue={item.miscInfo ?? ''}
        placeholder="Misc info"
        onBlur={(e) => onSave({ ...item, miscInfo: e.target.value || null })}
        className="input py-1 text-[13px]"
      />
      <input
        defaultValue={item.remarks ?? ''}
        placeholder="Remarks"
        onBlur={(e) => onSave({ ...item, remarks: e.target.value || null })}
        className="input py-1 text-[13px]"
      />
      <button onClick={onDelete} className="text-[var(--text-soft)] hover:text-[var(--warn)]">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
