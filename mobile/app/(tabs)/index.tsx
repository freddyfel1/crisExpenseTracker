import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useBudgetLineItems,
  useBudgetSections,
  useCategories,
  useMonthlyIncomes,
  useProfile,
  useSaveMonthlyIncome,
  useTransactions,
} from '../../src/hooks/useAppData'
import {
  budgetBySection,
  budgetStatsForMonth,
  groupBudgetItemsBySection,
  incomeForMonth,
  monthlyIncomeEntryForMonth,
  spendByCategory,
  spendTrend,
  totalSpend,
  transactionsForMonth,
} from '../../src/data/selectors'
import { usePeriod } from '../../src/data/period'
import { formatMoney, monthKeyLabel } from '../../src/utils/format'
import { colors } from '../../src/theme'
import { MonthPicker } from '../../src/components/MonthPicker'
import { CategoryBreakdownCard } from '../../src/components/CategoryBreakdownCard'
import { BudgetBreakdownCard } from '../../src/components/BudgetBreakdownCard'
import { SpendTrendChart } from '../../src/components/SpendTrendChart'
import { IncomeExpenseTrendChart } from '../../src/components/IncomeExpenseTrendChart'

export default function Home() {
  const transactions = useTransactions()
  const categories = useCategories()
  const monthlyIncomes = useMonthlyIncomes()
  const budgetSections = useBudgetSections()
  const budgetLineItems = useBudgetLineItems()
  const profile = useProfile()
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

  const allTransactions = transactions.data ?? []
  const monthTxns = transactionsForMonth(allTransactions, month)
  const spend = spendByCategory(monthTxns)
  const spent = totalSpend(monthTxns)
  const { monthlyIncome, otherIncome } = monthlyIncomeEntryForMonth(monthlyIncomes.data ?? [], month)
  const income = monthlyIncome + otherIncome
  const difference = income - spent
  const trend = spendTrend(allTransactions, 6)
  const incomeExpenseTrend = trend.map((m) => ({
    label: m.label,
    income: incomeForMonth(monthlyIncomes.data ?? [], m.key),
    expense: m.total,
  }))

  const itemsBySection = groupBudgetItemsBySection(budgetLineItems.data ?? [])
  const budgetData = budgetBySection(budgetSections.data ?? [], itemsBySection, month)
  const { expenses: budgeted } = budgetStatsForMonth(month, budgetSections.data ?? [], itemsBySection, monthlyIncomes.data ?? [])
  const budgetGap = spent - budgeted

  const firstName = profile.data?.name?.trim().split(/\s+/)[0]

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>
          Dashboard
          {firstName ? <Text style={styles.titleWelcome}> — Welcome, {firstName}</Text> : null}
        </Text>
        <Text style={styles.subtitle}>Your financial position for {monthKeyLabel(month)}</Text>
        <MonthPicker />

        <View style={styles.statGrid}>
          <EditableStat
            label="INCOME"
            value={monthlyIncome}
            sub="tap to edit"
            onSave={(v) => saveMonthlyIncome.mutate({ monthKey: month, monthlyIncome: v })}
          />
          <EditableStat
            label="OTHER INCOME"
            value={otherIncome}
            sub="tap to edit"
            onSave={(v) => saveMonthlyIncome.mutate({ monthKey: month, otherIncome: v })}
          />
          <Stat label="TOTAL INCOME" value={formatMoney(income)} sub="income + other income" />
          <Stat label="TOTAL EXPENSE" value={formatMoney(spent)} sub={`${monthTxns.length} transactions`} />
          <Stat
            label="DIFFERENCE"
            value={formatMoney(difference)}
            sub="income minus expense"
            color={difference < 0 ? colors.warn : colors.primary}
          />
          <Stat
            label="6-MONTH TREND"
            value={formatMoney(trend[trend.length - 1]?.total ?? 0)}
            sub="this month vs. prior months"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category breakdown vs. budget planner</Text>
          <Text style={styles.sectionLabel}>Actual spending</Text>
          <CategoryBreakdownCard data={spend} categories={categories.data ?? []} />
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Budget planner</Text>
          <BudgetBreakdownCard data={budgetData} />
          <View style={styles.budgetSummary}>
            <View style={styles.budgetSummaryRow}>
              <Text style={styles.budgetSummaryText}>
                Budgeted <Text style={styles.budgetSummaryMono}>{formatMoney(budgeted)}</Text>
              </Text>
              <Text style={styles.budgetSummaryText}>
                Actual <Text style={styles.budgetSummaryMono}>{formatMoney(spent)}</Text>
              </Text>
            </View>
            <Text style={[styles.budgetSummaryVerdict, { color: budgetGap > 0 ? colors.warn : colors.primary }]}>
              {budgetGap > 0
                ? `${formatMoney(budgetGap)} over budget`
                : budgetGap < 0
                  ? `${formatMoney(Math.abs(budgetGap))} under budget`
                  : 'Right on budget'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending trend</Text>
          <SpendTrendChart data={trend} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Income vs. expense (6 months)</Text>
          <IncomeExpenseTrendChart data={incomeExpenseTrend} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub && (
        <Text style={styles.statSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  )
}

function EditableStat({
  label,
  value,
  sub,
  onSave,
}: {
  label: string
  value: number
  sub?: string
  onSave: (v: number) => void
}) {
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
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(value)}
          </Text>
        </Pressable>
      )}
      <Text style={styles.statSub} numberOfLines={1}>
        {editing ? 'editing…' : sub}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  titleWelcome: { fontSize: 18, fontWeight: '600', color: colors.primary },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: -8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
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
  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 4 },
  budgetSummary: {
    marginTop: 4,
    backgroundColor: colors.paper,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    gap: 6,
  },
  budgetSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  budgetSummaryText: { fontSize: 13, color: colors.textSoft },
  budgetSummaryMono: { color: colors.ink, fontWeight: '600' },
  budgetSummaryVerdict: { fontSize: 13, fontWeight: '600' },
})
