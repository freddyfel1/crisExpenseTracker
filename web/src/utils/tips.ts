import type { Budget, Category } from '../types'
import type { CategorySpend } from '../data/selectors'
import { formatMoney } from './format'

export interface Tip {
  id: string
  tone: 'warn' | 'good' | 'info'
  text: string
}

export function buildBudgetTips(
  spend: CategorySpend[],
  budgets: Budget[],
  categories: Category[],
): Tip[] {
  const byId = new Map<string | null, Category>(categories.map((c) => [c.id, c]))
  const budgetById = new Map<string | null, number>(budgets.map((b) => [b.categoryId, b.monthlyLimit]))
  const tips: Tip[] = []

  for (const s of spend) {
    const limit = budgetById.get(s.categoryId)
    const name = byId.get(s.categoryId)?.name ?? 'Uncategorized'
    if (limit === undefined) {
      if (s.total > 100) {
        tips.push({
          id: `no-budget-${s.categoryId}`,
          tone: 'info',
          text: `You've spent ${formatMoney(s.total)} on ${name} with no budget set — consider adding one.`,
        })
      }
      continue
    }
    const pct = (s.total / limit) * 100
    if (pct >= 100) {
      tips.push({
        id: `over-${s.categoryId}`,
        tone: 'warn',
        text: `${name} is ${formatMoney(s.total - limit)} over its ${formatMoney(limit)} budget this month.`,
      })
    } else if (pct >= 85) {
      tips.push({
        id: `near-${s.categoryId}`,
        tone: 'warn',
        text: `${name} is at ${Math.round(pct)}% of budget — ${formatMoney(limit - s.total)} left this month.`,
      })
    }
  }

  const totalSpent = spend.reduce((sum, s) => sum + s.total, 0)
  const totalBudget = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0)
  if (totalBudget > 0 && totalSpent <= totalBudget * 0.7) {
    tips.push({
      id: 'overall-good',
      tone: 'good',
      text: `You're at ${Math.round((totalSpent / totalBudget) * 100)}% of your overall budget — nice pace this month.`,
    })
  }

  if (tips.length === 0) {
    tips.push({
      id: 'default',
      tone: 'info',
      text: 'Spending looks steady this month. Check back after a few more transactions for tailored tips.',
    })
  }

  return tips.slice(0, 4)
}
