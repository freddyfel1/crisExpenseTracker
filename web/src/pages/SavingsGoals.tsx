import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { formatMoney, formatDate } from '../utils/format'
import { Card } from '../components/Card'
import type { SavingsGoal } from '../types'

export function SavingsGoals() {
  const { savingsGoals, saveSavingsGoal, deleteSavingsGoal } = useStore()

  const goals = [...savingsGoals].sort((a, b) => a.sortOrder - b.sortOrder)
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0)
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0)

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
            onSave={(patch) => saveSavingsGoal({ id: goal.id, ...goal, ...patch })}
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
  onSave,
  onDelete,
}: {
  goal: SavingsGoal
  onSave: (patch: Partial<SavingsGoal>) => void
  onDelete: () => void
}) {
  const pct = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0
  const reached = goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <input
          defaultValue={goal.name}
          onBlur={(e) => e.target.value.trim() && onSave({ name: e.target.value.trim() })}
          className="flex-1 bg-transparent text-[15px] font-semibold text-[var(--ink)] outline-none focus:border-b focus:border-[var(--border)]"
        />
        <button onClick={onDelete} className="text-[var(--text-soft)] hover:text-[var(--warn)]">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--paper)]">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mb-3 text-[12px] text-[var(--text-soft)]">
        {Math.round(pct * 100)}% {reached && '— goal reached'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <MoneyField label="Saved" value={goal.currentAmount} onSave={(v) => onSave({ currentAmount: v })} />
        <MoneyField label="Target" value={goal.targetAmount} onSave={(v) => onSave({ targetAmount: v })} />
      </div>

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
