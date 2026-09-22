import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Holding } from '../data/selectors'
import { formatMoney } from '../utils/format'
import { colors } from '../theme'

interface HoldingRow extends Holding {
  priceNow: number
  value: number
  gain: number
}

interface Props {
  holdings: Holding[]
  prices: Record<string, number>
}

// Qty, price, market value, and gain/loss are different units/scales, so they can't
// share one axis (recharts version on web hits the same constraint) — gain/loss gets
// its own diverging chart (a delta above/below zero), colored green/red, and the other
// three metrics live in the detail card below for whichever bar is tapped. Mobile has
// no hover, so "tap a bar" replaces the web version's tooltip-on-hover.
const CHART_HEIGHT = 160
const HALF_HEIGHT = CHART_HEIGHT / 2

export function HoldingsGainLoss({ holdings, prices }: Props) {
  const [selected, setSelected] = useState(0)

  const rows: HoldingRow[] = holdings
    .map((h) => {
      const priceNow = prices[h.symbol]
      if (priceNow == null) return null
      const value = priceNow * h.quantity
      return { ...h, priceNow, value, gain: value - h.costBasis }
    })
    .filter((r): r is HoldingRow => r != null)
    .sort((a, b) => b.value - a.value)

  if (rows.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>No priced holdings yet — tap "Price now" to chart gain/loss.</Text>
      </View>
    )
  }

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.gain)), 1)
  const selectedRow = rows[Math.min(selected, rows.length - 1)]
  const gainPct = selectedRow.costBasis > 0 ? (selectedRow.gain / selectedRow.costBasis) * 100 : null

  return (
    <View>
      <View style={styles.chartArea}>
        <View style={styles.axisLabels}>
          <Text style={styles.axisLabel}>{formatMoney(maxAbs)}</Text>
          <Text style={styles.axisLabel}>$0</Text>
          <Text style={styles.axisLabel}>-{formatMoney(maxAbs)}</Text>
        </View>
        <View style={styles.bars}>
          <View style={styles.baseline} />
          {rows.map((r, i) => {
            const barHeight = Math.max(3, (Math.abs(r.gain) / maxAbs) * HALF_HEIGHT)
            const isGain = r.gain >= 0
            const isSelected = i === selected
            return (
              <Pressable key={r.symbol} style={styles.barColumn} onPress={() => setSelected(i)}>
                <View style={styles.barHalf}>
                  {isGain && (
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: colors.primary,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                          opacity: isSelected ? 1 : 0.8,
                        },
                      ]}
                    />
                  )}
                </View>
                <View style={[styles.barHalf, styles.barHalfBottom]}>
                  {!isGain && (
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                          backgroundColor: colors.warn,
                          borderBottomLeftRadius: 4,
                          borderBottomRightRadius: 4,
                          opacity: isSelected ? 1 : 0.8,
                        },
                      ]}
                    />
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.symbolRow}>
        {rows.map((r, i) => (
          <Pressable key={r.symbol} style={styles.barColumn} onPress={() => setSelected(i)}>
            <Text style={[styles.symbolLabel, i === selected && styles.symbolLabelSelected]}>{r.symbol}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.detailSymbol}>{selectedRow.symbol}</Text>
        <DetailRow label="Qty" value={String(selectedRow.quantity)} />
        <DetailRow label="Price now" value={formatMoney(selectedRow.priceNow)} />
        <DetailRow label="Market value" value={formatMoney(selectedRow.value)} />
        <DetailRow
          label="Gain/loss"
          value={`${selectedRow.gain >= 0 ? '+' : ''}${formatMoney(selectedRow.gain)}${gainPct != null ? ` (${gainPct.toFixed(1)}%)` : ''}`}
          tone={selectedRow.gain >= 0 ? 'good' : 'warn'}
        />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Gain</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.warn }]} />
          <Text style={styles.legendText}>Loss</Text>
        </View>
      </View>
    </View>
  )
}

function DetailRow({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, tone === 'good' && { color: colors.primary }, tone === 'warn' && { color: colors.warn }]}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  emptyBox: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 12.5, color: colors.textSoft, textAlign: 'center' },
  chartArea: { flexDirection: 'row', height: CHART_HEIGHT },
  axisLabels: { width: 56, justifyContent: 'space-between', paddingVertical: 0 },
  axisLabel: { fontSize: 10, color: colors.textSoft },
  bars: { flex: 1, flexDirection: 'row', position: 'relative' },
  baseline: {
    position: 'absolute',
    top: HALF_HEIGHT,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.borderSoft,
  },
  barColumn: { flex: 1, alignItems: 'center' },
  barHalf: { height: HALF_HEIGHT, width: 22, justifyContent: 'flex-end' },
  barHalfBottom: { justifyContent: 'flex-start' },
  bar: { width: 22 },
  symbolRow: { flexDirection: 'row', marginTop: 4 },
  symbolLabel: { fontSize: 10.5, color: colors.textSoft, textAlign: 'center' },
  symbolLabelSelected: { color: colors.ink, fontWeight: '600' },
  detailCard: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.paper,
    padding: 12,
    gap: 4,
  },
  detailSymbol: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: colors.textSoft },
  detailValue: { fontSize: 12, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11.5, color: colors.textSoft },
})
