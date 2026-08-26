import { TrendingUp, Wallet, PiggyBank } from 'lucide-react'
import { useStore } from '../data/store'
import { usePeriod } from '../data/period'
import { spendByCategory, spendTrend, totalBudget, totalSpend, transactionsForMonth } from '../data/selectors'
import { formatMoney, monthKeyLabel } from '../utils/format'
import { buildBudgetTips } from '../utils/tips'
import { Card } from '../components/Card'
import { StatCard } from '../components/StatCard'
import { MonthPicker } from '../components/MonthPicker'
import { CategoryBreakdown } from '../components/CategoryBreakdown'
import { SpendTrend } from '../components/SpendTrend'
import { FinancialHealth } from '../components/FinancialHealth'
import { BudgetTips } from '../components/BudgetTips'

export function Dashboard() {
  const { transactions, categories, budgets } = useStore()
  const { month } = usePeriod()

  const monthTxns = transactionsForMonth(transactions, month)
  const spend = spendByCategory(monthTxns)
  const spent = totalSpend(monthTxns)
  const budget = totalBudget(budgets)
  const remaining = budget - spent
  const trend = spendTrend(transactions, 6)
  const tips = buildBudgetTips(spend, budgets, categories)

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total spend"
          value={formatMoney(spent)}
          sub={`${monthTxns.length} transactions`}
          icon={<Wallet size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="Budget remaining"
          value={formatMoney(remaining)}
          sub={`of ${formatMoney(budget)} budgeted`}
          tone={remaining < 0 ? 'warn' : 'good'}
          icon={<PiggyBank size={16} className="text-[var(--text-soft)]" />}
        />
        <StatCard
          label="6-month trend"
          value={formatMoney(trend[trend.length - 1]?.total ?? 0)}
          sub="this month vs. prior months"
          icon={<TrendingUp size={16} className="text-[var(--text-soft)]" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Category breakdown" className="lg:col-span-2">
          <CategoryBreakdown data={spend} categories={categories} />
        </Card>
        <Card title="Financial health">
          <FinancialHealth spent={spent} budget={budget} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Spending trend" className="lg:col-span-2">
          <SpendTrend data={trend} />
        </Card>
        <Card title="Tips to optimize budget">
          <BudgetTips tips={tips} />
        </Card>
      </div>
    </div>
  )
}
