import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../data/store'
import { formatMoney, monthKey } from '../utils/format'
import { resolveCategory } from '../utils/resolveCategory'
import { Card } from '../components/Card'
import { CategoryIcon } from '../components/CategoryIcon'

const UNCATEGORIZED_KEY = 'uncategorized'
const categoryKey = (id: string | null) => id ?? UNCATEGORIZED_KEY

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

function monthsOfYear(year: string): { key: string; label: string }[] {
  return MONTH_NAMES.map((name, i) => ({
    key: `${year}-${String(i + 1).padStart(2, '0')}`,
    label: name.slice(0, 3),
  }))
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Reports() {
  const { transactions, categories } = useStore()
  const currentYear = String(new Date().getFullYear())

  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => monthKey(t.date).slice(0, 4)))
    set.add(currentYear)
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [transactions, currentYear])

  const [yearFilter, setYearFilter] = useState(currentYear)
  const [monthFilter, setMonthFilter] = useState('all')

  const months = monthsOfYear(yearFilter)

  // Scoped to the selected year, and the selected month if one is picked —
  // drives the summary sections (top categories/merchants, CSV export).
  const periodTransactions = useMemo(() => {
    let rows = transactions.filter((t) => monthKey(t.date).slice(0, 4) === yearFilter)
    if (monthFilter !== 'all') rows = rows.filter((t) => monthKey(t.date).slice(5, 7) === monthFilter)
    return rows
  }, [transactions, yearFilter, monthFilter])

  const topCategories = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of periodTransactions) {
      const key = categoryKey(t.categoryId)
      totals.set(key, (totals.get(key) ?? 0) + t.amount)
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)
  }, [periodTransactions])

  const byIdCat = (key: string) => resolveCategory(categories, key === UNCATEGORIZED_KEY ? null : key)

  // Always plots all 12 months of the selected year, regardless of the month
  // filter, so the chart stays a full-year trend even when a month is picked.
  const chartData = months.map(({ key, label }) => {
    const row: Record<string, number | string> = { label }
    for (const catKey of topCategories) {
      const total = transactions
        .filter((t) => categoryKey(t.categoryId) === catKey && monthKey(t.date) === key)
        .reduce((sum, t) => sum + t.amount, 0)
      row[catKey] = Math.round(total * 100) / 100
    }
    return row
  })

  const topMerchants = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>()
    for (const t of periodTransactions) {
      const entry = totals.get(t.merchant) ?? { total: 0, count: 0 }
      entry.total += t.amount
      entry.count += 1
      totals.set(t.merchant, entry)
    }
    return [...totals.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8)
  }, [periodTransactions])

  const periodLabel =
    monthFilter === 'all' ? yearFilter : `${MONTH_NAMES[Number(monthFilter) - 1]} ${yearFilter}`

  const exportCsv = () => {
    const rows = [
      ['Date', 'Merchant', 'Category', 'Amount', 'Payment Method', 'Notes'],
      ...periodTransactions.map((t) => [
        t.date.slice(0, 10),
        t.merchant,
        resolveCategory(categories, t.categoryId).name,
        t.amount.toFixed(2),
        t.paymentMethod ?? '',
        t.notes ?? '',
      ]),
    ]
    const suffix = monthFilter === 'all' ? yearFilter : `${yearFilter}-${monthFilter}`
    downloadCsv(rows, `crisexpensetracker_transactions_${suffix}.csv`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Reports</h1>
          <p className="text-[13px] text-[var(--text-soft)]">Category trends and top merchants</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value)
              setMonthFilter('all')
            }}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)]"
          >
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
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      <Card title={`Top categories, ${periodLabel}`}>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-soft)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-soft)' }} width={40} />
              <Tooltip
                formatter={(value, name) => [formatMoney(Number(value)), byIdCat(String(name)).name]}
                contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
              />
              <Legend formatter={(value: string) => byIdCat(value).name} wrapperStyle={{ fontSize: 12 }} />
              {monthFilter !== 'all' && (
                <ReferenceArea
                  x1={months[Number(monthFilter) - 1].label}
                  x2={months[Number(monthFilter) - 1].label}
                  fill="var(--primary)"
                  fillOpacity={0.1}
                  stroke="var(--primary)"
                  strokeOpacity={0.35}
                />
              )}
              {topCategories.map((catKey) => (
                <Bar key={catKey} dataKey={catKey} stackId="a" fill={byIdCat(catKey).color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={`Top merchants, ${periodLabel}`}>
        <ul className="divide-y divide-[var(--border-soft)]">
          {topMerchants.map(([merchant, { total, count }]) => (
            <li key={merchant} className="flex items-center justify-between py-2.5 text-[13px]">
              <div>
                <p className="font-medium text-[var(--ink)]">{merchant}</p>
                <p className="text-[12px] text-[var(--text-soft)]">
                  {count} transaction{count === 1 ? '' : 's'}
                </p>
              </div>
              <span className="font-mono font-medium text-[var(--ink)]">{formatMoney(total)}</span>
            </li>
          ))}
          {topMerchants.length === 0 && (
            <li className="py-6 text-center text-[13px] text-[var(--text-soft)]">
              No transactions for {periodLabel}.
            </li>
          )}
        </ul>
      </Card>

      <Card title="Categories tracked">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]"
              style={{ background: `${c.color}14`, color: c.color }}
            >
              <CategoryIcon name={c.icon} size={12} />
              {c.name}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
