import { TrendingUp, Wallet, Scale, Landmark, Coins, PiggyBank } from 'lucide-react'
import { useStore } from '../data/store'
import { usePeriod } from '../data/period'
import {
  budgetBySection,
  budgetStatsForMonth,
  groupBudgetItemsBySection,
  incomeForMonth,
  monthlyIncomeEntryForMonth,
  spendByCategory,
  spendTrend,
  totalSpend,
  transactionsForMonth,
} from '../data/selectors'
import { formatMoney, monthKeyLabel } from '../utils/format'
import { Card } from '../components/Card'
import { StatCard } from '../components/StatCard'
import { EditableStatCard } from '../components/EditableStatCard'
import { MonthPicker } from '../components/MonthPicker'
import { CategoryBreakdown } from '../components/CategoryBreakdown'
import { BudgetBreakdown } from '../components/BudgetBreakdown'
import { SpendTrend } from '../components/SpendTrend'
import { IncomeExpenseTrend } from '../components/IncomeExpenseTrend'

export function Dashboard() {
  const { transactions, categories, monthlyIncomes, budgetSections, budgetLineItems, saveMonthlyIncome, profile } =
    useStore()
  const { month } = usePeriod()
  const firstName = profile?.name?.trim().split(/\s+/)[0]

  const monthTxns = transactionsForMonth(transactions, month)
  const spend = spendByCategory(monthTxns)
  const spent = totalSpend(monthTxns)
  const { monthlyIncome, otherIncome } = monthlyIncomeEntryForMonth(monthlyIncomes, month)
  const income = monthlyIncome + otherIncome
  const difference = income - spent
  const trend = spendTrend(transactions, 6)
  const incomeExpenseTrend = trend.map((m) => ({
    label: m.label,
    income: incomeForMonth(monthlyIncomes, m.key),
    expense: m.total,
  }))

  const itemsBySection = groupBudgetItemsBySection(budgetLineItems)
  const budgetData = budgetBySection(budgetSections, itemsBySection, month)
  const { expenses: budgeted } = budgetStatsForMonth(month, budgetSections, itemsBySection, monthlyIncomes)
  const budgetGap = spent - budgeted

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] text-[var(--ink)]">
            Dashboard
            {firstName && (
              <span className="ml-2 text-[var(--primary)]">— Welcome, {firstName}</span>
            )}
          </h1>
          <p className="text-[13px] text-[var(--text-soft)]">
            Your financial position for {monthKeyLabel(month)}
          </p>
        </div>
        <MonthPicker />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <EditableStatCard
          label="Income"
          value={monthlyIncome}
          sub="tap to edit"
          icon={<Landmark size={16} className="text-[var(--text-soft)]" />}
          onSave={(v) => saveMonthlyIncome({ monthKey: month, monthlyIncome: v })}
        />
        <EditableStatCard
          label="Other income"
          value={otherIncome}
          sub="side income, etc. — tap to edit"
          icon={<Coins size={16} className="text-[var(--text-soft)]" />}
          onSave={(v) => saveMonthlyIncome({ monthKey: month, otherIncome: v })}
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

      <Card title="Category breakdown vs. budget planner">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-soft)]">
              Actual spending
            </p>
            <CategoryBreakdown data={spend} categories={categories} />
          </div>
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-soft)]">
              Budget planner
            </p>
            <BudgetBreakdown data={budgetData} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--paper)] px-4 py-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[var(--text-soft)]">
            <span>
              Budgeted <span className="font-mono text-[var(--ink)]">{formatMoney(budgeted)}</span>
            </span>
            <span>
              Actual <span className="font-mono text-[var(--ink)]">{formatMoney(spent)}</span>
            </span>
          </div>
          <p className={`text-[13px] font-medium ${budgetGap > 0 ? 'text-[var(--warn)]' : 'text-[var(--primary)]'}`}>
            {budgetGap > 0
              ? `${formatMoney(budgetGap)} over budget`
              : budgetGap < 0
                ? `${formatMoney(Math.abs(budgetGap))} under budget`
                : 'Right on budget'}
          </p>
        </div>
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
