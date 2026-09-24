import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Camera, Plus, Search } from 'lucide-react-native'
import { useCategories, useMonthlyIncomes, useTransactions } from '../../src/hooks/useAppData'
import { incomeForMonth, transactionsForMonth, totalSpend } from '../../src/data/selectors'
import { usePeriod } from '../../src/data/period'
import type { Transaction } from '../../src/types'
import { formatDate, formatMoney } from '../../src/utils/format'
import { colors } from '../../src/theme'
import { CategoryIcon } from '../../src/components/CategoryIcon'
import { MonthPicker } from '../../src/components/MonthPicker'

export default function Transactions() {
  const transactions = useTransactions()
  const categories = useCategories()
  const monthlyIncomes = useMonthlyIncomes()
  const router = useRouter()
  const { month } = usePeriod()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'uncategorized' | string>('all')

  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]))

  const filtered = useMemo(() => {
    let rows = transactionsForMonth(transactions.data ?? [], month)
    if (categoryFilter === 'uncategorized') rows = rows.filter((t) => t.categoryId == null)
    else if (categoryFilter !== 'all') rows = rows.filter((t) => t.categoryId === categoryFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter((t) => t.merchant.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q))
    }
    return rows
  }, [transactions.data, month, categoryFilter, query])

  if (transactions.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const income = incomeForMonth(monthlyIncomes.data ?? [], month)
  const expense = totalSpend(transactionsForMonth(transactions.data ?? [], month))
  const balance = income - expense

  const renderItem = ({ item }: { item: Transaction }) => {
    const category = item.categoryId ? categoryById.get(item.categoryId) : undefined
    const color = category?.color ?? colors.textSoft
    return (
      <Pressable style={styles.row} onPress={() => router.push(`/transaction/${item.id}`)}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}1a` }]}>
          <CategoryIcon name={category?.icon ?? 'CircleDashed'} size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.merchant} numberOfLines={1}>
            {item.merchant}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{formatDate(item.date)} · </Text>
            <View style={[styles.categoryPill, { backgroundColor: `${color}1a` }]}>
              <Text style={[styles.categoryPillText, { color }]} numberOfLines={1}>
                {category?.name ?? 'Uncategorized'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(item.amount)}
        </Text>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.empty}>No transactions match this filter.</Text>}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Transactions</Text>
              <Text style={styles.count}>{filtered.length} transactions</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={styles.secondaryButton} onPress={() => router.push('/capture')}>
                <Camera size={14} color={colors.text} />
                <Text style={styles.secondaryButtonText}>Capture receipt</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => router.push('/transaction/new')}>
                <Plus size={14} color="#fff" />
                <Text style={styles.primaryButtonText}>Add transaction</Text>
              </Pressable>
            </View>

            <View style={styles.searchBar}>
              <Search size={15} color={colors.textSoft} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search merchant, notes..."
                placeholderTextColor={colors.textSoft}
                value={query}
                onChangeText={setQuery}
              />
            </View>

            <MonthPicker />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <FilterChip label="All" active={categoryFilter === 'all'} onPress={() => setCategoryFilter('all')} />
              <FilterChip
                label="Uncategorized"
                active={categoryFilter === 'uncategorized'}
                onPress={() => setCategoryFilter('uncategorized')}
              />
              {(categories.data ?? []).map((c) => (
                <FilterChip
                  key={c.id}
                  label={c.name}
                  color={c.color}
                  active={categoryFilter === c.id}
                  onPress={() => setCategoryFilter(c.id)}
                />
              ))}
            </ScrollView>

            <View style={styles.statRow}>
              <Stat label="INCOME" value={formatMoney(income)} />
              <Stat label="EXPENSE" value={formatMoney(expense)} />
              <Stat label="BALANCE" value={formatMoney(balance)} color={balance < 0 ? colors.warn : colors.primary} />
            </View>
          </View>
        }
      />
    </SafeAreaView>
  )
}

function FilterChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string
  active: boolean
  color?: string
  onPress: () => void
}) {
  const tint = color ?? colors.primary
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: `${tint}22`, borderColor: tint }]}
    >
      <Text style={[styles.chipText, active && { color: tint, fontWeight: '600' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  count: { fontSize: 12, color: colors.textSoft },
  actionsRow: { flexDirection: 'row', gap: 8 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryButtonText: { fontSize: 13, fontWeight: '500', color: colors.text },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryButtonText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12.5, color: colors.text },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  statLabel: { fontSize: 10, color: colors.textSoft, letterSpacing: 0.5 },
  statValue: { fontSize: 17, fontWeight: '600', color: colors.ink, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  merchant: { fontSize: 14, fontWeight: '500', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  meta: { fontSize: 12, color: colors.textSoft },
  categoryPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 1 },
  categoryPillText: { fontSize: 11, fontWeight: '600' },
  amount: { fontSize: 14, fontWeight: '600', color: colors.ink, marginLeft: 8, maxWidth: 100 },
  separator: { height: 1, backgroundColor: colors.borderSoft, marginLeft: 20 },
  empty: { textAlign: 'center', color: colors.textSoft, marginTop: 60, paddingHorizontal: 32 },
})
