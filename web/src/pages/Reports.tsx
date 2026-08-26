import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../data/store'
import { formatMoney, monthKey } from '../utils/format'
import { resolveCategory } from '../utils/resolveCategory'
import { Card } from '../components/Card'
import { CategoryIcon } from '../components/CategoryIcon'

const UNCATEGORIZED_KEY = 'uncategorized'
const categoryKey = (id: string | null) => id ?? UNCATEGORIZED_KEY

function lastNMonths(n: number): { key: string; label: string }[] {
  const now = new Date()
  const months = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
    })
  }
  return months
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
  const months = lastNMonths(6)
  const topCategories = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of transactions) {
      const key = categoryKey(t.categoryId)
      totals.set(key, (totals.get(key) ?? 0) + t.amount)
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id)
  }, [transactions])

  const byIdCat = (key: string) => resolveCategory(categories, key === UNCATEGORIZED_KEY ? null : key)

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
    for (const t of transactions) {
      const entry = totals.get(t.merchant) ?? { total: 0, count: 0 }
      entry.total += t.amount
      entry.count += 1
      totals.set(t.merchant, entry)
    }
    return [...totals.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8)
  }, [transactions])

  const exportCsv = () => {
    const rows = [
      ['Date', 'Merchant', 'Category', 'Amount', 'Payment Method', 'Notes'],
      ...transactions.map((t) => [
        t.date.slice(0, 10),
        t.merchant,
        resolveCategory(categories, t.categoryId).name,
        t.amount.toFixed(2),
        t.paymentMethod ?? '',
        t.notes ?? '',
      ]),
    ]
    downloadCsv(rows, `crisexpensetracker_transactions_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Reports</h1>
          <p className="text-[13px] text-[var(--text-soft)]">Category trends and top merchants</p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      <Card title="Top categories, last 6 months">
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
              {topCategories.map((catKey) => (
                <Bar key={catKey} dataKey={catKey} stackId="a" fill={byIdCat(catKey).color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Top merchants">
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
