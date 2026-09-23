import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { usePeriod } from '../data/period'
import { monthKeyLabel } from '../utils/format'
import { colors } from '../theme'

// Mirrors web/src/components/MonthPicker.tsx.
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MonthPicker() {
  const { month, setMonth } = usePeriod()
  return (
    <View style={styles.row}>
      <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} style={styles.button}>
        <ChevronLeft size={16} color={colors.textSoft} />
      </Pressable>
      <Text style={styles.label}>{monthKeyLabel(month)}</Text>
      <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={8} style={styles.button}>
        <ChevronRight size={16} color={colors.textSoft} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  button: { padding: 6 },
  label: { minWidth: 108, textAlign: 'center', fontSize: 13, fontWeight: '600', color: colors.ink },
})
