import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { DollarSign, FileText, Plus, Trash2 } from 'lucide-react-native'
import { v4 as uuidv4 } from 'uuid'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import {
  useDeleteInvestmentAccount,
  useInvestmentAccounts,
  useInvestmentPrices,
  useInvestmentTransactions,
  useRefreshInvestmentPrices,
  useSaveInvestmentAccount,
  useSaveInvestmentTransaction,
} from '../hooks/useAppData'
import { holdingsForAccount, marketValue, totalInvested } from '../data/selectors'
import type { AssetType, InvestmentAccount, InvestmentAccountType, InvestmentTransaction } from '../types'
import { formatMoney } from '../utils/format'
import { colors } from '../theme'
import { HoldingsGainLoss } from './HoldingsGainLoss'

const ACCOUNT_TYPE_LABELS: Record<InvestmentAccountType, string> = {
  brokerage: 'Brokerage',
  crypto: 'Crypto exchange',
  retirement: 'Retirement',
  other: 'Other',
}

function confirmDelete(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm()
    return
  }
  Alert.alert('Delete', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ])
}

interface Props {
  title: string
  // The Crypto screen already has a native header showing its title — skip the
  // redundant in-body heading there; the main Investments tab has no native
  // header (tab screens hide it), so it renders its own.
  showTitleText?: boolean
  description: string
  isIncluded: (assetType: AssetType) => boolean
  defaultAssetType: AssetType
  // Which existing accounts belong on this screen by account type alone (the crypto
  // screen wants exactly 'crypto'; the main screen wants everything else — retirement
  // and other accounts included, not just brokerage). `newAccountType` is the single
  // concrete type assigned when this screen creates a brand-new account.
  isDefaultAccountType: (accountType: InvestmentAccountType) => boolean
  newAccountType: InvestmentAccountType
  pdfSubtitle: string
  emptyHint: string
  sectionLabel?: string
  footerLink?: { label: string; href: '/investments-crypto' }
}

// Some accounts hold a mix of asset types (a brokerage account with both stocks and a
// little crypto, say) — an account can't be filed under one screen or the other as a
// whole, so the split happens per-holding: this screen shows only the account's
// transactions/holdings whose assetType matches `isIncluded`, and only lists accounts
// that have at least one such transaction (mirrors web's InvestmentsAssetPage).
export function InvestmentsAssetScreen({
  title,
  showTitleText = true,
  description,
  isIncluded,
  defaultAssetType,
  isDefaultAccountType,
  newAccountType,
  pdfSubtitle,
  emptyHint,
  sectionLabel,
  footerLink,
}: Props) {
  const accounts = useInvestmentAccounts()
  const transactions = useInvestmentTransactions()
  const prices = useInvestmentPrices()
  const saveAccount = useSaveInvestmentAccount()
  const deleteAccount = useDeleteInvestmentAccount()
  const saveTransaction = useSaveInvestmentTransaction()
  const refreshPrices = useRefreshInvestmentPrices()
  const router = useRouter()
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const accountList = accounts.data ?? []
  const txns = transactions.data ?? []
  const priceMap = prices.data ?? {}

  const pageTransactions = useMemo(() => txns.filter((t) => isIncluded(t.assetType)), [txns, isIncluded])
  // An account belongs here either because it already has a matching-type transaction
  // (the mixed-account case), or because its own account type belongs on this screen —
  // otherwise a brand-new account added from this screen, with no transactions yet,
  // would show up nowhere until its first transaction was logged.
  const pageAccounts = useMemo(
    () =>
      accountList.filter(
        (a) => isDefaultAccountType(a.accountType) || pageTransactions.some((t) => t.accountId === a.id),
      ),
    [accountList, pageTransactions, isDefaultAccountType],
  )

  // Every symbol logged on this screen — Finnhub is queried once per symbol, not once
  // per account, since the same stock/coin costs the same API call either way.
  const heldSymbols = useMemo(() => {
    const bySymbol = new Map<string, AssetType>()
    for (const t of pageTransactions) bySymbol.set(t.symbol, t.assetType)
    return [...bySymbol.entries()].map(([symbol, assetType]) => ({ symbol, assetType }))
  }, [pageTransactions])

  if (accounts.isLoading || transactions.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const invested = totalInvested(pageTransactions, pageAccounts.map((a) => a.id))
  const allHoldings = pageAccounts.flatMap((a) => holdingsForAccount(pageTransactions, a.id))
  const holdingCount = allHoldings.length
  const portfolioValue = marketValue(allHoldings, priceMap)
  const unrealizedGain = portfolioValue - invested

  const handleUpdatePrices = async () => {
    if (heldSymbols.length === 0) {
      Alert.alert('No holdings to price yet', 'Log a transaction first.')
      return
    }
    try {
      const result = await refreshPrices.mutateAsync(heldSymbols)
      const updated = Object.keys(result.prices).length
      const skipped = result.skipped.length
      Alert.alert(
        'Prices updated',
        `Updated ${updated} price${updated === 1 ? '' : 's'}.` +
          (skipped > 0 ? ` ${skipped} symbol${skipped === 1 ? '' : 's'} couldn't be priced.` : ''),
      )
    } catch (err) {
      Alert.alert('Price update failed', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const exportPdf = async () => {
    setIsExportingPdf(true)
    try {
      const html = buildInvestmentsHtml({
        pdfSubtitle,
        accounts: pageAccounts,
        transactionsByAccount: pageTransactions,
        prices: priceMap,
        invested,
        portfolioValue,
        unrealizedGain,
        holdingCount,
      })
      const { uri } = await Print.printToFileAsync({ html })
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: `${pdfSubtitle} PDF` })
      } else {
        Alert.alert('PDF saved', uri)
      }
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Waits for the save to actually land before navigating — pushing to the detail screen
  // on a fire-and-forget mutate() left the user stranded on that screen's permanent
  // loading spinner (it looks up the new record by id, which never arrives) whenever the
  // save failed, with no error shown and the record never created.
  const addAccount = async () => {
    const id = uuidv4()
    try {
      await saveAccount.mutateAsync({ id, name: 'New account', institution: '', accountType: newAccountType })
      router.push(`/investment-account/${id}`)
    } catch (err) {
      Alert.alert('Could not add account', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const addTransaction = async (accountId: string) => {
    const id = uuidv4()
    try {
      await saveTransaction.mutateAsync({
        id,
        accountId,
        symbol: '',
        assetType: defaultAssetType,
        transactionType: 'buy',
        quantity: 0,
        pricePerUnit: 0,
        fees: 0,
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      router.push(`/investment-transaction/${id}`)
    } catch (err) {
      Alert.alert('Could not add transaction', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {showTitleText && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.subtitle}>{description}</Text>
        {footerLink && (
          <Pressable onPress={() => router.push(footerLink.href)}>
            <Text style={styles.link}>{footerLink.label}</Text>
          </Pressable>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.priceNowButton} onPress={handleUpdatePrices} disabled={refreshPrices.isPending}>
            <DollarSign size={15} color={colors.ink} />
            <Text style={styles.priceNowText}>{refreshPrices.isPending ? 'Updating…' : 'Price now'}</Text>
          </Pressable>
          <Pressable style={styles.priceNowButton} onPress={exportPdf} disabled={isExportingPdf}>
            <FileText size={15} color={colors.ink} />
            <Text style={styles.priceNowText}>{isExportingPdf ? 'Preparing…' : 'Export PDF'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.summaryGrid}>
            <SummaryStat label="Invested" value={formatMoney(invested)} />
            <SummaryStat label="Market value" value={formatMoney(portfolioValue)} />
            <SummaryStat
              label="Gain/loss"
              value={`${unrealizedGain >= 0 ? '+' : ''}${formatMoney(unrealizedGain)}`}
              tone={unrealizedGain < 0 ? 'warn' : 'good'}
            />
            <SummaryStat label="Accounts" value={String(pageAccounts.length)} />
            <SummaryStat label="Holdings" value={String(holdingCount)} />
          </View>
        </View>

        {allHoldings.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gain/loss by holding</Text>
            <HoldingsGainLoss holdings={allHoldings} prices={priceMap} />
          </View>
        )}

        {pageAccounts.length === 0 && <Text style={styles.empty}>{emptyHint}</Text>}

        {pageAccounts.length > 0 && (
          <View style={{ gap: 16 }}>
            {sectionLabel && <Text style={styles.sectionLabel}>{sectionLabel}</Text>}
            {pageAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                transactions={pageTransactions.filter((t) => t.accountId === account.id)}
                prices={priceMap}
                onEditAccount={() => router.push(`/investment-account/${account.id}`)}
                onDeleteAccount={() =>
                  confirmDelete(`Delete "${account.name}" and all its transactions?`, () =>
                    deleteAccount.mutate(account.id),
                  )
                }
                onAddTransaction={() => addTransaction(account.id)}
                onOpenTransaction={(t) => router.push(`/investment-transaction/${t.id}`)}
              />
            ))}
          </View>
        )}

        <Pressable style={styles.addAccountButton} onPress={addAccount}>
          <Plus size={15} color={colors.textSoft} />
          <Text style={styles.addAccountText}>Add account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'good' && { color: colors.primary },
          tone === 'warn' && { color: colors.warn },
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

function AccountCard({
  account,
  transactions,
  prices,
  onEditAccount,
  onDeleteAccount,
  onAddTransaction,
  onOpenTransaction,
}: {
  account: InvestmentAccount
  transactions: InvestmentTransaction[]
  prices: Record<string, number>
  onEditAccount: () => void
  onDeleteAccount: () => void
  onAddTransaction: () => void
  onOpenTransaction: (t: InvestmentTransaction) => void
}) {
  const holdings = holdingsForAccount(transactions, account.id)
  const costBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0)
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  return (
    <View style={styles.card}>
      <Pressable onPress={onEditAccount} style={styles.accountHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountName}>{account.name}</Text>
          <Text style={styles.accountMeta}>
            {ACCOUNT_TYPE_LABELS[account.accountType]}
            {account.institution ? ` · ${account.institution}` : ''}
          </Text>
        </View>
        <Text style={styles.accountTotal}>{formatMoney(costBasis)}</Text>
        <Pressable onPress={onDeleteAccount} hitSlop={8}>
          <Trash2 size={15} color={colors.textSoft} />
        </Pressable>
      </Pressable>

      {holdings.length > 0 && (
        <View style={styles.holdings}>
          {holdings.map((h) => {
            const priceNow = prices[h.symbol]
            const value = priceNow != null ? priceNow * h.quantity : null
            const gain = value != null ? value - h.costBasis : null
            return (
              <View key={h.symbol} style={styles.holdingBlock}>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                  <Text style={styles.holdingDetail}>
                    {h.quantity} @ {formatMoney(h.avgCost)}
                  </Text>
                  <Text style={styles.holdingCost}>{formatMoney(h.costBasis)}</Text>
                </View>
                <View style={styles.holdingRow}>
                  <Text style={styles.holdingPriceLabel}>
                    {priceNow != null ? `Now ${formatMoney(priceNow)}` : 'Price not fetched'}
                  </Text>
                  {value != null && gain != null && (
                    <Text style={[styles.holdingGain, { color: gain < 0 ? colors.warn : colors.primary }]}>
                      {formatMoney(value)} ({gain >= 0 ? '+' : ''}
                      {formatMoney(gain)})
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      )}

      {recent.length > 0 && (
        <View style={styles.recentList}>
          {recent.map((t) => (
            <Pressable key={t.id} style={styles.recentRow} onPress={() => onOpenTransaction(t)}>
              <Text style={styles.recentText}>
                {t.symbol || '(no symbol)'} — {t.transactionType} {t.quantity}
              </Text>
              <Text style={styles.recentDate}>{t.date.slice(0, 10)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable style={styles.addItemButton} onPress={onAddTransaction}>
        <Plus size={13} color={colors.primary} />
        <Text style={styles.addItemText}>Add transaction</Text>
      </Pressable>
    </View>
  )
}

// account.name/institution are free-text user input — escaped before landing in the
// HTML string handed to expo-print, same reasoning as escaping user input into any
// other HTML document.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildInvestmentsHtml({
  pdfSubtitle,
  accounts,
  transactionsByAccount,
  prices,
  invested,
  portfolioValue,
  unrealizedGain,
  holdingCount,
}: {
  pdfSubtitle: string
  accounts: InvestmentAccount[]
  transactionsByAccount: InvestmentTransaction[]
  prices: Record<string, number>
  invested: number
  portfolioValue: number
  unrealizedGain: number
  holdingCount: number
}): string {
  const today = new Date().toISOString().slice(0, 10)

  const accountsHtml = accounts
    .map((account) => {
      const holdings = holdingsForAccount(transactionsByAccount, account.id)
      const costBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0)
      const rowsHtml = holdings
        .map((h) => {
          const priceNow = prices[h.symbol]
          const value = priceNow != null ? priceNow * h.quantity : null
          const gain = value != null ? value - h.costBasis : null
          const gainClass = gain == null ? '' : gain >= 0 ? 'gain' : 'loss'
          return `<tr>
            <td>${escapeHtml(h.symbol)}</td>
            <td>${h.quantity}</td>
            <td>${formatMoney(h.avgCost)}</td>
            <td>${formatMoney(h.costBasis)}</td>
            <td>${priceNow != null ? formatMoney(priceNow) : '—'}</td>
            <td>${value != null ? formatMoney(value) : '—'}</td>
            <td class="${gainClass}">${gain != null ? `${gain >= 0 ? '+' : ''}${formatMoney(gain)}` : '—'}</td>
          </tr>`
        })
        .join('')

      const tableHtml =
        holdings.length > 0
          ? `<table>
            <thead><tr><th>Symbol</th><th>Qty</th><th>Avg Cost</th><th>Cost Basis</th><th>Price Now</th><th>Market Value</th><th>Gain/Loss</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>`
          : `<p class="empty">No holdings logged.</p>`

      return `<div class="account">
        <div class="account-header">
          <span>${escapeHtml(account.name)}</span>
          <span>${formatMoney(costBasis)}</span>
        </div>
        <div class="account-meta">${escapeHtml(ACCOUNT_TYPE_LABELS[account.accountType])}${account.institution ? ` · ${escapeHtml(account.institution)}` : ''}</div>
        ${tableHtml}
      </div>`
    })
    .join('')

  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: ${colors.ink}; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .subtitle { color: ${colors.textSoft}; font-size: 13px; margin: 0 0 16px; }
      .summary { font-size: 13px; margin-bottom: 20px; }
      .account { margin-bottom: 20px; page-break-inside: avoid; }
      .account-header { display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; }
      .account-meta { color: ${colors.textSoft}; font-size: 11px; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: ${colors.ink}; color: #fff; text-align: right; padding: 6px 8px; }
      th:first-child { text-align: left; }
      td { padding: 6px 8px; border-bottom: 1px solid ${colors.borderSoft}; text-align: right; }
      td:first-child { text-align: left; font-weight: 600; }
      .gain { color: ${colors.primary}; }
      .loss { color: ${colors.warn}; }
      .empty { color: ${colors.textSoft}; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>Budget Planner Plus</h1>
    <p class="subtitle">${escapeHtml(pdfSubtitle)} — ${today}</p>
    <p class="summary">
      <strong>Invested</strong> ${formatMoney(invested)} &nbsp;
      <strong>Market value</strong> ${formatMoney(portfolioValue)} &nbsp;
      <strong>Gain/loss</strong> ${unrealizedGain >= 0 ? '+' : ''}${formatMoney(unrealizedGain)} &nbsp;
      ${accounts.length} account${accounts.length === 1 ? '' : 's'}, ${holdingCount} holding${holdingCount === 1 ? '' : 's'}
    </p>
    ${accountsHtml}
  </body>
  </html>`
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: -8 },
  link: { fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: -8 },
  empty: { fontSize: 13, color: colors.textSoft },
  actionsRow: { flexDirection: 'row', gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  priceNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  priceNowText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSoft,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  summaryStat: { minWidth: 90 },
  summaryLabel: { fontSize: 10, color: colors.textSoft, letterSpacing: 0.5, textTransform: 'uppercase' },
  summaryValue: { fontSize: 17, fontWeight: '600', color: colors.ink, marginTop: 2 },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  accountMeta: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  accountTotal: { fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  holdings: { gap: 8, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 8 },
  holdingBlock: { gap: 2 },
  holdingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  holdingSymbol: { fontSize: 12.5, fontWeight: '600', color: colors.ink, width: 60 },
  holdingDetail: { fontSize: 12, color: colors.textSoft, flex: 1 },
  holdingCost: { fontSize: 12.5, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  holdingPriceLabel: { fontSize: 11.5, color: colors.textSoft, width: 60 + 8 },
  holdingGain: { fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  recentList: { gap: 4, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 8 },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  recentText: { fontSize: 12.5, color: colors.ink },
  recentDate: { fontSize: 11.5, color: colors.textSoft },
  addItemButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  addItemText: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addAccountText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
