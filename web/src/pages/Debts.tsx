import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, CreditCard, HandCoins, Landmark, Pencil, Plus, TrendingDown, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { compareEarlyRepayment, debtLedger, debtStanding, projectAmortization, standardMonthlyPayment } from '../data/selectors'
import { formatDate, formatMoney } from '../utils/format'
import { StatCard } from '../components/StatCard'
import type { Debt, DebtPayment, DebtType } from '../types'

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  mortgage: 'Mortgage',
  personal_loan: 'Personal loan',
  credit_card: 'Credit card',
  friend_loan: 'Loan to a friend',
  other: 'Other',
}

const DEBT_TYPE_ICONS: Record<DebtType, typeof Landmark> = {
  mortgage: Landmark,
  personal_loan: HandCoins,
  credit_card: CreditCard,
  friend_loan: HandCoins,
  other: Landmark,
}

// Tapping into a number/currency cell always clears it, so there's no leading "0" to
// select-and-delete before typing a real value — same fix already applied to the
// investment-transaction fields. Uncontrolled (defaultValue, not value) so typing isn't
// fought on every keystroke; commits on blur, and leaving it empty reverts to the prior
// value rather than saving as 0 (Number('') is 0, not NaN — the usual footgun).
function NumberCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      defaultValue={String(value)}
      onFocus={(e) => {
        e.target.value = ''
      }}
      onBlur={(e) => {
        const next = e.target.value.trim() === '' ? value : Number(e.target.value)
        const safe = Number.isNaN(next) ? value : next
        onCommit(safe)
        e.target.value = String(safe)
      }}
      className="input font-mono"
    />
  )
}

function CurrencyCell({
  value,
  onCommit,
  autoFocus,
}: {
  value: number
  onCommit: (v: number) => void
  autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      defaultValue={formatMoney(value)}
      autoFocus={autoFocus}
      onFocus={(e) => {
        e.target.value = ''
      }}
      onBlur={(e) => {
        const next = e.target.value.trim() === '' ? value : Number(e.target.value.replace(/[^0-9.-]/g, ''))
        const safe = Number.isNaN(next) ? value : next
        onCommit(safe)
        e.target.value = formatMoney(safe)
      }}
      className="input font-mono"
    />
  )
}

function emptyDebt(): Partial<Debt> {
  return {
    name: '',
    debtType: 'other',
    institution: '',
    principal: 0,
    interestRate: 0,
    termMonths: 0,
    monthlyPayment: 0,
    startDate: new Date().toISOString().slice(0, 10),
    notes: '',
  }
}

function emptyPayment(debtId: string): Partial<DebtPayment> & { debtId: string } {
  return {
    debtId,
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  }
}

export function Debts() {
  const { debts, debtPayments, saveDebt, deleteDebt, saveDebtPayment, deleteDebtPayment } = useStore()
  const [editingDebt, setEditingDebt] = useState<Partial<Debt> | null>(null)
  const [editingPayment, setEditingPayment] = useState<(Partial<DebtPayment> & { debtId: string }) | null>(null)

  const standings = useMemo(() => new Map(debts.map((d) => [d.id, debtStanding(d, debtPayments)])), [debts, debtPayments])

  const totalPrincipal = debts.reduce((sum, d) => sum + d.principal, 0)
  const totalBalance = debts.reduce((sum, d) => sum + (standings.get(d.id)?.balance ?? d.principal), 0)
  const totalMonthlyPayment = debts.reduce((sum, d) => sum + d.monthlyPayment, 0)
  const paidOffPct = totalPrincipal > 0 ? ((totalPrincipal - totalBalance) / totalPrincipal) * 100 : 0

  const saveDebtForm = () => {
    if (!editingDebt || !editingDebt.name?.trim() || !editingDebt.startDate) return
    saveDebt({ ...editingDebt, name: editingDebt.name.trim() })
    setEditingDebt(null)
  }

  const savePaymentForm = () => {
    if (!editingPayment || !editingPayment.date || !editingPayment.debtId) return
    saveDebtPayment(editingPayment)
    setEditingPayment(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Debts</h1>
          <p className="text-[13px] text-[var(--text-soft)]">Your loans and credit, and what's left to pay off.</p>
        </div>
        <button
          onClick={() => setEditingDebt(emptyDebt())}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90"
        >
          <Plus size={15} /> Add a debt
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total debt"
          value={formatMoney(totalBalance)}
          icon={<Landmark size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Monthly payments"
          value={formatMoney(totalMonthlyPayment)}
          icon={<TrendingDown size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard label="Debts" value={String(debts.length)} icon={<CreditCard size={16} className="text-[var(--text-soft)]" />} />
        <StatCard
          label="Paid off"
          value={`${paidOffPct.toFixed(0)}%`}
          sub="of original principal"
          tone="good"
          icon={<HandCoins size={16} className="text-[var(--text-soft)]" />}
        />
      </div>

      {debts.length === 0 && (
        <p className="text-[13px] text-[var(--text-soft)]">
          No debts tracked yet — add a mortgage, loan, or credit card to see it here.
        </p>
      )}

      <div className="space-y-4">
        {debts.map((debt) => (
          <DebtCard
            key={debt.id}
            debt={debt}
            payments={debtPayments.filter((p) => p.debtId === debt.id)}
            onEdit={() => setEditingDebt({ ...debt })}
            onDelete={() => {
              if (window.confirm(`Delete "${debt.name}" and all its logged payments? This cannot be undone.`))
                deleteDebt(debt.id)
            }}
            onAddPayment={() => setEditingPayment(emptyPayment(debt.id))}
            onEditPayment={(p) => setEditingPayment({ ...p })}
            onDeletePayment={(id) => {
              if (window.confirm('Delete this payment? This cannot be undone.')) deleteDebtPayment(id)
            }}
          />
        ))}
      </div>

      {editingDebt && (
        <DebtModal
          debt={editingDebt}
          onChange={setEditingDebt}
          onCancel={() => setEditingDebt(null)}
          onSave={saveDebtForm}
        />
      )}

      {editingPayment && (
        <PaymentModal
          payment={editingPayment}
          debts={debts}
          onChange={setEditingPayment}
          onCancel={() => setEditingPayment(null)}
          onSave={savePaymentForm}
        />
      )}
    </div>
  )
}

function DebtCard({
  debt,
  payments,
  onEdit,
  onDelete,
  onAddPayment,
  onEditPayment,
  onDeletePayment,
}: {
  debt: Debt
  payments: DebtPayment[]
  onEdit: () => void
  onDelete: () => void
  onAddPayment: () => void
  onEditPayment: (p: DebtPayment) => void
  onDeletePayment: (id: string) => void
}) {
  const [showSchedule, setShowSchedule] = useState(false)
  const [extraPayment, setExtraPayment] = useState(0)

  const ledger = useMemo(() => debtLedger(debt, payments), [debt, payments])
  const balance = ledger.length > 0 ? ledger[ledger.length - 1].balanceAfter : debt.principal
  const pctRepaid = debt.principal > 0 ? Math.min(((debt.principal - balance) / debt.principal) * 100, 100) : 0

  const projection = useMemo(
    () => (debt.monthlyPayment > 0 ? projectAmortization(balance, debt.interestRate, debt.monthlyPayment) : []),
    [balance, debt.interestRate, debt.monthlyPayment],
  )
  const paymentsLeft = projection.length
  // What's left to pay from today, including every dollar of interest still to accrue —
  // not the original loan's total, since past payments already covered some of that.
  const totalWithInterest =
    projection.length > 0 ? balance + projection.reduce((sum, r) => sum + r.interest, 0) : null

  const comparison = useMemo(
    () =>
      debt.monthlyPayment > 0
        ? compareEarlyRepayment(balance, debt.interestRate, debt.monthlyPayment, extraPayment)
        : null,
    [balance, debt.interestRate, debt.monthlyPayment, extraPayment],
  )

  const Icon = DEBT_TYPE_ICONS[debt.debtType]
  const sortedLedger = [...ledger].reverse()

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-lg bg-[var(--paper)] text-[var(--text-soft)]">
            <Icon size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-semibold text-[var(--ink)]">{debt.name}</p>
              <span className="rounded-full bg-[var(--paper)] px-2 py-0.5 text-[11px] text-[var(--text-soft)]">
                {DEBT_TYPE_LABELS[debt.debtType]}
              </span>
            </div>
            <p className="text-[12px] text-[var(--text-soft)]">
              {debt.interestRate > 0 ? `${debt.interestRate}% · ` : ''}
              {paymentsLeft > 0
                ? `${paymentsLeft} payment${paymentsLeft === 1 ? '' : 's'} left`
                : debt.monthlyPayment > 0
                  ? 'payment covers interest only'
                  : 'no scheduled payment set'}
              {debt.institution ? ` · ${debt.institution}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-2">
              <p className="font-mono text-[15px] font-medium text-[var(--warn)]">{formatMoney(balance)}</p>
              {totalWithInterest != null && (
                <span className="whitespace-nowrap font-mono text-[11px] text-[var(--text-soft)]">
                  {formatMoney(totalWithInterest)} with interest
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] text-[var(--text-soft)]">per month: {formatMoney(debt.monthlyPayment)}</p>
          </div>
          <button
            onClick={onEdit}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-soft)] hover:bg-[var(--paper)]"
            aria-label="Edit debt"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--warn)] hover:bg-[var(--warn-soft)]"
            aria-label="Delete debt"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--paper)]">
          <div className="h-full rounded-full bg-[var(--warn)]" style={{ width: `${pctRepaid}%` }} />
        </div>
        <p className="text-[12px] text-[var(--text-soft)]">{pctRepaid.toFixed(0)}% repaid</p>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] uppercase tracking-wide text-[var(--text-soft)]">Payments</p>
        <div className="flex items-center gap-3">
          {debt.monthlyPayment > 0 && (
            <button
              onClick={() => setShowSchedule((v) => !v)}
              className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-soft)] hover:text-[var(--primary)]"
            >
              {showSchedule ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Amortization & early payoff
            </button>
          )}
          <button
            onClick={onAddPayment}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-soft)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Plus size={13} /> Log payment
          </button>
        </div>
      </div>

      {sortedLedger.length === 0 ? (
        <p className="text-[13px] text-[var(--text-soft)]">No payments logged yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-soft)]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Interest</th>
                <th className="px-3 py-2 text-right font-medium">Principal</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sortedLedger.map((entry) => (
                <tr
                  key={entry.id}
                  className="cursor-pointer border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--paper)]"
                  onClick={() => onEditPayment(entry)}
                >
                  <td className="px-3 py-2 text-[var(--text-soft)]">{formatDate(entry.date)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(entry.amount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(entry.interest)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(entry.principalPortion)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(entry.balanceAfter)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeletePayment(entry.id)
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md text-[var(--warn)] hover:bg-[var(--warn-soft)]"
                      aria-label="Delete payment"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showSchedule && debt.monthlyPayment > 0 && comparison && (
        <div className="mt-4 rounded-lg border border-[var(--border-soft)] bg-[var(--paper)] p-4">
          <p className="mb-3 text-[13px] font-semibold text-[var(--ink)]">Early repayment</p>
          <label className="mb-4 block max-w-[220px]">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Extra monthly payment</span>
            <input
              type="number"
              step="any"
              min={0}
              value={extraPayment}
              onChange={(e) => setExtraPayment(Math.max(Number(e.target.value), 0))}
              className="input font-mono"
            />
          </label>

          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">Months saved</p>
              <p className="font-display mt-1 text-[19px] leading-none text-[var(--primary)]">{comparison.monthsSaved}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">Interest saved</p>
              <p className="font-display mt-1 text-[19px] leading-none text-[var(--primary)]">
                {formatMoney(comparison.interestSaved)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-soft)]">Payoff date</p>
              <p className="mt-1 text-[13px] text-[var(--ink)]">
                {extraPayment > 0 && comparison.baselinePayoffDate !== comparison.newPayoffDate && (
                  <span className="mr-1.5 text-[var(--text-soft)] line-through">
                    {comparison.baselinePayoffDate ?? '—'}
                  </span>
                )}
                {comparison.newPayoffDate ?? '—'}
              </p>
            </div>
          </div>

          <p className="mb-2 text-[12px] uppercase tracking-wide text-[var(--text-soft)]">
            Amortization schedule{extraPayment > 0 ? ' (with extra payment)' : ''}
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border-soft)]">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="border-b border-[var(--border-soft)] text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 text-right font-medium">Interest</th>
                  <th className="px-3 py-2 text-right font-medium">Principal</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {comparison.withExtra.map((row) => (
                  <tr key={row.month} className="border-b border-[var(--border-soft)] last:border-0">
                    <td className="px-3 py-2 text-[var(--text-soft)]">{row.date}</td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text-soft)]">{formatMoney(row.interest)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney(row.principal)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function DebtModal({
  debt,
  onChange,
  onCancel,
  onSave,
}: {
  debt: Partial<Debt>
  onChange: (d: Partial<Debt>) => void
  onCancel: () => void
  onSave: () => void
}) {
  const commitTerm = (termMonths: number) => {
    const suggested =
      termMonths > 0 ? standardMonthlyPayment(debt.principal ?? 0, debt.interestRate ?? 0, termMonths) : debt.monthlyPayment ?? 0
    onChange({
      ...debt,
      termMonths,
      monthlyPayment: termMonths > 0 ? Math.round(suggested * 100) / 100 : (debt.monthlyPayment ?? 0),
    })
  }

  // Projects the full original loan (not the current balance) at its monthly payment to
  // see what it actually costs over its life — principal plus every dollar of interest
  // that payment schedule adds up to.
  const schedule =
    (debt.monthlyPayment ?? 0) > 0
      ? projectAmortization(debt.principal ?? 0, debt.interestRate ?? 0, debt.monthlyPayment ?? 0)
      : []
  const totalWithInterest = schedule.length > 0 ? (debt.principal ?? 0) + schedule.reduce((sum, r) => sum + r.interest, 0) : null

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display mb-4 text-[19px] text-[var(--ink)]">{debt.id ? 'Edit debt' : 'New debt'}</h2>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Name</span>
          <input
            value={debt.name ?? ''}
            onChange={(e) => onChange({ ...debt, name: e.target.value })}
            className="input"
            placeholder="e.g. Home Mortgage"
            autoFocus
          />
        </label>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Type</span>
            <select
              value={debt.debtType ?? 'other'}
              onChange={(e) => onChange({ ...debt, debtType: e.target.value as DebtType })}
              className="input"
            >
              {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Institution (optional)</span>
            <input
              value={debt.institution ?? ''}
              onChange={(e) => onChange({ ...debt, institution: e.target.value })}
              className="input"
              placeholder="e.g. Chase"
            />
          </label>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Original amount</span>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <CurrencyCell value={debt.principal ?? 0} onCommit={(v) => onChange({ ...debt, principal: v })} />
            </div>
            {totalWithInterest != null && (
              <span className="whitespace-nowrap text-[11px] text-[var(--text-soft)]">
                {formatMoney(totalWithInterest)} with interest
              </span>
            )}
          </div>
        </label>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Interest rate (annual %)</span>
            <NumberCell value={debt.interestRate ?? 0} onCommit={(v) => onChange({ ...debt, interestRate: v })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Term (months, 0 if open-ended)</span>
            <NumberCell value={debt.termMonths ?? 0} onCommit={commitTerm} />
          </label>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Monthly payment</span>
          <CurrencyCell
            key={debt.monthlyPayment}
            value={debt.monthlyPayment ?? 0}
            onCommit={(v) => onChange({ ...debt, monthlyPayment: v })}
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Start date</span>
          <input
            type="date"
            value={debt.startDate ?? ''}
            onChange={(e) => onChange({ ...debt, startDate: e.target.value })}
            className="input"
          />
        </label>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentModal({
  payment,
  debts,
  onChange,
  onCancel,
  onSave,
}: {
  payment: Partial<DebtPayment> & { debtId: string }
  debts: Debt[]
  onChange: (p: Partial<DebtPayment> & { debtId: string }) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display mb-4 text-[19px] text-[var(--ink)]">{payment.id ? 'Edit payment' : 'Log payment'}</h2>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Debt</span>
          <select value={payment.debtId} onChange={(e) => onChange({ ...payment, debtId: e.target.value })} className="input">
            {debts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Amount</span>
            <CurrencyCell value={payment.amount ?? 0} onCommit={(v) => onChange({ ...payment, amount: v })} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Date</span>
            <input
              type="date"
              value={payment.date ?? ''}
              onChange={(e) => onChange({ ...payment, date: e.target.value })}
              className="input"
            />
          </label>
        </div>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Notes (optional)</span>
          <textarea
            value={payment.notes ?? ''}
            onChange={(e) => onChange({ ...payment, notes: e.target.value })}
            className="input min-h-[60px] resize-none"
          />
        </label>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
