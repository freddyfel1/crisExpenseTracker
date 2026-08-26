import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Category } from '../types'
import type { CategorySpend } from '../data/selectors'
import { formatMoney } from '../utils/format'
import { resolveCategory } from '../utils/resolveCategory'
import { CategoryIcon } from './CategoryIcon'

interface Props {
  data: CategorySpend[]
  categories: Category[]
}

export function CategoryBreakdown({ data, categories }: Props) {
  const byId = (id: string | null) => resolveCategory(categories, id)
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
              nameKey="categoryId"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke="none"
            >
              {top.map((d) => (
                <Cell key={d.categoryId ?? 'uncategorized'} fill={byId(d.categoryId).color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, entry) => [
                formatMoney(Number(value)),
                byId(entry.payload.categoryId).name,
              ]}
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
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-soft)]">Total</p>
          </div>
        </div>
      </div>

      <ul className="flex-1 space-y-2">
        {top.map((d) => {
          const category = byId(d.categoryId)
          const pct = total > 0 ? Math.round((d.total / total) * 100) : 0
          return (
            <li key={d.categoryId ?? 'uncategorized'} className="flex items-center gap-2.5 text-[13px]">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                style={{ background: `${category.color}1a`, color: category.color }}
              >
                <CategoryIcon name={category.icon} size={13} />
              </span>
              <span className="flex-1 truncate text-[var(--text)]">{category.name}</span>
              <span className="font-mono text-[var(--text-soft)]">{pct}%</span>
              <span className="font-mono w-[64px] text-right text-[var(--ink)]">
                {formatMoney(d.total)}
              </span>
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
      No spending recorded for this period.
    </div>
  )
}
