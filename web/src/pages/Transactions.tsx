import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowUpDown, Plus, Search, PiggyBank, Wallet, Scale } from 'lucide-react'
import { useStore } from '../data/store'
import { resolveCategory } from '../utils/resolveCategory'
import { formatDate, formatMoney, monthKey } from '../utils/format'
import { ReceiptThumb } from '../components/ReceiptThumb'
import { CategoryIcon } from '../components/CategoryIcon'
import { TransactionDrawer } from '../components/TransactionDrawer'
import { CaptureReceiptButton } from '../components/CaptureReceiptButton'
import { StatCard } from '../components/StatCard'

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
  const { transactions, categories, profile } = useStore()
  const navigate = useNavigate()
  const { id } = useParams()

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.date).slice(0, 4)))
    set.add(String(new Date().getFullYear()))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const filtered = useMemo(() => {
    let rows = transactions
    if (categoryFilter !== 'all') rows = rows.filter((t) => t.categoryId === categoryFilter)
    if (yearFilter !== 'all') rows = rows.filter((t) => monthKey(t.date).slice(0, 4) === yearFilter)
    if (monthFilter !== 'all') rows = rows.filter((t) => monthKey(t.date).slice(5, 7) === monthFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortKey === 'amount') cmp = a.amount - b.amount
      else cmp = a.merchant.localeCompare(b.merchant)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [transactions, categoryFilter, yearFilter, monthFilter, query, sortKey, sortDir])

  const monthIncome = (profile?.monthlyIncome ?? 0) + (profile?.otherIncome ?? 0)
  const monthExpense = useMemo(() => filtered.reduce((sum, t) => sum + t.amount, 0), [filtered])

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
          label="Total income"
          value={formatMoney(monthIncome)}
          sub="income + other income"
          icon={<PiggyBank size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Total expense"
          value={formatMoney(monthExpense)}
          sub={`${filtered.length} transactions`}
          icon={<Wallet size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Balance"
          value={formatMoney(monthIncome - monthExpense)}
          sub="income minus expense"
          tone={monthIncome - monthExpense < 0 ? 'warn' : 'good'}
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
