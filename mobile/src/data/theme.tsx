import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Appearance, type ColorSchemeName } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { darkColors, lightColors, type ThemeColors } from '../theme'

// Mirrors web/src/data/theme.tsx — same modes, same storage key, same resolution rule
// (Auto follows the OS setting and updates live if it changes) — just swapping
// localStorage/matchMedia for AsyncStorage/Appearance.
export type ThemeMode = 'auto' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

interface ThemeValue {
  mode: ThemeMode
  resolvedTheme: ResolvedTheme
  colors: ThemeColors
  setMode: (mode: ThemeMode) => void
}

const STORAGE_KEY = 'theme-mode'
const ThemeContext = createContext<ThemeValue | null>(null)

function resolveScheme(scheme: ColorSchemeName | null | undefined): ResolvedTheme {
  return scheme === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('auto')
  const [loaded, setLoaded] = useState(false)
  const [systemScheme, setSystemScheme] = useState<ResolvedTheme>(() => resolveScheme(Appearance.getColorScheme()))

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'auto') setMode(stored)
      setLoaded(true)
    })
  }, [])

  // Skip the write until the initial read above finishes, so we don't clobber a
  // stored 'light'/'dark' with the 'auto' default during that first render.
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, mode)
  }, [mode, loaded])

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(resolveScheme(colorScheme)))
    return () => sub.remove()
  }, [])

  const resolvedTheme: ResolvedTheme = mode === 'auto' ? systemScheme : mode
  const colors = resolvedTheme === 'dark' ? darkColors : lightColors

  const value = useMemo(() => ({ mode, resolvedTheme, colors, setMode }), [mode, resolvedTheme, colors])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
