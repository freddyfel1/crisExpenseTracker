import { Monitor, Sun, Moon } from 'lucide-react'
import { useTheme, type ThemeMode } from '../data/theme'

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Monitor }[] = [
  { mode: 'auto', label: 'Auto', icon: Monitor },
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
]

export function ThemeToggle() {
  const { mode, setMode } = useTheme()

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
      {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => (
        <button
          key={optionMode}
          type="button"
          onClick={() => setMode(optionMode)}
          aria-pressed={mode === optionMode}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
            mode === optionMode
              ? 'bg-[var(--primary-soft)] text-[var(--primary-ink)]'
              : 'text-[var(--text-soft)] hover:bg-[var(--paper)]'
          }`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  )
}
