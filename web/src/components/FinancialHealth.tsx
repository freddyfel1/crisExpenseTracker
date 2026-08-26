import { useEffect, useState } from 'react'

interface Props {
  spent: number
  budget: number
}

const RADIUS = 70
const STROKE = 12
const CIRC = Math.PI * RADIUS // semicircle length

function healthLabel(pct: number): { label: string; color: string } {
  if (pct <= 70) return { label: 'On track', color: 'var(--primary)' }
  if (pct <= 100) return { label: 'Watch closely', color: 'var(--gold)' }
  return { label: 'Over budget', color: 'var(--warn)' }
}

export function FinancialHealth({ spent, budget }: Props) {
  const pctRaw = budget > 0 ? (spent / budget) * 100 : 0
  const pct = Math.min(pctRaw, 130)
  const [animatedOffset, setAnimatedOffset] = useState(CIRC)
  const { label, color } = healthLabel(pctRaw)

  useEffect(() => {
    const target = CIRC - (Math.min(pct, 100) / 100) * CIRC
    const id = requestAnimationFrame(() => setAnimatedOffset(target))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div className="flex flex-col items-center">
      <svg width={168} height={96} viewBox="0 0 168 96">
        <path
          d={`M 14 84 A ${RADIUS} ${RADIUS} 0 0 1 154 84`}
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={`M 14 84 A ${RADIUS} ${RADIUS} 0 0 1 154 84`}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={animatedOffset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1), stroke 0.4s' }}
        />
      </svg>
      <div className="-mt-9 text-center">
        <p className="font-display text-[26px] leading-none" style={{ color }}>
          {Math.round(pctRaw)}%
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--text-soft)]">of budget used</p>
      </div>
      <p
        className="mt-3 rounded-full px-3 py-1 text-[12px] font-medium"
        style={{ background: `${color}1a`, color }}
      >
        {label}
      </p>
    </div>
  )
}
