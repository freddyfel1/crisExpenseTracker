import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney, formatMoneyCompact } from '../utils/format'

interface Props {
  data: { label: string; income: number; expense: number }[]
}

export function IncomeExpenseTrend({ data }: Props) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--text-soft)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={44}
            tick={{ fontSize: 11, fill: 'var(--text-soft)' }}
            tickFormatter={(v) => formatMoneyCompact(Number(v))}
          />
          <Tooltip
            formatter={(value, name) => [formatMoney(Number(value)), name]}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Income" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="var(--warn)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
