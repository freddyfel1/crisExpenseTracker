import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, FileText, Landmark, Layers, Pencil, Plus, RefreshCw, TrendingUp, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { holdingsForAccount, marketValue, mergeHoldingsBySymbol, totalInvested } from '../data/selectors'
import { syncPlaidInvestments } from '../data/api'
import { useSession } from '../hooks/useSession'
import { firstName, formatDate, formatMoney, formatRelativeTime } from '../utils/format'
import { StatCard } from '../components/StatCard'
import { Card } from '../components/Card'
import { HoldingsGainLoss } from '../components/HoldingsGainLoss'
import type { AssetType, InvestmentAccount, InvestmentAccountType, InvestmentTransaction, InvestmentTransactionType } from '../types'

const ACCOUNT_TYPE_LABELS: Record<InvestmentAccountType, string> = {
  brokerage: 'Brokerage',
  crypto: 'Crypto',
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

function emptyTransaction(accountId: string, assetType: AssetType): Partial<InvestmentTransaction> & { accountId: string } {
  return {
    accountId,
    symbol: '',
    assetType,
    transactionType: 'buy',
    quantity: 0,
    pricePerUnit: 0,
    fees: 0,
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  }
}

interface Props {
  title: string
  description: ReactNode
  isIncluded: (assetType: AssetType) => boolean
  defaultAssetType: AssetType
  defaultAccountType: InvestmentAccountType
  pdfSubtitle: string
  filenameSuffix: string
  emptyHint: string
}

// Some accounts hold a mix of asset types (a brokerage account with both stocks and a
// little crypto, say) — an account can't be filed under one page or the other as a whole,
// so the split happens per-holding: this page shows only the account's transactions/holdings
// whose assetType matches `isIncluded`, and only lists accounts that have at least one such
// transaction. The account itself, and its holdings of *other* asset types, still exist and
// show up on the other asset-type page unaffected.
export function InvestmentsAssetPage({
  title,
  description,
  isIncluded,
  defaultAssetType,
  defaultAccountType,
  pdfSubtitle,
  filenameSuffix,
  emptyHint,
}: Props) {
  const {
    investmentAccounts,
    investmentTransactions,
    investmentPrices,
    investmentsLastSynced,
    saveInvestmentAccount,
    deleteInvestmentAccount,
    saveInvestmentTransaction,
    deleteInvestmentTransaction,
    refreshInvestmentPrices,
    isRefreshingPrices,
    profile,
  } = useStore()
  const { session } = useSession()
  const queryClient = useQueryClient()
  const userFirstName = firstName(profile?.name)
  const exportBrand = userFirstName ? `${userFirstName}'s Budget Planner Plus` : 'Budget Planner Plus'
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const pageTransactions = useMemo(
    () => investmentTransactions.filter((t) => isIncluded(t.assetType)),
    [investmentTransactions, isIncluded],
  )
  // An account belongs here either because it already has a matching-type transaction
  // (the mixed-account case), or because it was created *as* this page's default account
  // type — otherwise a brand-new account added from this page, with no transactions yet,
  // would show up nowhere until its first transaction was logged.
  const pageAccounts = useMemo(
    () =>
      investmentAccounts.filter(
        (a) => a.accountType === defaultAccountType || pageTransactions.some((t) => t.accountId === a.id),
      ),
    [investmentAccounts, pageTransactions, defaultAccountType],
  )

  // Scopes the sync to crypto-exchange accounts only (e.g. SoFi Crypto) when this page is
  // the Crypto page, so it never pulls in brokerage holdings from the same Plaid item.
  const syncScope = defaultAssetType === 'crypto' ? 'crypto' : undefined

  const syncMutation = useMutation({
    mutationFn: () => syncPlaidInvestments(syncScope),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['investmentAccounts', session?.user.id] })
      queryClient.invalidateQueries({ queryKey: ['investmentTransactions', session?.user.id] })
      queryClient.invalidateQueries({ queryKey: ['investmentsLastSynced', session?.user.id] })
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

  const invested = totalInvested(pageTransactions, pageAccounts.map((a) => a.id))
  const allHoldings = useMemo(
    () => mergeHoldingsBySymbol(pageAccounts.flatMap((a) => holdingsForAccount(pageTransactions, a.id))),
    [pageAccounts, pageTransactions],
  )
  const holdingCount = allHoldings.length
  const portfolioValue = marketValue(allHoldings, investmentPrices)
  const unrealizedGain = portfolioValue - invested

  // Every symbol logged on this page — Finnhub is queried once per symbol, not once per
  // account, since the same stock/coin costs the same API call either way.
  const heldSymbols = useMemo(() => {
    const bySymbol = new Map<string, AssetType>()
    for (const t of pageTransactions) bySymbol.set(t.symbol, t.assetType)
    return [...bySymbol.entries()].map(([symbol, assetType]) => ({ symbol, assetType }))
  }, [pageTransactions])

  const handleUpdatePrices = async () => {
    if (heldSymbols.length === 0) {
      window.alert('No holdings to price yet — log a transaction first.')
      return
    }
    try {
      const result = await refreshInvestmentPrices(heldSymbols)
      const updated = Object.keys(result.prices).length
      const skipped = result.skipped.length
      window.alert(
        `Updated ${updated} price${updated === 1 ? '' : 's'}.` +
          (skipped > 0 ? ` ${skipped} symbol${skipped === 1 ? '' : 's'} couldn't be priced.` : ''),
      )
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Price update failed.')
    }
  }

  const accountsForExport = useMemo(
    () =>
      pageAccounts.map((account) => ({
        account,
        holdings: holdingsForAccount(pageTransactions, account.id),
      })),
    [pageAccounts, pageTransactions],
  )

  const exportPdf = async () => {
    setIsExportingPdf(true)
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const margin = 40
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const today = new Date().toISOString().slice(0, 10)

      doc.setFontSize(18)
      doc.text(exportBrand, margin, 48)
      doc.setFontSize(12)
      doc.setTextColor(110)
      doc.text(`${pdfSubtitle} — ${today}`, margin, 68)

      doc.setFontSize(11)
      doc.setTextColor(20)
      doc.text(
        `Invested ${formatMoney(invested)}   Market value ${formatMoney(portfolioValue)}   ` +
          `Gain/loss ${unrealizedGain >= 0 ? '+' : ''}${formatMoney(unrealizedGain)}   ` +
          `${pageAccounts.length} account${pageAccounts.length === 1 ? '' : 's'}, ` +
          `${holdingCount} holding${holdingCount === 1 ? '' : 's'}`,
        margin,
        88,
      )

      let y = 108
      for (const { account, holdings } of accountsForExport) {
        if (y > pageHeight - 100) {
          doc.addPage()
          y = margin
        }
        const accountCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0)
        const accountMarketValue = marketValue(holdings, investmentPrices)

        doc.setFontSize(12)
        doc.setTextColor(20)
        doc.setFont('helvetica', 'bold')
        doc.text(account.name, margin, y)
        doc.setFont('helvetica', 'normal')
        doc.text(formatMoney(accountMarketValue), pageWidth - margin, y, { align: 'right' })
        doc.setFontSize(9)
        doc.setTextColor(110)
        doc.text(
          `${ACCOUNT_TYPE_LABELS[account.accountType]}${account.institution ? ` · ${account.institution}` : ''}`,
          margin,
          y + 12,
        )
        doc.text(`${formatMoney(accountCostBasis)} cost basis`, pageWidth - margin, y + 12, { align: 'right' })
        y += 24

        if (holdings.length > 0) {
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Symbol', 'Qty', 'Avg Cost', 'Cost Basis', 'Price Now', 'Market Value', 'Gain/Loss']],
            body: holdings.map((h) => {
              const priceNow = investmentPrices[h.symbol]
              const value = priceNow != null ? priceNow * h.quantity : null
              const gain = value != null ? value - h.costBasis : null
              return [
                h.symbol,
                String(h.quantity),
                formatMoney(h.avgCost),
                formatMoney(h.costBasis),
                priceNow != null ? formatMoney(priceNow) : '—',
                value != null ? formatMoney(value) : '—',
                gain != null ? `${gain >= 0 ? '+' : ''}${formatMoney(gain)}` : '—',
              ]
            }),
            headStyles: { fillColor: [31, 41, 55] },
            styles: { fontSize: 9 },
            didParseCell: (data) => {
              if (data.column.index >= 1) data.cell.styles.halign = 'right'
            },
          })
          y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
        } else {
          doc.setFontSize(9)
          doc.setTextColor(140)
          doc.text('No holdings logged.', margin, y + 10)
          y += 30
        }
      }

      doc.save(`BudgetPlannerPlus_investments_${filenameSuffix}_${today}.pdf`)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const saveAccount = () => {
    if (!editingAccount || !editingAccount.name?.trim()) return
    saveInvestmentAccount({ ...editingAccount, name: editingAccount.name.trim() })
    setEditingAccount(null)
  }

  const saveTransaction = () => {
    if (!editingTransaction || !editingTransaction.symbol?.trim() || !editingTransaction.date || !editingTransaction.accountId)
      return
    saveInvestmentTransaction({ ...editingTransaction, symbol: editingTransaction.symbol.trim().toUpperCase() })
    setEditingTransaction(null)
  }

  const addTransactionForAccount = () => {
    // Must default to a page-relevant account, not just any account overall — otherwise
    // this button can pre-select e.g. a brokerage account while on the Crypto page.
    if (pageAccounts.length === 0) {
      window.alert('Add an account first.')
      return
    }
    setEditingTransaction(emptyTransaction(pageAccounts[0].id, defaultAssetType))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">{title}</h1>
          <p className="text-[13px] text-[var(--text-soft)]">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdatePrices}
            disabled={isRefreshingPrices}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)] disabled:opacity-60"
          >
            <DollarSign size={15} /> {isRefreshingPrices ? 'Updating…' : 'Price now'}
          </button>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)] disabled:opacity-60"
            >
              <RefreshCw size={15} /> {syncMutation.isPending ? 'Syncing…' : 'Sync from bank'}
            </button>
            {investmentsLastSynced && (
              <span className="text-[11px] text-[var(--text-soft)]">
                last synced {formatRelativeTime(investmentsLastSynced)}
              </span>
            )}
          </div>
          <button
            onClick={exportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)] disabled:opacity-60"
          >
            <FileText size={15} /> {isExportingPdf ? 'Preparing PDF…' : 'Export PDF'}
          </button>
          <button
            onClick={addTransactionForAccount}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--paper)]"
          >
            <Plus size={15} /> Add transaction
          </button>
          <button
            onClick={() => setEditingAccount({ name: '', institution: '', accountType: defaultAccountType })}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90"
          >
            <Plus size={15} /> Add account
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total invested"
          value={formatMoney(invested)}
          sub="cost basis"
          icon={<TrendingUp size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Market value"
          value={formatMoney(portfolioValue)}
          sub="at last priced quote"
          icon={<DollarSign size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Unrealized gain/loss"
          value={`${unrealizedGain >= 0 ? '+' : ''}${formatMoney(unrealizedGain)}`}
          sub="market value minus cost basis"
          tone={unrealizedGain < 0 ? 'warn' : 'good'}
          icon={<TrendingUp size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Accounts"
          value={String(pageAccounts.length)}
          icon={<Landmark size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Holdings"
          value={String(holdingCount)}
          icon={<Layers size={16} className="text-[var(--text-soft)]" />}
        />
      </div>

      {allHoldings.length > 0 && (
        <Card title="Gain/loss by holding">
          <HoldingsGainLoss holdings={allHoldings} prices={investmentPrices} />
        </Card>
      )}

      {pageAccounts.length === 0 && <p className="text-[13px] text-[var(--text-soft)]">{emptyHint}</p>}

      <div className="space-y-4">
        {pageAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            transactions={pageTransactions.filter((t) => t.accountId === account.id)}
            prices={investmentPrices}
            onEditAccount={() => setEditingAccount({ ...account })}
            onDeleteAccount={() => {
              if (window.confirm(`Delete "${account.name}" and all its transactions? This cannot be undone.`))
                deleteInvestmentAccount(account.id)
            }}
            onAddTransaction={() => setEditingTransaction(emptyTransaction(account.id, defaultAssetType))}
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
                value={editingAccount.accountType ?? defaultAccountType}
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

            <label className="mb-4 block">
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-soft)]">Account</span>
              <select
                value={editingTransaction.accountId}
                onChange={(e) => setEditingTransaction({ ...editingTransaction, accountId: e.target.value })}
                className="input"
              >
                {investmentAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

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
                  value={editingTransaction.assetType ?? defaultAssetType}
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
  prices,
  onEditAccount,
  onDeleteAccount,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}: {
  account: InvestmentAccount
  transactions: InvestmentTransaction[]
  prices: Record<string, number>
  onEditAccount: () => void
  onDeleteAccount: () => void
  onAddTransaction: () => void
  onEditTransaction: (t: InvestmentTransaction) => void
  onDeleteTransaction: (id: string) => void
}) {
  const holdings = holdingsForAccount(transactions, account.id)
  const accountCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0)
  const accountMarketValue = marketValue(holdings, prices)
  const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

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
          <div className="text-right">
            <p className="font-mono text-[15px] font-medium text-[var(--ink)]">{formatMoney(accountMarketValue)}</p>
            <p className="font-mono text-[11px] text-[var(--text-soft)]">{formatMoney(accountCostBasis)} cost basis</p>
          </div>
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
        <div className="mb-4">
          <p className="mb-2 text-[12px] uppercase tracking-wide text-[var(--text-soft)]">Holdings</p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-soft)]">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Avg Cost</th>
                  <th className="px-3 py-2 text-right font-medium">Cost Basis</th>
                  <th className="px-3 py-2 text-right font-medium">Price Now</th>
                  <th className="px-3 py-2 text-right font-medium">Market Value</th>
                  <th className="px-3 py-2 text-right font-medium">Gain/Loss</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const priceNow = prices[h.symbol]
                  const value = priceNow != null ? priceNow * h.quantity : null
                  const gain = value != null ? value - h.costBasis : null
                  const gainPct = gain != null && h.costBasis > 0 ? (gain / h.costBasis) * 100 : null
                  return (
                    <tr key={h.symbol} className="border-b border-[var(--border-soft)] last:border-0">
                      <td className="px-3 py-2 font-medium text-[var(--ink)]">{h.symbol}</td>
                      <td className="px-3 py-2 text-right font-mono">{h.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatMoney(h.avgCost)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatMoney(h.costBasis)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {priceNow != null ? formatMoney(priceNow) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{value != null ? formatMoney(value) : '—'}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          gain == null ? '' : gain >= 0 ? 'text-[var(--primary)]' : 'text-[var(--warn)]'
                        }`}
                      >
                        {gain != null && gainPct != null
                          ? `${gain >= 0 ? '+' : ''}${formatMoney(gain)} (${gainPct.toFixed(1)}%)`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] uppercase tracking-wide text-[var(--text-soft)]">Transactions</p>
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--text-soft)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <Plus size={13} /> Add transaction
        </button>
      </div>

      {sortedTransactions.length === 0 ? (
        <p className="text-[13px] text-[var(--text-soft)]">No transactions logged yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border-soft)]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">QTY</th>
                <th className="px-3 py-2 text-right font-medium">Buy Price</th>
                <th className="px-3 py-2 font-medium">Buy date</th>
                <th className="px-3 py-2 text-right font-medium">Price Now</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b border-[var(--border-soft)] last:border-0 hover:bg-[var(--paper)]"
                  onClick={() => onEditTransaction(t)}
                >
                  <td className="px-3 py-2 font-medium text-[var(--ink)]">{t.symbol}</td>
                  <td className="px-3 py-2 text-[var(--text-soft)]">{ASSET_TYPE_LABELS[t.assetType]}</td>
                  <td className="px-3 py-2 text-right font-mono">{t.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(t.pricePerUnit)}</td>
                  <td className="px-3 py-2 text-[var(--text-soft)]">{formatDate(t.date)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {prices[t.symbol] != null ? formatMoney(prices[t.symbol]) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteTransaction(t.id)
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md text-[var(--warn)] hover:bg-[var(--warn-soft)]"
                      aria-label="Delete transaction"
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
    </div>
  )
}
