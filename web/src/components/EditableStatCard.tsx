import { useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { formatMoney } from '../utils/format'

interface Props {
  label: string
  value: number
  sub?: string
  icon?: ReactNode
  onSave: (value: number) => void
}

export function EditableStatCard({ label, value, sub, icon, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isNaN(parsed)) onSave(parsed)
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] uppercase tracking-wide text-[var(--text-soft)]">{label}</p>
        {icon}
      </div>
      {editing ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="font-display mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-2 py-1 text-[22px] leading-none text-[var(--ink)]"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(String(value))
            setEditing(true)
          }}
          className="group mt-2 flex w-full items-center gap-2 text-left"
        >
          <p className="font-display text-[30px] leading-none text-[var(--ink)]">{formatMoney(value)}</p>
          <Pencil size={13} className="text-[var(--text-soft)] opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
      {sub && <p className="mt-1.5 text-[12.5px] text-[var(--text-soft)]">{sub}</p>}
    </div>
  )
}
