import { useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { colors } from '../theme'

interface Props {
  data: { key: string; label: string; total: number }[]
}

const HEIGHT = 140
const PADDING_TOP = 10
const PADDING_BOTTOM = 22

export function SpendTrendChart({ data }: Props) {
  const [width, setWidth] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  const max = Math.max(...data.map((d) => d.total), 1)
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const stepX = data.length > 1 ? width / (data.length - 1) : 0

  const points = data.map((d, i) => ({
    x: data.length > 1 ? i * stepX : width / 2,
    y: PADDING_TOP + plotHeight - (d.total / max) * plotHeight,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x},${PADDING_TOP + plotHeight} L${points[0].x},${PADDING_TOP + plotHeight} Z`
      : ''

  return (
    <View style={styles.container} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.28} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#spendFill)" />
          <Path d={linePath} stroke={colors.primary} strokeWidth={2} fill="none" />
        </Svg>
      )}
      <View style={styles.labels}>
        {data.map((d) => (
          <Text key={d.key} style={styles.label} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%', height: HEIGHT },
  labels: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 11, color: colors.textSoft },
})
