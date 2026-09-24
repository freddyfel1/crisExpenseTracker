import { StyleSheet, Text, View } from 'react-native'
import type { Category } from '../types'
import type { CategorySpend } from '../data/selectors'
import { formatMoney } from '../utils/format'
import { colors } from '../theme'
import { Donut } from './Donut'
import { CategoryIcon } from './CategoryIcon'

const resolveCategory = (categories: Category[], id: string | null): Category =>
  categories.find((c) => c.id === id) ?? { id: '', name: 'Uncategorized', icon: 'CircleDashed', color: colors.textSoft }

interface Props {
  data: CategorySpend[]
  categories: Category[]
}

export function CategoryBreakdownCard({ data, categories }: Props) {
  const top = data.slice(0, 6)
  const total = data.reduce((s, d) => s + d.total, 0)

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No spending recorded for this period.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Donut
        segments={top.map((d) => ({
          key: d.categoryId ?? 'uncategorized',
          value: d.total,
          color: resolveCategory(categories, d.categoryId).color,
        }))}
        centerLabel={formatMoney(total)}
        centerSubLabel="Total"
      />
      <View style={styles.legend}>
        {top.map((d) => {
          const category = resolveCategory(categories, d.categoryId)
          const pct = total > 0 ? Math.round((d.total / total) * 100) : 0
          return (
            <View key={d.categoryId ?? 'uncategorized'} style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: `${category.color}1a` }]}>
                <CategoryIcon name={category.icon} size={13} color={category.color} />
              </View>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {category.name}
              </Text>
              <Text style={styles.rowPct}>{pct}%</Text>
              <Text style={styles.rowAmount}>{formatMoney(d.total)}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 16, alignItems: 'center' },
  empty: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: colors.textSoft, textAlign: 'center' },
  legend: { width: '100%', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 13, color: colors.text },
  rowPct: { fontSize: 12, color: colors.textSoft, fontVariant: ['tabular-nums'] },
  rowAmount: { fontSize: 13, fontWeight: '600', color: colors.ink, width: 76, textAlign: 'right', fontVariant: ['tabular-nums'] },
})
