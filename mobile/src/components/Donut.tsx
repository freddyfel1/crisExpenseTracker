import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'
import { colors } from '../theme'

export interface DonutSegment {
  key: string
  value: number
  color: string
}

interface Props {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerSubLabel?: string
}

// A ring built from stacked SVG circle strokes (each segment is a dash of the circle's own
// circumference), rotated so the first segment starts at 12 o'clock like the web app's
// recharts donut. Kept to react-native-svg (already an Expo Go-bundled module) rather than
// pulling in a charting library, since Expo Go can only run natively-bundled modules.
export function Donut({ segments, size = 168, strokeWidth = 24, centerLabel, centerSubLabel }: Props) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, d) => s + d.value, 0)

  let cumulative = 0

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {total <= 0 ? (
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.borderSoft} strokeWidth={strokeWidth} fill="none" />
          ) : (
            segments.map((seg) => {
              const fraction = seg.value / total
              const rawLength = fraction * circumference
              const gap = segments.length > 1 ? 2 : 0
              const dash = Math.max(rawLength - gap, 0)
              const offset = -cumulative
              cumulative += rawLength
              return (
                <Circle
                  key={seg.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${Math.max(circumference - dash, 0)}`}
                  strokeDashoffset={offset}
                  fill="none"
                />
              )
            })
          )}
        </G>
      </Svg>
      {(centerLabel || centerSubLabel) && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.centerContent}>
            {centerLabel && (
              <Text style={styles.centerLabel} numberOfLines={1} adjustsFontSizeToFit>
                {centerLabel}
              </Text>
            )}
            {centerSubLabel && <Text style={styles.centerSubLabel}>{centerSubLabel}</Text>}
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  centerLabel: { fontSize: 17, fontWeight: '600', color: colors.ink },
  centerSubLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSoft, marginTop: 2 },
})
