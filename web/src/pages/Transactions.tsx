import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowUpDown, ChevronDown, Plus, Search, PiggyBank, Wallet, Scale, Landmark, Upload } from 'lucide-react'
import { useStore } from '../data/store'
import {
  currentCalendarMonth,
  incomeForMonth,
  monthlyIncomeEntryForMonth,
  monthsUpTo,
  totalIncomeForMonths,
} from '../data/selectors'
import { resolveCategory } from '../utils/resolveCategory'
import { formatDate, formatMoney, monthKey, monthKeyLabel } from '../utils/format'
import { ReceiptThumb } from '../components/ReceiptThumb'
import { CategoryIcon } from '../components/CategoryIcon'
import { TransactionDrawer } from '../components/TransactionDrawer'
import { CaptureReceiptButton } from '../components/CaptureReceiptButton'
import { StatCard } from '../components/StatCard'
import type { MonthlyIncome } from '../types'

type SortKey = 'date' | 'amount' | 'merchant'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function Transactions() {
  const { transactions, categories, monthlyIncomes, saveMonthlyIncome } = useStore()
  const navigate = useNavigate()
  const { id } = useParams()

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  // Defaults to the current month/year so the page opens already scoped to
  // "now" instead of every transaction ever recorded.
  const [yearFilter, setYearFilter] = useState(() => String(new Date().getFullYear()))
  const [monthFilter, setMonthFilter] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const currentYear = String(new Date().getFullYear())

  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.date).slice(0, 4)))
    monthlyIncomes.forEach((e) => set.add(e.monthKey.slice(0, 4)))
    set.add(currentYear)
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [transactions, monthlyIncomes, currentYear])

  // Category/search narrow both the table and the summary stats. Year/month
  // narrow the table to an exact match, but drive the summary stats as a
  // year-to-date cutoff instead: picking a year sums Jan through that
  // year's selected month (or through the current real month when "All
  // months" is picked); picking "All years" sums that same Jan-through-X
  // range across every year with data.
  const searchFiltered = useMemo(() => {
    let rows = transactions
    if (categoryFilter !== 'all') rows = rows.filter((t) => t.categoryId === categoryFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }
    return rows
  }, [transactions, categoryFilter, query])

  const filtered = useMemo(() => {
    let rows = searchFiltered
    if (yearFilter !== 'all') rows = rows.filter((t) => monthKey(t.date).slice(0, 4) === yearFilter)
    if (monthFilter !== 'all') rows = rows.filter((t) => monthKey(t.date).slice(5, 7) === monthFilter)
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortKey === 'amount') cmp = a.amount - b.amount
      else cmp = a.merchant.localeCompare(b.merchant)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [searchFiltered, yearFilter, monthFilter, sortKey, sortDir])

  // Cutoff month for the summary stats: the picked month, or the current
  // real-world month when "All months" is selected.
  const cutoffMonth = monthFilter === 'all' ? currentCalendarMonth() : Number(monthFilter)

  // Months covered by the summary stats: Jan through cutoffMonth, for the
  // selected year, or every year with data when "All years" is picked.
  const statMonths = useMemo(() => {
    const relevantYears = yearFilter === 'all' ? years : [yearFilter]
    return relevantYears.flatMap((y) => monthsUpTo(y, cutoffMonth))
  }, [yearFilter, years, cutoffMonth])

  // Single-month figures shown above the year-to-date stats: whichever month
  // is picked in the filters, or the current real-world month when "All
  // months" is selected (mirrors the cutoffMonth default below).
  const singleMonthKey = useMemo(() => {
    const y = yearFilter === 'all' ? currentYear : yearFilter
    const m = monthFilter === 'all' ? currentCalendarMonth() : Number(monthFilter)
    return `${y}-${String(m).padStart(2, '0')}`
  }, [yearFilter, monthFilter, currentYear])
  const monthIncome = useMemo(() => incomeForMonth(monthlyIncomes, singleMonthKey), [monthlyIncomes, singleMonthKey])
  const monthExpense = useMemo(
    () => searchFiltered.filter((t) => monthKey(t.date) === singleMonthKey).reduce((sum, t) => sum + t.amount, 0),
    [searchFiltered, singleMonthKey],
  )
  const monthBalance = monthIncome - monthExpense

  const totalIncome = useMemo(() => totalIncomeForMonths(monthlyIncomes, statMonths), [monthlyIncomes, statMonths])
  const totalExpense = useMemo(() => {
    const monthSet = new Set(statMonths)
    return searchFiltered.filter((t) => monthSet.has(monthKey(t.date))).reduce((sum, t) => sum + t.amount, 0)
  }, [searchFiltered, statMonths])
  const balance = totalIncome - totalExpense

  const periodLabel = useMemo(() => {
    const cutoffLabel = MONTH_NAMES[cutoffMonth - 1].slice(0, 3)
    return yearFilter === 'all' ? `Jan–${cutoffLabel}, all years` : `Jan–${cutoffLabel} ${yearFilter}`
  }, [yearFilter, cutoffMonth])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Transactions</h1>
          <p className="text-[13px] text-[var(--text-soft)]">{filtered.length} transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <CaptureReceiptButton />
          <button
            onClick={() => navigate('/transactions/upload-docs')}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
          >
            <Upload size={15} /> Upload docs
          </button>
          <button
            onClick={() => navigate('/transactions/new')}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            <Plus size={15} /> Add transaction
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <Search size={15} className="text-[var(--text-soft)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search merchant, notes, tags..."
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--text-soft)]"
          />
        </div>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)]"
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)]"
        >
          <option value="all">All months</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={String(i + 1).padStart(2, '0')}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)]"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Income"
          value={formatMoney(monthIncome)}
          sub={monthKeyLabel(singleMonthKey)}
          icon={<Landmark size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Expense"
          value={formatMoney(monthExpense)}
          sub={monthKeyLabel(singleMonthKey)}
          icon={<Wallet size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Balance"
          value={formatMoney(monthBalance)}
          sub="income minus expense"
          tone={monthBalance < 0 ? 'warn' : 'good'}
          icon={<Scale size={16} className="text-[var(--text-soft)]" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <IncomeBreakdownCard
          months={statMonths}
          monthlyIncomes={monthlyIncomes}
          total={totalIncome}
          periodLabel={periodLabel}
          onSave={(monthKeyToSave, monthlyIncomeVal, otherIncomeVal) =>
            saveMonthlyIncome({ monthKey: monthKeyToSave, monthlyIncome: monthlyIncomeVal, otherIncome: otherIncomeVal })
          }
        />
        <StatCard
          label="Total expense"
          value={formatMoney(totalExpense)}
          sub={periodLabel}
          icon={<Wallet size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Balance"
          value={formatMoney(balance)}
          sub="income minus expense"
          tone={balance < 0 ? 'warn' : 'good'}
          icon={<Scale size={16} className="text-[var(--text-soft)]" />}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-soft)] text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
              <th className="px-4 py-3 font-medium">
                <SortButton label="Merchant" active={sortKey === 'merchant'} dir={sortDir} onClick={() => toggleSort('merchant')} />
              </th>
              <th className="px-4 py-3 font-medium">
                <SortButton label="Date" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
              </th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium text-right">
                <SortButton label="Amount" active={sortKey === 'amount'} dir={sortDir} onClick={() => toggleSort('amount')} align="right" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((t) => {
              const category = resolveCategory(categories, t.categoryId)
              return (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/transactions/${t.id}`)}
                  className="cursor-pointer border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--paper)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ReceiptThumb color={category.color} />
                      <span className="font-medium text-[var(--ink)]">{t.merchant}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-soft)]">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]"
                      style={{ background: `${category.color}14`, color: category.color }}
                    >
                      <CategoryIcon name={category.icon} size={12} />
                      {category.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-[var(--ink)]">
                    {formatMoney(t.amount)}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--text-soft)]">
                  No transactions match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {id && <TransactionDrawer id={id} onClose={() => navigate('/transactions')} />}
    </div>
  )
}

function IncomeBreakdownCard({
  months,
  monthlyIncomes,
  total,
  periodLabel,
  onSave,
}: {
  months: string[]
  monthlyIncomes: MonthlyIncome[]
  total: number
  periodLabel: string
  onSave: (monthKey: string, monthlyIncome: number, otherIncome: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <p className="text-[12px] uppercase tracking-wide text-[var(--text-soft)]">Total income</p>
        <div className="flex items-center gap-2 text-[var(--text-soft)]">
          <PiggyBank size={16} />
          <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <p className="font-display mt-2 text-[30px] leading-none text-[var(--ink)]">{formatMoney(total)}</p>
      <p className="mt-1.5 text-[12.5px] text-[var(--text-soft)]">
        {expanded ? 'tap a month to edit' : periodLabel}
      </p>
      {expanded && (
        <div className="mt-3 max-h-64 space-y-0.5 overflow-y-auto border-t border-[var(--border-soft)] pt-3">
          {[...months].reverse().map((m) => (
            <IncomeMonthRow
              key={m}
              monthKey={m}
              entry={monthlyIncomes.find((e) => e.monthKey === m)}
              monthlyIncomes={monthlyIncomes}
              onSave={onSave}
            />
          ))}
          {months.length === 0 && (
            <p className="py-2 text-center text-[12.5px] text-[var(--text-soft)]">No months in range.</p>
          )}
        </div>
      )}
    </div>
  )
}

function IncomeMonthRow({
  monthKey: mKey,
  entry,
  monthlyIncomes,
  onSave,
}: {
  monthKey: string
  entry?: MonthlyIncome
  monthlyIncomes: MonthlyIncome[]
  onSave: (monthKey: string, monthlyIncome: number, otherIncome: number) => void
}) {
  const [editing, setEditing] = useState(false)
  // Falls back to the nearest month that has a figure when this month
  // hasn't been touched yet, so the row matches the cumulative total above
  // instead of looking like $0 income.
  const { monthlyIncome: fallbackIncome, otherIncome: fallbackOther } = monthlyIncomeEntryForMonth(
    monthlyIncomes,
    mKey,
  )
  const total = fallbackIncome + fallbackOther
  const [draft, setDraft] = useState(String(total))

  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isNaN(parsed)) onSave(mKey, parsed - fallbackOther, fallbackOther)
    setEditing(false)
  }

  return (
    <div className="flex items-center justify-between rounded-md px-1.5 py-1.5 text-[13px] hover:bg-[var(--paper)]">
      <span className="text-[var(--text-soft)]">
        {monthKeyLabel(mKey)}
        {!entry && total > 0 && <span className="ml-1.5 text-[11px] italic opacity-70">est.</span>}
      </span>
      {editing ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-24 rounded-md border border-[var(--border)] bg-[var(--paper)] px-2 py-0.5 text-right font-mono text-[13px] text-[var(--ink)]"
        />
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setDraft(String(total))
            setEditing(true)
          }}
          className="font-mono font-medium text-[var(--ink)] hover:underline"
        >
          {formatMoney(total)}
        </button>
      )}
    </div>
  )
}

function SortButton({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 ${align === 'right' ? 'ml-auto flex-row-reverse' : ''} ${
        active ? 'text-[var(--ink)]' : ''
      }`}
    >
      {label}
      <ArrowUpDown size={11} className={active ? (dir === 'asc' ? 'rotate-180' : '') : 'opacity-40'} />
    </button>
  )
}
