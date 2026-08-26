import { useState } from 'react'
import { useStore } from '../data/store'
import { usePeriod } from '../data/period'
import { spendByCategory, transactionsForCurrentWeek, transactionsForMonth } from '../data/selectors'
import { formatMoney, monthKeyLabel } from '../utils/format'
import { CategoryIcon } from '../components/CategoryIcon'
import { MonthPicker } from '../components/MonthPicker'

type Period = 'monthly' | 'weekly'

export function Budgets() {
  const { categories, budgets, transactions, setBudget } = useStore()
  const { month } = usePeriod()
  const [period, setPeriod] = useState<Period>('monthly')

  const scopedTxns = period === 'monthly' ? transactionsForMonth(transactions, month) : transactionsForCurrentWeek(transactions)
  const spendById = new Map(spendByCategory(scopedTxns).map((s) => [s.categoryId, s.total]))

  const totalLimit = budgets.reduce(
    (sum, b) => sum + (period === 'monthly' ? b.monthlyLimit : b.monthlyLimit / 4.345),
    0,
  )
  const totalSpent = [...spendById.values()].reduce((sum, v) => sum + v, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Budgets</h1>
          <p className="text-[13px] text-[var(--text-soft)]">
            {period === 'monthly' ? monthKeyLabel(month) : 'This week'} · {formatMoney(totalSpent)} of{' '}
            {formatMoney(totalLimit)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
            {(['monthly', 'weekly'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-[12.5px] capitalize ${
                  period === p ? 'bg-[var(--primary-soft)] text-[var(--primary-ink)] font-medium' : 'text-[var(--text-soft)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {period === 'monthly' && <MonthPicker />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categories.map((c) => {
          const budget = budgets.find((b) => b.categoryId === c.id)
          const limit = period === 'monthly' ? budget?.monthlyLimit ?? 0 : (budget?.monthlyLimit ?? 0) / 4.345
          const spent = spendById.get(c.id) ?? 0
          const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
          const over = limit > 0 && spent > limit

          return (
            <div key={c.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
                  style={{ background: `${c.color}14`, color: c.color }}
                >
                  <CategoryIcon name={c.icon} size={15} />
                </span>
                <p className="flex-1 text-[13px] font-medium text-[var(--ink)]">{c.name}</p>
                <span className={`font-mono text-[12.5px] ${over ? 'text-[var(--warn)]' : 'text-[var(--text-soft)]'}`}>
                  {formatMoney(spent)} / {formatMoney(limit)}
                </span>
              </div>

              <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--border-soft)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: over ? 'var(--warn)' : c.color }}
                />
              </div>

              <label className="flex items-center gap-2 text-[12px] text-[var(--text-soft)]">
                Monthly limit
                <input
                  type="number"
                  step="10"
                  defaultValue={budget?.monthlyLimit ?? 0}
                  onBlur={(e) => setBudget(c.id, Number(e.target.value))}
                  className="input font-mono ml-auto w-24 py-1"
                />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
