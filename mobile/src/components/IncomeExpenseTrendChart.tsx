import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'
import { formatMoneyCompact } from '../utils/format'

interface Props {
  data: { label: string; income: number; expense: number }[]
}

const CHART_HEIGHT = 140

export function IncomeExpenseTrendChart({ data }: Props) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1)

  return (
    <View style={styles.container}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendLabel}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.warn }]} />
          <Text style={styles.legendLabel}>Expense</Text>
        </View>
      </View>
      <View style={styles.chart}>
        {data.map((d) => (
          <View key={d.label} style={styles.month}>
            <View style={styles.bars}>
              <Bar value={d.income} max={max} color={colors.primary} />
              <Bar value={d.expense} max={max} color={colors.warn} />
            </View>
            <Text style={styles.monthLabel}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const height = Math.max((value / max) * (CHART_HEIGHT - 20), value > 0 ? 2 : 0)
  return (
    <View style={styles.barSlot}>
      {value > 0 && (
        <Text style={styles.barValue} numberOfLines={1}>
          {formatMoneyCompact(value)}
        </Text>
      )}
      <View style={[styles.bar, { height, backgroundColor: color }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  legendRow: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: colors.textSoft },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, justifyContent: 'space-between' },
  month: { flex: 1, alignItems: 'center', gap: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_HEIGHT - 20 },
  barSlot: { alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 10, borderRadius: 3 },
  barValue: { fontSize: 8, color: colors.textSoft, marginBottom: 2 },
  monthLabel: { fontSize: 10, color: colors.textSoft },
})
