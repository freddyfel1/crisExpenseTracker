import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { formatMoney, formatDate } from '../utils/format'
import { Card } from '../components/Card'
import type { Category, SavingsGoal, Transaction } from '../types'

// A goal's real progress is the manual "Saved" figure plus whatever's landed in its
// linked category (e.g. "Transfer to Goal1") — logging a transaction there is what
// makes money "show up" on the goal without having to re-type the total by hand.
function transferredAmount(goal: SavingsGoal, transactions: Transaction[]) {
  if (!goal.linkedCategoryId) return 0
  return transactions.filter((t) => t.categoryId === goal.linkedCategoryId).reduce((sum, t) => sum + t.amount, 0)
}

export function SavingsGoals() {
  const { savingsGoals, categories, transactions, saveSavingsGoal, deleteSavingsGoal } = useStore()

  const goals = [...savingsGoals].sort((a, b) => a.sortOrder - b.sortOrder)
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0)
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount + transferredAmount(g, transactions), 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] text-[var(--ink)]">Savings Goals</h1>
        <p className="text-[13px] text-[var(--text-soft)]">
          Set targets and track progress toward what you're saving up for.
        </p>
      </div>

      {goals.length > 0 && (
        <Card title="Overview">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">Total saved</p>
              <p className="font-display mt-1 text-[19px] leading-none text-[var(--ink)]">{formatMoney(totalSaved)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">Total target</p>
              <p className="font-display mt-1 text-[19px] leading-none text-[var(--ink)]">{formatMoney(totalTarget)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">Remaining</p>
              <p className="font-display mt-1 text-[19px] leading-none text-[var(--primary)]">
                {formatMoney(Math.max(totalTarget - totalSaved, 0))}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            categories={categories}
            transactions={transactions}
            onSave={(patch) => saveSavingsGoal({ ...goal, ...patch })}
            onDelete={() => {
              if (window.confirm(`Delete "${goal.name}"? This cannot be undone.`)) deleteSavingsGoal(goal.id)
            }}
          />
        ))}
      </div>

      {goals.length === 0 && (
        <p className="text-[13px] text-[var(--text-soft)]">No savings goals yet — add one to start tracking.</p>
      )}

      <button
        onClick={() => saveSavingsGoal({ name: 'New goal', targetAmount: 0, currentAmount: 0, sortOrder: goals.length })}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-soft)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
      >
        <Plus size={15} /> Add goal
      </button>
    </div>
  )
}

function GoalCard({
  goal,
  categories,
  transactions,
  onSave,
  onDelete,
}: {
  goal: SavingsGoal
  categories: Category[]
  transactions: Transaction[]
  onSave: (patch: Partial<SavingsGoal>) => void
  onDelete: () => void
}) {
  const linkedCategory = goal.linkedCategoryId ? categories.find((c) => c.id === goal.linkedCategoryId) : undefined
  const linkedTransactions = linkedCategory
    ? transactions.filter((t) => t.categoryId === linkedCategory.id).sort((a, b) => b.date.localeCompare(a.date))
    : []
  const transferred = linkedTransactions.reduce((sum, t) => sum + t.amount, 0)
  const totalSaved = goal.currentAmount + transferred

  const pct = goal.targetAmount > 0 ? Math.min(totalSaved / goal.targetAmount, 1) : 0
  const reached = goal.targetAmount > 0 && totalSaved >= goal.targetAmount

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <input
          defaultValue={goal.name}
          placeholder="Goal name — e.g. Vacation, Car, Trip"
          onBlur={(e) => e.target.value.trim() && onSave({ name: e.target.value.trim() })}
          className="flex-1 border-b border-transparent bg-transparent text-[15px] font-semibold text-[var(--ink)] outline-none hover:border-[var(--border)] focus:border-[var(--border)]"
        />
        <button onClick={onDelete} className="text-[var(--text-soft)] hover:text-[var(--warn)]">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--paper)]">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mb-3 text-[12px] text-[var(--text-soft)]">
        {Math.round(pct * 100)}% of {formatMoney(goal.targetAmount)} {reached && '— goal reached'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label={linkedCategory ? 'Manual adjustment' : 'Saved'}
          value={goal.currentAmount}
          onSave={(v) => onSave({ currentAmount: v })}
        />
        <MoneyField label="Target" value={goal.targetAmount} onSave={(v) => onSave({ targetAmount: v })} />
      </div>

      {linkedCategory && (
        <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
              From &ldquo;{linkedCategory.name}&rdquo;
            </p>
            <p className="text-[12px] font-medium text-[var(--ink)]">{formatMoney(transferred)}</p>
          </div>
          {linkedTransactions.length > 0 ? (
            <ul className="max-h-28 space-y-1 overflow-y-auto pr-1 text-[12px]">
              {linkedTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-[var(--text-soft)]">
                  <span className="truncate">
                    {t.merchant || 'Transfer'} · {formatDate(t.date)}
                  </span>
                  <span className="shrink-0 font-mono text-[var(--ink)]">{formatMoney(t.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-[var(--text-soft)]">
              Log a transaction under &ldquo;{linkedCategory.name}&rdquo; and it'll show up here.
            </p>
          )}
          <p className="mt-2 text-[12px] font-medium text-[var(--ink)]">Total saved: {formatMoney(totalSaved)}</p>
        </div>
      )}

      <div className="mt-3">
        <label className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">Target date</label>
        <input
          type="date"
          defaultValue={goal.targetDate ?? ''}
          onBlur={(e) => onSave({ targetDate: e.target.value || null })}
          className="input mt-1 w-full py-1.5 text-[13px]"
        />
        {goal.targetDate && (
          <p className="mt-1 text-[12px] text-[var(--text-soft)]">By {formatDate(goal.targetDate)}</p>
        )}
      </div>
    </Card>
  )
}

function MoneyField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">{label}</label>
      <input
        defaultValue={formatMoney(value)}
        type="text"
        inputMode="decimal"
        onFocus={(e) => {
          e.target.value = value === 0 ? '' : String(value)
          e.target.select()
        }}
        onBlur={(e) => {
          const parsed = Number(e.target.value.replace(/[^0-9.-]/g, '')) || 0
          onSave(parsed)
          e.target.value = formatMoney(parsed)
        }}
        className="input mt-1 w-full py-1.5 text-[13px] font-mono"
      />
    </div>
  )
}
