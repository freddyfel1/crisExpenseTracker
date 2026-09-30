import { useState } from 'react'

interface Props {
  value: number
  onCommit: (value: number) => void
  className?: string
}

// A plain <input type="number"> bound straight to a numeric field starts a new transaction
// showing "0", which the user then has to select/delete by hand before typing the real
// value — worse, typing into it without clearing first appends rather than replaces (e.g.
// "150" focused then typing "9.99" becomes "1509.99"). This clears to blank on focus when the
// value is the field's default (0), and otherwise selects the existing text so the next
// keystroke replaces it outright either way. Keeps its own draft text while focused (a plain
// re-render mid-typing would otherwise eat a just-typed decimal point), and reverts to the
// previous value on blur if left empty — an emptied field must not silently commit as 0.
export function ClearableNumberInput({ value, onCommit, className }: Props) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <input
      type="number"
      step="any"
      value={draft ?? value}
      onFocus={(e) => {
        setDraft(value === 0 ? '' : String(value))
        e.target.select()
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = draft == null || draft.trim() === '' ? value : Number(draft)
        onCommit(Number.isNaN(parsed) ? value : parsed)
        setDraft(null)
      }}
      className={className}
    />
  )
}
