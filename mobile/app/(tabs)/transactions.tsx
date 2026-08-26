import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Search } from 'lucide-react-native'
import { useCategories, useTransactions } from '../../src/hooks/useAppData'
import type { Transaction } from '../../src/types'
import { formatDate, formatMoney } from '../../src/utils/format'
import { colors } from '../../src/theme'

export default function Transactions() {
  const transactions = useTransactions()
  const categories = useCategories()
  const router = useRouter()
  const [query, setQuery] = useState('')

  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]))

  const filtered = useMemo(() => {
    const rows = transactions.data ?? []
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter((t) => t.merchant.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q))
  }, [transactions.data, query])

  if (transactions.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const renderItem = ({ item }: { item: Transaction }) => {
    const category = item.categoryId ? categoryById.get(item.categoryId) : undefined
    return (
      <Pressable style={styles.row} onPress={() => router.push(`/transaction/${item.id}`)}>
        <View style={[styles.dot, { backgroundColor: category?.color ?? colors.textSoft }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.merchant}>{item.merchant}</Text>
          <Text style={styles.meta}>
            {formatDate(item.date)} · {category?.name ?? 'Uncategorized'}
          </Text>
        </View>
        <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
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
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet — capture a receipt to get started.</Text>}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 10 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  merchant: { fontSize: 14, fontWeight: '500', color: colors.ink },
  meta: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '600', color: colors.ink },
  separator: { height: 1, backgroundColor: colors.borderSoft, marginLeft: 20 },
  empty: { textAlign: 'center', color: colors.textSoft, marginTop: 60, paddingHorizontal: 32 },
})
