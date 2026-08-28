import { TrendingUp, Wallet, Scale, Landmark, Coins, PiggyBank } from 'lucide-react'
import { useStore } from '../data/store'
import { usePeriod } from '../data/period'
import { spendByCategory, spendTrend, totalSpend, transactionsForMonth } from '../data/selectors'
import { formatMoney, monthKeyLabel } from '../utils/format'
import { Card } from '../components/Card'
import { StatCard } from '../components/StatCard'
import { EditableStatCard } from '../components/EditableStatCard'
import { MonthPicker } from '../components/MonthPicker'
import { CategoryBreakdown } from '../components/CategoryBreakdown'
import { SpendTrend } from '../components/SpendTrend'
import { IncomeExpenseTrend } from '../components/IncomeExpenseTrend'

export function Dashboard() {
  const { transactions, categories, profile, updateProfile } = useStore()
  const { month } = usePeriod()

  const monthTxns = transactionsForMonth(transactions, month)
  const spend = spendByCategory(monthTxns)
  const spent = totalSpend(monthTxns)
  const otherIncome = profile?.otherIncome ?? 0
  const income = (profile?.monthlyIncome ?? 0) + otherIncome
  const difference = income - spent
  const trend = spendTrend(transactions, 6)
  const incomeExpenseTrend = trend.map((m) => ({ label: m.label, income, expense: m.total }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">Dashboard</h1>
          <p className="text-[13px] text-[var(--text-soft)]">
            Your financial position for {monthKeyLabel(month)}
          </p>
        </div>
        <MonthPicker />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EditableStatCard
          label="Income"
          value={profile?.monthlyIncome ?? 0}
          sub="tap to edit"
          icon={<Landmark size={16} className="text-[var(--text-soft)]" />}
          onSave={(v) => updateProfile({ monthlyIncome: v })}
        />
        <EditableStatCard
          label="Other income"
          value={otherIncome}
          sub="side income, etc. — tap to edit"
          icon={<Coins size={16} className="text-[var(--text-soft)]" />}
          onSave={(v) => updateProfile({ otherIncome: v })}
        />
        <StatCard
          label="Total income"
          value={formatMoney(income)}
          sub="income + other income"
          icon={<PiggyBank size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Total expense"
          value={formatMoney(spent)}
          sub={`${monthTxns.length} transactions`}
          icon={<Wallet size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Difference"
          value={formatMoney(difference)}
          sub="income minus expense"
          tone={difference < 0 ? 'warn' : 'good'}
          icon={<Scale size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="6-month trend"
          value={formatMoney(trend[trend.length - 1]?.total ?? 0)}
          sub="this month vs. prior months"
          icon={<TrendingUp size={16} className="text-[var(--text-soft)]" />}
        />
      </div>

      <Card title="Category breakdown">
        <CategoryBreakdown data={spend} categories={categories} />
      </Card>

      <Card title="Spending trend">
        <SpendTrend data={trend} />
      </Card>

      <Card title="Income vs. expense (6 months)">
        <IncomeExpenseTrend data={incomeExpenseTrend} />
      </Card>
    </div>
  )
}
