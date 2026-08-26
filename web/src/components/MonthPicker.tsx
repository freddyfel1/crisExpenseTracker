import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePeriod } from '../data/period'
import { monthKeyLabel } from '../utils/format'

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MonthPicker() {
  const { month, setMonth } = usePeriod()
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1 py-1">
      <button
        onClick={() => setMonth(shiftMonth(month, -1))}
        className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-soft)] hover:bg-[var(--paper)]"
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[128px] text-center text-[13px] font-medium text-[var(--ink)]">
        {monthKeyLabel(month)}
      </span>
      <button
        onClick={() => setMonth(shiftMonth(month, 1))}
        className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-soft)] hover:bg-[var(--paper)]"
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
