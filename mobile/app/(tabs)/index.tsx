import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCategories, useMonthlyIncomes, useSaveMonthlyIncome, useTransactions } from '../../src/hooks/useAppData'
import { monthlyIncomeEntryForMonth, spendByCategory, totalSpend, transactionsForMonth } from '../../src/data/selectors'
import { usePeriod } from '../../src/data/period'
import { formatMoney, monthKeyLabel } from '../../src/utils/format'
import { colors } from '../../src/theme'
import { MonthPicker } from '../../src/components/MonthPicker'

export default function Home() {
  const transactions = useTransactions()
  const categories = useCategories()
  const monthlyIncomes = useMonthlyIncomes()
  const saveMonthlyIncome = useSaveMonthlyIncome()
  const queryClient = useQueryClient()
  const { month } = usePeriod()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }, [queryClient])

  if (transactions.isLoading || categories.isLoading || monthlyIncomes.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const monthTxns = transactionsForMonth(transactions.data ?? [], month)
  const spend = spendByCategory(monthTxns)
  const spent = totalSpend(monthTxns)
  const { monthlyIncome, otherIncome } = monthlyIncomeEntryForMonth(monthlyIncomes.data ?? [], month)
  const income = monthlyIncome + otherIncome
  const difference = income - spent
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]))

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Your financial position for {monthKeyLabel(month)}</Text>
        <MonthPicker />

        <View style={styles.statRow}>
          <EditableStat
            label="INCOME"
            value={monthlyIncome}
            onSave={(v) => saveMonthlyIncome.mutate({ monthKey: month, monthlyIncome: v })}
          />
          <EditableStat
            label="OTHER INCOME"
            value={otherIncome}
            onSave={(v) => saveMonthlyIncome.mutate({ monthKey: month, otherIncome: v })}
          />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL EXPENSE</Text>
            <Text style={styles.statValue}>{formatMoney(spent)}</Text>
            <Text style={styles.statSub}>{monthTxns.length} transactions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>DIFFERENCE</Text>
            <Text style={[styles.statValue, { color: difference < 0 ? colors.warn : colors.primary }]}>
              {formatMoney(difference)}
            </Text>
            <Text style={styles.statSub}>income minus expense</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category breakdown</Text>
          {spend.length === 0 && <Text style={styles.statSub}>No spending recorded this month.</Text>}
          {spend.slice(0, 8).map((s) => {
            const category = s.categoryId ? categoryById.get(s.categoryId) : undefined
            const pct = spent > 0 ? Math.round((s.total / spent) * 100) : 0
            return (
              <View key={s.categoryId ?? 'uncategorized'} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: category?.color ?? colors.textSoft }]} />
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {category?.name ?? 'Uncategorized'}
                </Text>
                <Text style={styles.rowPct}>{pct}%</Text>
                <Text style={styles.rowAmount}>{formatMoney(s.total)}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function EditableStat({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const commit = () => {
    // Number('') is 0, not NaN — an emptied field must not silently save as $0.
    const parsed = draft.trim() === '' ? NaN : Number(draft)
    if (!Number.isNaN(parsed)) onSave(parsed)
    setEditing(false)
  }

  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      {editing ? (
        <TextInput
          autoFocus
          style={[styles.statValue, styles.statInput]}
          keyboardType="decimal-pad"
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
        />
      ) : (
        <Pressable
          onPress={() => {
            setDraft(String(value))
            setEditing(true)
          }}
        >
          <Text style={styles.statValue}>{formatMoney(value)}</Text>
        </Pressable>
      )}
      <Text style={styles.statSub}>{editing ? 'editing…' : 'tap to edit'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: -8 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statLabel: { fontSize: 10, color: colors.textSoft, letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '600', color: colors.ink, marginTop: 4 },
  statInput: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 2 },
  statSub: { fontSize: 12, color: colors.textSoft, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowLabel: { flex: 1, fontSize: 13, color: colors.text },
  rowPct: { fontSize: 12, color: colors.textSoft },
  rowAmount: { fontSize: 13, fontWeight: '600', color: colors.ink, width: 72, textAlign: 'right' },
})
