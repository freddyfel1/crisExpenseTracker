import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Monitor, Sun, Moon } from 'lucide-react-native'
import { useTheme, type ThemeMode } from '../data/theme'
import type { ThemeColors } from '../theme'

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Monitor }[] = [
  { mode: 'auto', label: 'Auto', icon: Monitor },
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
]

export function ThemeToggle() {
  const { mode, setMode, colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <View style={styles.row}>
      {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => {
        const active = mode === optionMode
        return (
          <Pressable
            key={optionMode}
            onPress={() => setMode(optionMode)}
            style={[styles.option, active && styles.optionActive]}
          >
            <Icon size={14} color={active ? colors.primaryInk : colors.textSoft} />
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 4,
      alignSelf: 'flex-start',
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    optionActive: { backgroundColor: colors.primarySoft },
    label: { fontSize: 12, fontWeight: '500', color: colors.textSoft },
    labelActive: { color: colors.primaryInk, fontWeight: '600' },
  })
}
