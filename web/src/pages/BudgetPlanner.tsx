import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical, Plus, Search, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { usePeriod } from '../data/period'
import { monthlyIncomeEntryForMonth } from '../data/selectors'
import { formatMoney } from '../utils/format'
import { Card } from '../components/Card'
import { MonthPicker } from '../components/MonthPicker'
import type { BudgetLineItem, BudgetSection } from '../types'

export function BudgetPlanner() {
  const {
    monthlyIncomes,
    budgetSections,
    budgetLineItems,
    addBudgetSection,
    deleteBudgetSection,
    saveBudgetLineItem,
    deleteBudgetLineItem,
    duplicateBudgetMonth,
    isDuplicatingBudgetMonth,
  } = useStore()
  const { month } = usePeriod()

  const [query, setQuery] = useState('')

  const monthSections = useMemo(
    () => budgetSections.filter((s) => s.monthKey === month).sort((a, b) => a.sortOrder - b.sortOrder),
    [budgetSections, month],
  )
  const itemsBySection = useMemo(() => {
    const map = new Map<string, BudgetLineItem[]>()
    for (const item of budgetLineItems) {
      const list = map.get(item.sectionId) ?? []
      list.push(item)
      map.set(item.sectionId, list)
    }
    return map
  }, [budgetLineItems])

  // The first time a month with no plan yet is opened, carry the nearest
  // month's sections/line items forward so the user edits amounts rather
  // than rebuilding the whole spreadsheet from scratch.
  const duplicateRequestedFor = useRef<string | null>(null)
  useEffect(() => {
    if (monthSections.length > 0 || duplicateRequestedFor.current === month) return
    const monthsWithData = Array.from(new Set(budgetSections.map((s) => s.monthKey))).sort()
    const sourceMonth = [...monthsWithData].reverse().find((m) => m < month) ?? monthsWithData.find((m) => m > month)
    if (!sourceMonth) return
    duplicateRequestedFor.current = month
    const sourceSections = budgetSections.filter((s) => s.monthKey === sourceMonth)
    duplicateBudgetMonth(sourceSections, itemsBySection, month)
  }, [month, budgetSections, monthSections.length, itemsBySection, duplicateBudgetMonth])

  const { monthlyIncome, otherIncome } = monthlyIncomeEntryForMonth(monthlyIncomes, month)
  const income = monthlyIncome + otherIncome
  const savingsSection = monthSections.find((s) => s.name.toLowerCase().includes('saving'))
  const savings = (itemsBySection.get(savingsSection?.id ?? '') ?? []).reduce((sum, i) => sum + i.monthlyAmount, 0)
  const expenses = monthSections
    .filter((s) => s.id !== savingsSection?.id)
    .reduce((sum, s) => sum + (itemsBySection.get(s.id) ?? []).reduce((a, i) => a + i.monthlyAmount, 0), 0)
  const difference = income - expenses
  const balance = difference - savings

  const q = query.trim().toLowerCase()
  const matchesQuery = (item: BudgetLineItem) =>
    !q ||
    item.name.toLowerCase().includes(q) ||
    (item.miscInfo ?? '').toLowerCase().includes(q) ||
    (item.remarks ?? '').toLowerCase().includes(q)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const moveSection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    const ids = monthSections.map((s) => s.id)
    const from = ids.indexOf(sourceId)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    const reordered = [...ids]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    reordered.forEach((id, index) => {
      const section = monthSections.find((s) => s.id === id)
      if (section && section.sortOrder !== index) {
        addBudgetSection({ id: section.id, name: section.name, sortOrder: index, monthKey: section.monthKey })
      }
    })
  }

  const visibleSections = monthSections
    .map((section) => {
      const items = (itemsBySection.get(section.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
      const visibleItems = q ? items.filter(matchesQuery) : items
      return { section, items, visibleItems }
    })
    .filter(({ visibleItems }) => !q || visibleItems.length > 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Budget Planner</h1>
          <p className="text-[13px] text-[var(--text-soft)]">
            A planned monthly budget, organized into sections and line items — like a spreadsheet.
          </p>
        </div>
        <MonthPicker />
      </div>

      <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <Search size={15} className="text-[var(--text-soft)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search line items, misc info, remarks..."
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--text-soft)]"
        />
      </div>

      <Card title="Summary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <SummaryStat label="Total income" value={income} />
          <SummaryStat label="Expenses" value={expenses} />
          <SummaryStat label="Difference" value={difference} tone={difference < 0 ? 'warn' : 'good'} />
          <SummaryStat label="Savings" value={savings} />
          <SummaryStat label="Balance" value={balance} tone={balance < 0 ? 'warn' : 'good'} />
        </div>
      </Card>

      {isDuplicatingBudgetMonth && (
        <p className="text-[12.5px] text-[var(--text-soft)]">Copying last month's plan into this month…</p>
      )}

      {visibleSections.map(({ section, visibleItems, items }) => (
        <SectionCard
          key={section.id}
          section={section}
          items={visibleItems}
          isEmptySection={items.length === 0}
          total={items.reduce((sum, i) => sum + i.monthlyAmount, 0)}
          onAddItem={() =>
            saveBudgetLineItem({
              sectionId: section.id,
              name: 'New item',
              monthlyAmount: 0,
              sortOrder: items.length,
            })
          }
          onDeleteItem={deleteBudgetLineItem}
          onSaveItem={saveBudgetLineItem}
          onRenameSection={(name) =>
            addBudgetSection({ id: section.id, name, sortOrder: section.sortOrder, monthKey: section.monthKey })
          }
          onDeleteSection={() => {
            if (window.confirm(`Delete "${section.name}" and all its line items? This cannot be undone.`)) {
              deleteBudgetSection(section.id)
            }
          }}
          isDragging={draggingId === section.id}
          isDragOver={dragOverId === section.id && draggingId !== null && draggingId !== section.id}
          onHandleDragStart={() => setDraggingId(section.id)}
          onCardDragEnter={() => draggingId && setDragOverId(section.id)}
          onCardDragEnd={() => {
            setDraggingId(null)
            setDragOverId(null)
          }}
          onCardDrop={() => {
            if (draggingId) moveSection(draggingId, section.id)
            setDraggingId(null)
            setDragOverId(null)
          }}
        />
      ))}

      {q && visibleSections.length === 0 && (
        <p className="text-[13px] text-[var(--text-soft)]">No line items match your search.</p>
      )}

      <button
        onClick={() => addBudgetSection({ name: 'New section', sortOrder: monthSections.length, monthKey: month })}
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
  isEmptySection,
  total,
  onAddItem,
  onDeleteItem,
  onSaveItem,
  onRenameSection,
  onDeleteSection,
  isDragging,
  isDragOver,
  onHandleDragStart,
  onCardDragEnter,
  onCardDragEnd,
  onCardDrop,
}: {
  section: BudgetSection
  items: BudgetLineItem[]
  isEmptySection: boolean
  total: number
  onAddItem: () => void
  onDeleteItem: (id: string) => void
  onSaveItem: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) => void
  onRenameSection: (name: string) => void
  onDeleteSection: () => void
  isDragging: boolean
  isDragOver: boolean
  onHandleDragStart: () => void
  onCardDragEnter: () => void
  onCardDragEnd: () => void
  onCardDrop: () => void
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onCardDragEnter}
      onDrop={(e) => {
        e.preventDefault()
        onCardDrop()
      }}
      className={`rounded-xl transition-opacity ${isDragging ? 'opacity-40' : ''} ${
        isDragOver ? 'ring-2 ring-[var(--primary)]' : ''
      }`}
    >
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <span
              draggable
              onDragStart={onHandleDragStart}
              onDragEnd={onCardDragEnd}
              className="cursor-grab text-[var(--text-soft)] hover:text-[var(--ink)] active:cursor-grabbing"
              title="Drag to reorder section"
            >
              <GripVertical size={15} />
            </span>
            <input
              defaultValue={section.name}
              onBlur={(e) => e.target.value.trim() && onRenameSection(e.target.value.trim())}
              className="flex-1 bg-transparent text-[14px] font-semibold uppercase tracking-wide text-[var(--ink)] outline-none focus:border-b focus:border-[var(--border)]"
            />
          </div>
          <span className="font-mono text-[13px] text-[var(--text-soft)]">{formatMoney(total)}/mo</span>
          <button onClick={onDeleteSection} className="text-[var(--text-soft)] hover:text-[var(--warn)]">
            <Trash2 size={15} />
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <LineItemRow key={item.id} item={item} onSave={onSaveItem} onDelete={() => onDeleteItem(item.id)} />
          ))}
          {isEmptySection && <p className="text-[12.5px] text-[var(--text-soft)]">No line items yet.</p>}
        </div>

        {items.length > 0 && (
          <div className="mt-2 grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr_1fr_auto] items-center gap-2 border-t border-[var(--border)] p-2">
            <p className="text-[13px] font-semibold text-[var(--ink)]">Total</p>
            <p className="font-mono text-[13px] font-semibold text-[var(--ink)]">{formatMoney(total)}</p>
            <p className="text-[12.5px] text-[var(--text-soft)]">{formatMoney(total * 12)}/yr</p>
          </div>
        )}

        <button
          onClick={onAddItem}
          className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--primary)] hover:underline"
        >
          <Plus size={14} /> Add line item
        </button>
      </Card>
    </div>
  )
}

const LINE_ITEM_COLUMNS = ['Name', 'Monthly', 'Misc info', 'Remarks'] as const

/** On Enter: move across the remaining fields in the row first; at the last field, drop to the next row's first field. */
function focusNextCell(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const row = e.currentTarget.closest<HTMLElement>('[data-line-item-row]')
  const container = row?.parentElement
  if (!row || !container) return

  const colIndex = LINE_ITEM_COLUMNS.indexOf(e.currentTarget.placeholder as (typeof LINE_ITEM_COLUMNS)[number])

  let targetRow: HTMLElement | undefined = row
  let targetCol = LINE_ITEM_COLUMNS[colIndex + 1]
  if (!targetCol) {
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-line-item-row]'))
    targetRow = rows[rows.indexOf(row) + 1]
    targetCol = LINE_ITEM_COLUMNS[0]
  }
  if (!targetRow) return

  const next = targetRow.querySelector<HTMLInputElement>(`input[placeholder="${targetCol}"]`)
  next?.focus()
  next?.select()
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
    <div
      data-line-item-row
      className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr_1fr_auto] items-center gap-2 rounded-lg border border-[var(--border-soft)] p-2"
    >
      <input
        defaultValue={item.name}
        placeholder="Name"
        onBlur={(e) => onSave({ ...item, name: e.target.value })}
        onKeyDown={focusNextCell}
        className="input py-1 text-[13px]"
      />
      <input
        defaultValue={formatMoney(item.monthlyAmount)}
        type="text"
        inputMode="decimal"
        placeholder="Monthly"
        onFocus={(e) => {
          e.target.value = item.monthlyAmount === 0 ? '' : String(item.monthlyAmount)
          e.target.select()
        }}
        onBlur={(e) => {
          const parsed = Number(e.target.value.replace(/[^0-9.-]/g, '')) || 0
          onSave({ ...item, monthlyAmount: parsed })
          e.target.value = formatMoney(parsed)
        }}
        onKeyDown={focusNextCell}
        className="input py-1 text-[13px] font-mono"
      />
      <p className="text-[12.5px] text-[var(--text-soft)]" title="Yearly (monthly x 12)">
        {formatMoney(item.monthlyAmount * 12)}/yr
      </p>
      <input
        defaultValue={item.miscInfo ?? ''}
        placeholder="Misc info"
        onBlur={(e) => onSave({ ...item, miscInfo: e.target.value || null })}
        onKeyDown={focusNextCell}
        className="input py-1 text-[13px]"
      />
      <input
        defaultValue={item.remarks ?? ''}
        placeholder="Remarks"
        onBlur={(e) => onSave({ ...item, remarks: e.target.value || null })}
        onKeyDown={focusNextCell}
        className="input py-1 text-[13px]"
      />
      <button onClick={onDelete} className="text-[var(--text-soft)] hover:text-[var(--warn)]">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
