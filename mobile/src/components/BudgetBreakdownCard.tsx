import { StyleSheet, Text, View } from 'react-native'
import type { SectionBudget } from '../data/selectors'
import { formatMoney } from '../utils/format'
import { colors } from '../theme'
import { Donut } from './Donut'

// Budget sections have no color of their own (unlike categories), so this chart cycles
// through a fixed palette by position instead — same swatches and order as the web app's
// BudgetBreakdown, since `data` is already sorted by total.
const PALETTE = ['#3b6e8f', '#b4483a', '#2f6f52', '#8a5fb0', '#b3872f', '#3f7d7a', '#c0546b', '#4a5a8f']

interface Props {
  data: SectionBudget[]
}

export function BudgetBreakdownCard({ data }: Props) {
  const top = data.slice(0, 6)
  const total = data.reduce((s, d) => s + d.total, 0)

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No budget planned for this month.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Donut
        segments={top.map((d, i) => ({ key: d.sectionId, value: d.total, color: PALETTE[i % PALETTE.length] }))}
        centerLabel={formatMoney(total)}
        centerSubLabel="Budgeted"
      />
      <View style={styles.legend}>
        {top.map((d, i) => {
          const pct = total > 0 ? Math.round((d.total / total) * 100) : 0
          return (
            <View key={d.sectionId} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
              <Text style={styles.rowLabel} numberOfLines={1}>
                {d.name}
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
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { flex: 1, fontSize: 13, color: colors.text },
  rowPct: { fontSize: 12, color: colors.textSoft, fontVariant: ['tabular-nums'] },
  rowAmount: { fontSize: 13, fontWeight: '600', color: colors.ink, width: 76, textAlign: 'right', fontVariant: ['tabular-nums'] },
})
