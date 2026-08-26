import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBudgets, useCategories, useTransactions } from '../../src/hooks/useAppData'
import { currentMonthKey, spendByCategory, totalBudget, totalSpend, transactionsForMonth } from '../../src/data/selectors'
import { formatMoney, monthKeyLabel } from '../../src/utils/format'
import { colors } from '../../src/theme'

export default function Home() {
  const transactions = useTransactions()
  const categories = useCategories()
  const budgets = useBudgets()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }, [queryClient])

  if (transactions.isLoading || categories.isLoading || budgets.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const month = currentMonthKey()
  const monthTxns = transactionsForMonth(transactions.data ?? [], month)
  const spend = spendByCategory(monthTxns)
  const spent = totalSpend(monthTxns)
  const budget = totalBudget(budgets.data ?? [])
  const remaining = budget - spent
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]))

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>{monthKeyLabel(month)}</Text>

        <View style={styles.statRow}>
          <View style={[styles.statCard, { marginRight: 8 }]}>
            <Text style={styles.statLabel}>TOTAL SPEND</Text>
            <Text style={styles.statValue}>{formatMoney(spent)}</Text>
            <Text style={styles.statSub}>{monthTxns.length} transactions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>REMAINING</Text>
            <Text style={[styles.statValue, { color: remaining < 0 ? colors.warn : colors.primary }]}>
              {formatMoney(remaining)}
            </Text>
            <Text style={styles.statSub}>of {formatMoney(budget)}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: -8 },
  statRow: { flexDirection: 'row' },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statLabel: { fontSize: 10, color: colors.textSoft, letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: '600', color: colors.ink, marginTop: 4 },
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
