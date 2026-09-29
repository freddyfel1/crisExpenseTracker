// Mirrors the CSS custom properties in web/src/index.css (and its dark-mode overrides)
// so both apps share one palette. Use `useTheme()` from `./data/theme` to get the
// resolved palette for the current Auto/Light/Dark setting — these objects are the raw
// light/dark variants it picks between, not meant to be imported directly by screens.
export interface ThemeColors {
  paper: string
  surface: string
  ink: string
  text: string
  textSoft: string
  border: string
  borderSoft: string
  primary: string
  primaryInk: string
  primarySoft: string
  warn: string
  warnSoft: string
  gold: string
  goldSoft: string
}

export const lightColors: ThemeColors = {
  paper: '#f2f4ef',
  surface: '#ffffff',
  ink: '#121a15',
  text: '#4c5249',
  textSoft: '#7c8175',
  border: '#dfe2d8',
  borderSoft: '#eaece4',
  primary: '#2f6f52',
  primaryInk: '#1e4a37',
  primarySoft: '#e4efe7',
  warn: '#b4483a',
  warnSoft: '#f6e7e2',
  gold: '#b3872f',
  goldSoft: '#f3ecd9',
}

export const darkColors: ThemeColors = {
  paper: '#14160f',
  surface: '#1c1f17',
  ink: '#eef1e9',
  text: '#c7ccc0',
  textSoft: '#8b9184',
  border: '#33382c',
  borderSoft: '#262b20',
  primary: '#4c9d74',
  primaryInk: '#8fe0b8',
  primarySoft: '#1f3b2c',
  warn: '#e0796a',
  warnSoft: '#3a2420',
  gold: '#d9b25c',
  goldSoft: '#3a3020',
}
