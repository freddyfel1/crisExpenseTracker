import { AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'
import type { Tip } from '../utils/tips'

const ICONS = { warn: AlertTriangle, good: CheckCircle2, info: Lightbulb }
const COLORS: Record<Tip['tone'], string> = {
  warn: 'var(--warn)',
  good: 'var(--primary)',
  info: 'var(--gold)',
}

export function BudgetTips({ tips }: { tips: Tip[] }) {
  return (
    <ul className="space-y-2.5">
      {tips.map((tip) => {
        const Icon = ICONS[tip.tone]
        const color = COLORS[tip.tone]
        return (
          <li key={tip.id} className="flex items-start gap-2.5 text-[13px] leading-snug">
            <Icon size={15} className="mt-0.5 shrink-0" style={{ color }} />
            <span className="text-[var(--text)]">{tip.text}</span>
          </li>
        )
      })}
    </ul>
  )
}
