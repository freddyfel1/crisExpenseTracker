import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'warn' | 'good'
  icon?: ReactNode
}

const TONE_CLASSES: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-[var(--ink)]',
  warn: 'text-[var(--warn)]',
  good: 'text-[var(--primary)]',
}

export function StatCard({ label, value, sub, tone = 'default', icon }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] uppercase tracking-wide text-[var(--text-soft)]">{label}</p>
        {icon}
      </div>
      <p className={`font-display mt-2 text-[30px] leading-none ${TONE_CLASSES[tone]}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[12.5px] text-[var(--text-soft)]">{sub}</p>}
    </div>
  )
}
