import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Landmark, Layers, Pencil, Plus, RefreshCw, TrendingUp, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { holdingsForAccount, totalInvested } from '../data/selectors'
import { syncPlaidInvestments } from '../data/api'
import { useSession } from '../hooks/useSession'
import { formatDate, formatMoney } from '../utils/format'
import { StatCard } from '../components/StatCard'
import type { AssetType, InvestmentAccount, InvestmentAccountType, InvestmentTransaction, InvestmentTransactionType } from '../types'

const ACCOUNT_TYPE_LABELS: Record<InvestmentAccountType, string> = {
  brokerage: 'Brokerage',
  crypto: 'Crypto exchange',
  retirement: 'Retirement',
  other: 'Other',
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  etf: 'ETF',
  stock: 'Stock',
  crypto: 'Crypto',
  other: 'Other',
}

const TRANSACTION_TYPE_LABELS: Record<InvestmentTransactionType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  other: 'Other',
}

function emptyAccount(): Partial<InvestmentAccount> {
  return { name: '', institution: '', accountType: 'brokerage' }
}

function emptyTransaction(accountId: string): Partial<InvestmentTransaction> & { accountId: string } {
  return {
    accountId,
    symbol: '',
    assetType: 'etf',
    transactionType: 'buy',
    quantity: 0,
    pricePerUnit: 0,
    fees: 0,
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  }
}

export function Investments() {
  const {
    investmentAccounts,
    investmentTransactions,
    saveInvestmentAccount,
    deleteInvestmentAccount,
    saveInvestmentTransaction,
    deleteInvestmentTransaction,
  } = useStore()
  const { session } = useSession()
  const queryClient = useQueryClient()

  const syncMutation = useMutation({
    mutationFn: syncPlaidInvestments,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['investmentAccounts', session?.user.id] })
      queryClient.invalidateQueries({ queryKey: ['investmentTransactions', session?.user.id] })
      window.alert(
        result.items === 0
          ? 'No banks connected yet — connect one first.'
          : `Synced ${result.accounts} account${result.accounts === 1 ? '' : 's'} and ${result.transactions} transaction${result.transactions === 1 ? '' : 's'}.`,
      )
    },
    onError: (err) => window.alert(err instanceof Error ? err.message : 'Sync failed.'),
  })

  const [editingAccount, setEditingAccount] = useState<Partial<InvestmentAccount> | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<
    (Partial<InvestmentTransaction> & { accountId: string }) | null
  >(null)

  const invested = totalInvested(investmentTransactions, investmentAccounts.map((a) => a.id))
  const holdingCount = investmentAccounts.reduce(
    (sum, a) => sum + holdingsForAccount(investmentTransactions, a.id).length,
    0,
  )

  const saveAccount = () => {
    if (!editingAccount || !editingAccount.name?.trim()) return
    saveInvestmentAccount({ ...editingAccount, name: editingAccount.name.trim() })
    setEditingAccount(null)
  }

  const saveTransaction = () => {
    if (!editingTransaction || !editingTransaction.symbol?.trim() || !editingTransaction.date) return
    saveInvestmentTransaction({ ...editingTransaction, symbol: editingTransaction.symbol.trim().toUpperCase() })
    setEditingTransaction(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Investments</h1>
          <p className="text-[13px] text-[var(--text-soft)]">
            ETFs, crypto, and other holdings — log them by hand, or{' '}
            <Link to="/transactions/connect-bank" className="font-medium text-[var(--primary)] hover:underline">
              connect a bank
            </Link>{' '}
            that supports Plaid Investments to sync automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)] disabled:opacity-60"
          >
            <RefreshCw size={15} /> {syncMutation.isPending ? 'Syncing…' : 'Sync from bank'}
          </button>
          <button
            onClick={() => setEditingAccount(emptyAccount())}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            <Plus size={15} /> Add account
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total invested"
          value={formatMoney(invested)}
          sub="cost basis, all accounts"
          icon={<TrendingUp size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Accounts"
          value={String(investmentAccounts.length)}
          icon={<Landmark size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Holdings"
          value={String(holdingCount)}
          icon={<Layers size={16} className="text-[var(--text-soft)]" />}
        />
      </div>

      {investmentAccounts.length === 0 && (
        <p className="text-[13px] text-[var(--text-soft)]">
          No investment accounts yet — add one to start logging ETF or crypto buys and sells.
        </p>
      )}

      <div className="space-y-4">
        {investmentAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            transactions={investmentTransactions.filter((t) => t.accountId === account.id)}
            onEditAccount={() => setEditingAccount({ ...account })}
            onDeleteAccount={() => {
              if (window.confirm(`Delete "${account.name}" and all its transactions? This cannot be undone.`))
                deleteInvestmentAccount(account.id)
            }}
            onAddTransaction={() => setEditingTransaction(emptyTransaction(account.id))}
            onEditTransaction={(t) => setEditingTransaction({ ...t })}
            onDeleteTransaction={(id) => {
              if (window.confirm('Delete this transaction? This cannot be undone.')) deleteInvestmentTransaction(id)
            }}
          />
        ))}
      </div>

      {editingAccount && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display mb-4 text-[19px] text-[var(--ink)]">
              {editingAccount.id ? 'Edit account' : 'New investment account'}
            </h2>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Name</span>
              <input
                value={editingAccount.name ?? ''}
                onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                className="input"
                placeholder="e.g. Sofi Invest"
                autoFocus
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">
                Institution (optional)
              </span>
              <input
                value={editingAccount.institution ?? ''}
                onChange={(e) => setEditingAccount({ ...editingAccount, institution: e.target.value })}
                className="input"
                placeholder="e.g. Sofi Bank"
              />
            </label>

            <label className="mb-6 block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Account type</span>
              <select
                value={editingAccount.accountType ?? 'brokerage'}
                onChange={(e) =>
                  setEditingAccount({ ...editingAccount, accountType: e.target.value as InvestmentAccountType })
                }
                className="input"
              >
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingAccount(null)}
                className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
              >
                Cancel
              </button>
              <button
                onClick={saveAccount}
                className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display mb-4 text-[19px] text-[var(--ink)]">
              {editingTransaction.id ? 'Edit transaction' : 'New transaction'}
            </h2>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Symbol</span>
                <input
                  value={editingTransaction.symbol ?? ''}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, symbol: e.target.value })}
                  className="input uppercase"
                  placeholder="VOO, BTC..."
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Asset type</span>
                <select
                  value={editingTransaction.assetType ?? 'etf'}
                  onChange={(e) =>
                    setEditingTransaction({ ...editingTransaction, assetType: e.target.value as AssetType })
                  }
                  className="input"
                >
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Transaction</span>
              <select
                value={editingTransaction.transactionType ?? 'buy'}
                onChange={(e) =>
                  setEditingTransaction({
                    ...editingTransaction,
                    transactionType: e.target.value as InvestmentTransactionType,
                  })
                }
                className="input"
              >
                {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Quantity</span>
                <input
                  type="number"
                  step="any"
                  value={editingTransaction.quantity ?? 0}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, quantity: Number(e.target.value) })}
                  className="input font-mono"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Price / unit</span>
                <input
                  type="number"
                  step="any"
                  value={editingTransaction.pricePerUnit ?? 0}
                  onChange={(e) =>
                    setEditingTransaction({ ...editingTransaction, pricePerUnit: Number(e.target.value) })
                  }
                  className="input font-mono"
                />
              </label>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Fees</span>
                <input
                  type="number"
                  step="any"
                  value={editingTransaction.fees ?? 0}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, fees: Number(e.target.value) })}
                  className="input font-mono"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Date</span>
                <input
                  type="date"
                  value={editingTransaction.date ?? ''}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                  className="input"
                />
              </label>
            </div>

            <label className="mb-6 block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Notes (optional)</span>
              <textarea
                value={editingTransaction.notes ?? ''}
                onChange={(e) => setEditingTransaction({ ...editingTransaction, notes: e.target.value })}
                className="input min-h-[60px] resize-none"
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setEditingTransaction(null)}
                className="flex-1 rounded-lg border border-[var(--border)] py-2.5 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
              >
                Cancel
              </button>
              <button
                onClick={saveTransaction}
                className="flex-1 rounded-lg bg-[var(--primary)] py-2.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AccountCard({
  account,
  transactions,
  onEditAccount,
  onDeleteAccount,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}: {
  account: InvestmentAccount
  transactions: InvestmentTransaction[]
  onEditAccount: () => void
  onDeleteAccount: () => void
  onAddTransaction: () => void
  onEditTransaction: (t: InvestmentTransaction) => void
  onDeleteTransaction: (id: string) => void
}) {
  const holdings = holdingsForAccount(transactions, account.id)
  const accountCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0)
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-semibold text-[var(--ink)]">{account.name}</p>
            <span className="rounded-full bg-[var(--paper)] px-2 py-0.5 text-[11px] text-[var(--text-soft)]">
              {ACCOUNT_TYPE_LABELS[account.accountType]}
            </span>
          </div>
          {account.institution && <p className="text-[12px] text-[var(--text-soft)]">{account.institution}</p>}
        </div>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[15px] font-medium text-[var(--ink)]">{formatMoney(accountCostBasis)}</p>
          <button
            onClick={onEditAccount}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-soft)] hover:bg-[var(--paper)]"
            aria-label="Edit account"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDeleteAccount}
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--warn)] hover:bg-[var(--warn-soft)]"
            aria-label="Delete account"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {holdings.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-lg border border-[var(--border-soft)]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Quantity</th>
                <th className="px-3 py-2 text-right font-medium">Avg cost</th>
                <th className="px-3 py-2 text-right font-medium">Cost basis</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.symbol} className="border-b border-[var(--border-soft)] last:border-0">
                  <td className="px-3 py-2 font-medium text-[var(--ink)]">{h.symbol}</td>
                  <td className="px-3 py-2 text-[var(--text-soft)]">{ASSET_TYPE_LABELS[h.assetType]}</td>
                  <td className="px-3 py-2 text-right font-mono">{h.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(h.avgCost)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-[var(--ink)]">
                    {formatMoney(h.costBasis)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] uppercase tracking-wide text-[var(--text-soft)]">Recent transactions</p>
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-soft)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <Plus size={13} /> Add transaction
        </button>
      </div>

      {recent.length === 0 ? (
        <p className="text-[13px] text-[var(--text-soft)]">No transactions logged yet.</p>
      ) : (
        <div className="space-y-1">
          {recent.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--paper)]"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-[var(--ink)]">{t.symbol}</span>{' '}
                <span className="text-[var(--text-soft)]">
                  {TRANSACTION_TYPE_LABELS[t.transactionType].toLowerCase()} {t.quantity} @ {formatMoney(t.pricePerUnit)}
                </span>
              </div>
              <span className="text-[12px] text-[var(--text-soft)]">{formatDate(t.date)}</span>
              <button
                onClick={() => onEditTransaction(t)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--text-soft)] hover:bg-[var(--surface)]"
                aria-label="Edit transaction"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDeleteTransaction(t.id)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--warn)] hover:bg-[var(--warn-soft)]"
                aria-label="Delete transaction"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
