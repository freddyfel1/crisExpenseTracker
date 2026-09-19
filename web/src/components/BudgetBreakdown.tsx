import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { SectionBudget } from '../data/selectors'
import { formatMoney } from '../utils/format'

// Budget sections have no color of their own (unlike categories), so this chart cycles
// through a fixed palette by position instead — same swatch order every render since
// `data` is already sorted by total.
const PALETTE = ['#3b6e8f', '#b4483a', '#2f6f52', '#8a5fb0', '#b3872f', '#3f7d7a', '#c0546b', '#4a5a8f']

interface Props {
  data: SectionBudget[]
}

export function BudgetBreakdown({ data }: Props) {
  const top = data.slice(0, 6)
  const total = data.reduce((s, d) => s + d.total, 0)

  if (data.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-[168px] w-[168px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={top}
              dataKey="total"
              nameKey="name"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke="none"
            >
              {top.map((d, i) => (
                <Cell key={d.sectionId} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, entry) => [formatMoney(Number(value)), entry.payload.name]}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-display text-[19px] text-[var(--ink)]">{formatMoney(total)}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-soft)]">Budgeted</p>
          </div>
        </div>
      </div>

      <ul className="flex-1 space-y-2">
        {top.map((d, i) => {
          const pct = total > 0 ? Math.round((d.total / total) * 100) : 0
          return (
            <li key={d.sectionId} className="flex items-center gap-2.5 text-[13px]">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="flex-1 truncate text-[var(--text)]">{d.name}</span>
              <span className="font-mono text-[var(--text-soft)]">{pct}%</span>
              <span className="font-mono w-[64px] text-right text-[var(--ink)]">{formatMoney(d.total)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="grid h-[168px] place-items-center text-center text-[13px] text-[var(--text-soft)]">
      No budget planned for this month.
    </div>
  )
}
