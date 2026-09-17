import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Trash2 } from 'lucide-react-native'
import { v4 as uuidv4 } from 'uuid'
import {
  useDeleteInvestmentAccount,
  useInvestmentAccounts,
  useInvestmentTransactions,
  useSaveInvestmentAccount,
  useSaveInvestmentTransaction,
} from '../../src/hooks/useAppData'
import { holdingsForAccount, totalInvested } from '../../src/data/selectors'
import type { InvestmentAccount, InvestmentAccountType, InvestmentTransaction } from '../../src/types'
import { formatMoney } from '../../src/utils/format'
import { colors } from '../../src/theme'

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

export default function InvestmentsScreen() {
  const accounts = useInvestmentAccounts()
  const transactions = useInvestmentTransactions()
  const saveAccount = useSaveInvestmentAccount()
  const deleteAccount = useDeleteInvestmentAccount()
  const saveTransaction = useSaveInvestmentTransaction()
  const router = useRouter()

  if (accounts.isLoading || transactions.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const accountList = accounts.data ?? []
  const txns = transactions.data ?? []
  const invested = totalInvested(txns, accountList.map((a) => a.id))
  const holdingCount = accountList.reduce((sum, a) => sum + holdingsForAccount(txns, a.id).length, 0)
  const nonCryptoAccounts = accountList.filter((a) => a.accountType !== 'crypto')
  const cryptoAccounts = accountList.filter((a) => a.accountType === 'crypto')

  const addAccount = () => {
    const id = uuidv4()
    saveAccount.mutate({ id, name: 'New account', institution: '', accountType: 'brokerage' })
    router.push(`/investment-account/${id}`)
  }

  const addTransaction = (accountId: string) => {
    const id = uuidv4()
    saveTransaction.mutate({
      id,
      accountId,
      symbol: '',
      assetType: 'etf',
      transactionType: 'buy',
      quantity: 0,
      pricePerUnit: 0,
      fees: 0,
      date: new Date().toISOString().slice(0, 10),
      notes: '',
    })
    router.push(`/investment-transaction/${id}`)
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Investments</Text>
        <Text style={styles.subtitle}>ETFs, crypto, and other holdings you track by hand.</Text>

        <View style={styles.card}>
          <View style={styles.summaryGrid}>
            <SummaryStat label="Invested" value={formatMoney(invested)} />
            <SummaryStat label="Accounts" value={String(accountList.length)} />
            <SummaryStat label="Holdings" value={String(holdingCount)} />
          </View>
        </View>

        {accountList.length === 0 && (
          <Text style={styles.empty}>No investment accounts yet — add one to start logging buys and sells.</Text>
        )}

        {nonCryptoAccounts.length > 0 && (
          <View style={{ gap: 16 }}>
            <Text style={styles.sectionLabel}>Stocks, ETFs & other</Text>
            {nonCryptoAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                transactions={txns.filter((t) => t.accountId === account.id)}
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

        {cryptoAccounts.length > 0 && (
          <View style={{ gap: 16 }}>
            <Text style={styles.sectionLabel}>Crypto</Text>
            {cryptoAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                transactions={txns.filter((t) => t.accountId === account.id)}
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

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  )
}

function AccountCard({
  account,
  transactions,
  onEditAccount,
  onDeleteAccount,
  onAddTransaction,
  onOpenTransaction,
}: {
  account: InvestmentAccount
  transactions: InvestmentTransaction[]
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
          {holdings.map((h) => (
            <View key={h.symbol} style={styles.holdingRow}>
              <Text style={styles.holdingSymbol}>{h.symbol}</Text>
              <Text style={styles.holdingDetail}>
                {h.quantity} @ {formatMoney(h.avgCost)}
              </Text>
              <Text style={styles.holdingCost}>{formatMoney(h.costBasis)}</Text>
            </View>
          ))}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: -8 },
  empty: { fontSize: 13, color: colors.textSoft },
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
  holdings: { gap: 4, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 8 },
  holdingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  holdingSymbol: { fontSize: 12.5, fontWeight: '600', color: colors.ink, width: 60 },
  holdingDetail: { fontSize: 12, color: colors.textSoft, flex: 1 },
  holdingCost: { fontSize: 12.5, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
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
