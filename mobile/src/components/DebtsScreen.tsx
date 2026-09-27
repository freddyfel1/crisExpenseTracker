import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native'
import { v4 as uuidv4 } from 'uuid'
import {
  useDebtPayments,
  useDebts,
  useDeleteDebt,
  useDeleteDebtPayment,
  useSaveDebt,
  useSaveDebtPayment,
} from '../hooks/useAppData'
import { compareEarlyRepayment, debtLedger, projectAmortization } from '../data/selectors'
import type { Debt, DebtPayment, DebtType } from '../types'
import { formatMoney } from '../utils/format'
import { colors } from '../theme'

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  mortgage: 'Mortgage',
  personal_loan: 'Personal loan',
  credit_card: 'Credit card',
  friend_loan: 'Loan to a friend',
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

export function DebtsScreen() {
  const debts = useDebts()
  const payments = useDebtPayments()
  const saveDebt = useSaveDebt()
  const deleteDebt = useDeleteDebt()
  const saveDebtPayment = useSaveDebtPayment()
  const deleteDebtPayment = useDeleteDebtPayment()
  const router = useRouter()

  const debtList = debts.data ?? []
  const paymentList = payments.data ?? []

  const balances = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of debtList) {
      const ledger = debtLedger(d, paymentList)
      map.set(d.id, ledger.length > 0 ? ledger[ledger.length - 1].balanceAfter : d.principal)
    }
    return map
  }, [debtList, paymentList])

  if (debts.isLoading || payments.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const totalPrincipal = debtList.reduce((sum, d) => sum + d.principal, 0)
  const totalBalance = debtList.reduce((sum, d) => sum + (balances.get(d.id) ?? d.principal), 0)
  const totalMonthlyPayment = debtList.reduce((sum, d) => sum + d.monthlyPayment, 0)
  const paidOffPct = totalPrincipal > 0 ? ((totalPrincipal - totalBalance) / totalPrincipal) * 100 : 0

  const addDebt = async () => {
    const id = uuidv4()
    try {
      await saveDebt.mutateAsync({
        id,
        name: 'New debt',
        debtType: 'other',
        institution: '',
        principal: 0,
        interestRate: 0,
        termMonths: 0,
        monthlyPayment: 0,
        startDate: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      router.push(`/debt/${id}`)
    } catch (err) {
      Alert.alert('Could not add debt', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const addPayment = async (debtId: string) => {
    const id = uuidv4()
    try {
      await saveDebtPayment.mutateAsync({
        id,
        debtId,
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      router.push(`/debt-payment/${id}`)
    } catch (err) {
      Alert.alert('Could not log payment', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Debts</Text>
        <Text style={styles.subtitle}>Your loans and credit, and what's left to pay off.</Text>

        <View style={styles.card}>
          <View style={styles.summaryGrid}>
            <SummaryStat label="Total debt" value={formatMoney(totalBalance)} />
            <SummaryStat label="Monthly payments" value={formatMoney(totalMonthlyPayment)} />
            <SummaryStat label="Debts" value={String(debtList.length)} />
            <SummaryStat label="Paid off" value={`${paidOffPct.toFixed(0)}%`} tone="good" />
          </View>
        </View>

        {debtList.length === 0 && (
          <Text style={styles.empty}>No debts tracked yet — add a mortgage, loan, or credit card to see it here.</Text>
        )}

        <View style={{ gap: 16 }}>
          {debtList.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              payments={paymentList.filter((p) => p.debtId === debt.id)}
              onEdit={() => router.push(`/debt/${debt.id}`)}
              onDelete={() =>
                confirmDelete(`Delete "${debt.name}" and all its logged payments?`, () => deleteDebt.mutate(debt.id))
              }
              onAddPayment={() => addPayment(debt.id)}
              onEditPayment={(p) => router.push(`/debt-payment/${p.id}`)}
              onDeletePayment={(id) =>
                confirmDelete('Delete this payment?', () => deleteDebtPayment.mutate(id))
              }
            />
          ))}
        </View>

        <Pressable style={styles.addButton} onPress={addDebt}>
          <Plus size={15} color={colors.textSoft} />
          <Text style={styles.addButtonText}>Add a debt</Text>
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
  const [extraText, setExtraText] = useState('0')

  const ledger = useMemo(() => debtLedger(debt, payments), [debt, payments])
  const balance = ledger.length > 0 ? ledger[ledger.length - 1].balanceAfter : debt.principal
  const pctRepaid = debt.principal > 0 ? Math.min(((debt.principal - balance) / debt.principal) * 100, 100) : 0
  const extraPayment = Math.max(Number(extraText) || 0, 0)

  const paymentsLeft = useMemo(
    () => (debt.monthlyPayment > 0 ? projectAmortization(balance, debt.interestRate, debt.monthlyPayment).length : 0),
    [balance, debt.interestRate, debt.monthlyPayment],
  )

  const comparison = useMemo(
    () =>
      debt.monthlyPayment > 0
        ? compareEarlyRepayment(balance, debt.interestRate, debt.monthlyPayment, extraPayment)
        : null,
    [balance, debt.interestRate, debt.monthlyPayment, extraPayment],
  )

  const recent = [...ledger].reverse().slice(0, 5)

  return (
    <View style={styles.card}>
      <Pressable onPress={onEdit} style={styles.debtHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.debtName}>{debt.name}</Text>
          <Text style={styles.debtMeta}>
            {DEBT_TYPE_LABELS[debt.debtType]}
            {debt.interestRate > 0 ? ` · ${debt.interestRate}%` : ''}
            {debt.institution ? ` · ${debt.institution}` : ''}
          </Text>
          <Text style={styles.debtMeta}>
            {paymentsLeft > 0
              ? `${paymentsLeft} payment${paymentsLeft === 1 ? '' : 's'} left`
              : debt.monthlyPayment > 0
                ? 'payment covers interest only'
                : 'no scheduled payment set'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.debtBalance}>{formatMoney(balance)}</Text>
          <Text style={styles.debtSub}>per month: {formatMoney(debt.monthlyPayment)}</Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Trash2 size={15} color={colors.textSoft} />
        </Pressable>
      </Pressable>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pctRepaid}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{pctRepaid.toFixed(0)}% repaid</Text>

      {recent.length > 0 && (
        <View style={styles.recentList}>
          {recent.map((entry) => (
            <Pressable key={entry.id} style={styles.recentRow} onPress={() => onEditPayment(entry)}>
              <Text style={styles.recentText}>{formatMoney(entry.amount)} paid</Text>
              <Text style={styles.recentDate}>{entry.date.slice(0, 10)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.addItemButton} onPress={onAddPayment}>
          <Plus size={13} color={colors.primary} />
          <Text style={styles.addItemText}>Log payment</Text>
        </Pressable>
        {debt.monthlyPayment > 0 && (
          <Pressable style={styles.addItemButton} onPress={() => setShowSchedule((v) => !v)}>
            {showSchedule ? <ChevronUp size={13} color={colors.textSoft} /> : <ChevronDown size={13} color={colors.textSoft} />}
            <Text style={styles.toggleText}>Early payoff</Text>
          </Pressable>
        )}
      </View>

      {showSchedule && debt.monthlyPayment > 0 && comparison && (
        <View style={styles.schedulePanel}>
          <Text style={styles.scheduleTitle}>Early repayment</Text>
          <Text style={styles.fieldLabel}>Extra monthly payment</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={extraText}
            onFocus={() => setExtraText('')}
            onChangeText={setExtraText}
            onBlur={() => setExtraText(String(extraPayment))}
          />

          <View style={styles.summaryGrid}>
            <SummaryStat label="Months saved" value={String(comparison.monthsSaved)} tone="good" />
            <SummaryStat label="Interest saved" value={formatMoney(comparison.interestSaved)} tone="good" />
            <SummaryStat label="Payoff date" value={comparison.newPayoffDate ?? '—'} />
          </View>

          <Text style={styles.fieldLabel}>Schedule (next payments)</Text>
          {comparison.withExtra.slice(0, 12).map((row) => (
            <View key={row.month} style={styles.scheduleRow}>
              <Text style={styles.scheduleDate}>{row.date}</Text>
              <Text style={styles.scheduleValue}>int {formatMoney(row.interest)}</Text>
              <Text style={styles.scheduleValue}>prin {formatMoney(row.principal)}</Text>
              <Text style={styles.scheduleBalance}>{formatMoney(row.balance)}</Text>
            </View>
          ))}
          {comparison.withExtra.length > 12 && (
            <Text style={styles.scheduleMore}>+{comparison.withExtra.length - 12} more months</Text>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: -8 },
  empty: { fontSize: 13, color: colors.textSoft },
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
  debtHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  debtName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  debtMeta: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  debtBalance: { fontSize: 15, fontWeight: '600', color: colors.warn, fontVariant: ['tabular-nums'] },
  debtSub: { fontSize: 11, color: colors.textSoft, fontVariant: ['tabular-nums'], marginTop: 2 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.paper, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.warn, borderRadius: 3 },
  progressLabel: { fontSize: 11.5, color: colors.textSoft },
  recentList: { gap: 4, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 8 },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  recentText: { fontSize: 12.5, color: colors.ink },
  recentDate: { fontSize: 11.5, color: colors.textSoft },
  actionsRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  addItemButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addItemText: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  toggleText: { fontSize: 12.5, fontWeight: '600', color: colors.textSoft },
  schedulePanel: {
    gap: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 10,
  },
  scheduleTitle: { fontSize: 13, fontWeight: '600', color: colors.ink },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textSoft, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.ink,
    maxWidth: 140,
  },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  scheduleDate: { fontSize: 11.5, color: colors.textSoft, width: 56 },
  scheduleValue: { fontSize: 11.5, color: colors.textSoft, flex: 1, textAlign: 'right' },
  scheduleBalance: { fontSize: 11.5, fontWeight: '600', color: colors.ink, width: 70, textAlign: 'right' },
  scheduleMore: { fontSize: 11.5, color: colors.textSoft, fontStyle: 'italic' },
  addButton: {
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
  addButtonText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
