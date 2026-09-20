import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, GripVertical, Plus, Search, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { usePeriod } from '../data/period'
import { budgetStatsForMonth, groupBudgetItemsBySection, monthsUpTo } from '../data/selectors'
import { firstName, formatMoney, monthKeyLabel } from '../utils/format'
import { Card } from '../components/Card'
import { MonthPicker } from '../components/MonthPicker'
import type { BudgetLineItem, BudgetSection } from '../types'

const monthLabelShort = (key: string): string => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

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
    profile,
  } = useStore()
  const { month } = usePeriod()
  const userFirstName = firstName(profile?.name)
  const exportBrand = userFirstName ? `${userFirstName}'s Budget Planner Plus` : 'Budget Planner Plus'

  const [query, setQuery] = useState('')

  const monthSections = useMemo(
    () => budgetSections.filter((s) => s.monthKey === month).sort((a, b) => a.sortOrder - b.sortOrder),
    [budgetSections, month],
  )
  const itemsBySection = useMemo(() => groupBudgetItemsBySection(budgetLineItems), [budgetLineItems])

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

  const { income, expenses, savings, difference, balance } = budgetStatsForMonth(
    month,
    budgetSections,
    itemsBySection,
    monthlyIncomes,
  )

  const [isExportingMonth, setIsExportingMonth] = useState(false)
  const [isExportingYtd, setIsExportingYtd] = useState(false)

  // Every section for the open month with its line items, unfiltered by the search box —
  // the PDF is a full record of the plan, not just what's currently visible on screen.
  const monthSectionsForExport = useMemo(
    () =>
      monthSections.map((section) => ({
        section,
        items: (itemsBySection.get(section.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      })),
    [monthSections, itemsBySection],
  )

  const exportMonthPdf = async () => {
    setIsExportingMonth(true)
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const margin = 40
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Fixed so the section header's name/total line lands directly above the
      // matching Name/Monthly columns in the table below it, instead of the
      // total drifting to the page edge while the table stays narrower.
      const tableWidth = pageWidth - margin * 2
      const nameColWidth = tableWidth * 0.3
      const monthlyColWidth = 65
      const yearlyColWidth = 70
      const miscColWidth = tableWidth * 0.16
      const remarksColWidth = tableWidth - nameColWidth - monthlyColWidth - yearlyColWidth - miscColWidth
      const monthlyColRight = margin + nameColWidth + monthlyColWidth
      const yearlyColRight = monthlyColRight + yearlyColWidth

      doc.setFontSize(18)
      doc.text(exportBrand, margin, 48)
      doc.setFontSize(12)
      doc.setTextColor(110)
      doc.text(`Budget Planner — ${monthKeyLabel(month)}`, margin, 68)

      doc.setFontSize(11)
      doc.setTextColor(20)
      doc.text(
        `Income ${formatMoney(income)}   Expenses ${formatMoney(expenses)}   Savings ${formatMoney(savings)}   Balance ${formatMoney(balance)}`,
        margin,
        88,
      )

      let y = 106
      for (const { section, items } of monthSectionsForExport) {
        if (y > pageHeight - 100) {
          doc.addPage()
          y = margin
        }
        const sectionTotal = items.reduce((sum, i) => sum + i.monthlyAmount, 0)
        doc.setFontSize(12)
        doc.setTextColor(20)
        doc.text(section.name, margin, y)
        // Smaller font for the totals so they fit within the same column widths as
        // the table below — at the section name's larger size they overflow into
        // the neighboring column and collide.
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text(formatMoney(sectionTotal), monthlyColRight, y, { align: 'right' })
        doc.text(formatMoney(sectionTotal * 12), yearlyColRight, y, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        y += 8

        if (items.length > 0) {
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Name', 'Monthly', 'Yearly', 'Misc info', 'Remarks']],
            body: items.map((i) => [
              i.name,
              formatMoney(i.monthlyAmount),
              formatMoney(i.monthlyAmount * 12),
              i.miscInfo ?? '',
              i.remarks ?? '',
            ]),
            theme: 'plain',
            headStyles: { fillColor: [31, 41, 55], textColor: 255 },
            styles: { fontSize: 9, lineWidth: { bottom: 0.5 }, lineColor: [210, 210, 210] },
            columnStyles: {
              0: { cellWidth: nameColWidth },
              1: { cellWidth: monthlyColWidth, halign: 'right' },
              2: { cellWidth: yearlyColWidth, halign: 'right' },
              3: { cellWidth: miscColWidth },
              4: { cellWidth: remarksColWidth },
            },
            // columnStyles.halign only reaches body cells in this autoTable version —
            // header cells stay left-positioned, so force it per cell regardless of section.
            didParseCell: (data) => {
              if (data.column.index === 1 || data.column.index === 2) data.cell.styles.halign = 'right'
            },
          })
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
        } else {
          doc.setFontSize(10)
          doc.setTextColor(140)
          doc.text('No line items.', margin, y + 14)
          y += 30
        }
      }

      doc.save(`BudgetPlannerPlus_budget_${month}.pdf`)
    } finally {
      setIsExportingMonth(false)
    }
  }

  // Sums the same per-month stats used above across every month from January through the
  // one currently open, so switching months changes how far the year-to-date total reaches
  // — the same convention the Transactions page's own YTD stats already use.
  const exportYtdPdf = async () => {
    setIsExportingYtd(true)
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const margin = 40

      const year = month.slice(0, 4)
      const cutoffMonth = Number(month.slice(5, 7))
      const ytdMonths = monthsUpTo(year, cutoffMonth)
      const monthStats = ytdMonths.map((m) => ({
        month: m,
        ...budgetStatsForMonth(m, budgetSections, itemsBySection, monthlyIncomes),
      }))
      const totals = monthStats.reduce(
        (acc, s) => ({
          income: acc.income + s.income,
          expenses: acc.expenses + s.expenses,
          savings: acc.savings + s.savings,
          balance: acc.balance + s.balance,
        }),
        { income: 0, expenses: 0, savings: 0, balance: 0 },
      )

      doc.setFontSize(18)
      doc.text(exportBrand, margin, 48)
      doc.setFontSize(12)
      doc.setTextColor(110)
      doc.text(`Budget Planner — year to date, Jan–${monthLabelShort(month).split(' ')[0]} ${year}`, margin, 68)

      autoTable(doc, {
        startY: 90,
        margin: { left: margin, right: margin },
        head: [['Month', 'Income', 'Expenses', 'Savings', 'Balance']],
        body: [
          ...monthStats.map((s) => [
            monthLabelShort(s.month),
            formatMoney(s.income),
            formatMoney(s.expenses),
            formatMoney(s.savings),
            formatMoney(s.balance),
          ]),
          ['Total', formatMoney(totals.income), formatMoney(totals.expenses), formatMoney(totals.savings), formatMoney(totals.balance)],
        ],
        headStyles: { fillColor: [31, 41, 55] },
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        // columnStyles.halign only reaches body cells in this autoTable version —
        // header cells stay left-positioned, so force it per cell regardless of section.
        didParseCell: (data) => {
          if (data.column.index >= 1) data.cell.styles.halign = 'right'
          if (data.row.index === monthStats.length && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      doc.save(`BudgetPlannerPlus_budget_ytd_${year}.pdf`)
    } finally {
      setIsExportingYtd(false)
    }
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker />
          <button
            onClick={exportMonthPdf}
            disabled={isExportingMonth}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)] disabled:opacity-60"
          >
            <FileText size={15} /> {isExportingMonth ? 'Preparing…' : 'Export month PDF'}
          </button>
          <button
            onClick={exportYtdPdf}
            disabled={isExportingYtd}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)] disabled:opacity-60"
          >
            <FileText size={15} /> {isExportingYtd ? 'Preparing…' : 'Export year to date'}
          </button>
        </div>
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
