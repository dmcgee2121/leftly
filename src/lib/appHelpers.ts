// Small display and math helpers shared by App and its screen components.
import {
  type Bill,
  type BudgetCategory,
  type CategoryTargets,
  type Expense,
  type PayPeriodSnapshot,
} from '../types/budget'
import { type ForecastViewModel } from '../lib/forecast'
import { formatDateRangeLabel } from '../lib/dateLabels'
import type { CategoryTargetProgress, SnapshotCategorySummary } from '../types/app'

export function roundCurrencyAmount(amount: number) {
  return Math.round(amount * 100) / 100
}

export function getCategoryTargetSpent(expenses: Expense[], category: BudgetCategory) {
  return roundCurrencyAmount(expenses
    .filter((expense) => expense.category === category && !expense.setAsideForTemplateId)
    .reduce((sum, expense) => sum + expense.amount, 0))
}

export function calculateCategoryTargetProgress(categoryTargets: CategoryTargets, expenses: Expense[], categories: BudgetCategory[]) {
  const categorySet = new Set(categories)
  for (const category of Object.keys(categoryTargets)) {
    categorySet.add(category)
  }

  return [...categorySet]
    .flatMap<CategoryTargetProgress>((category) => {
      const target = categoryTargets[category]
      if (target === undefined) {
        return []
      }

      const spent = getCategoryTargetSpent(expenses, category)
      const remaining = roundCurrencyAmount(target - spent)
      const percentUsed = target > 0 ? (spent / target) * 100 : spent > 0 ? Number.POSITIVE_INFINITY : 0
      const status =
        spent > target
          ? 'Over target'
          : target === 0
            ? 'On track'
            : percentUsed === 100
              ? 'At target'
              : percentUsed >= 75
                ? 'Getting close'
                : 'On track'

      return [{
        category,
        target,
        spent,
        remaining,
        percentUsed,
        status,
        progressValue: target > 0 ? Math.min(100, Math.max(0, percentUsed)) : spent > 0 ? 100 : 0,
      }]
    })
}

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

export function getSafePercent(part: number, whole: number) {
  if (whole <= 0 || !Number.isFinite(part) || !Number.isFinite(whole)) {
    return 0
  }

  return clampPercent((part / whole) * 100)
}

export const historyDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatArchivedDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : historyDateFormatter.format(date)
}

export function formatHistoryPeriodLabel(startDate: string, endDate: string) {
  return formatDateRangeLabel(startDate, endDate)
}

export function getSnapshotStartingIncome(snapshot: PayPeriodSnapshot) {
  if (typeof snapshot.baseIncome === 'number' && Number.isFinite(snapshot.baseIncome)) {
    return snapshot.baseIncome
  }

  if (snapshot.rolloverApplied && typeof snapshot.rolloverAmount === 'number' && Number.isFinite(snapshot.rolloverAmount)) {
    return Math.max(0, snapshot.income - snapshot.rolloverAmount)
  }

  return snapshot.income
}

export function getSnapshotCarriedOverSummary(bills: Bill[]) {
  const carriedBills = bills.filter((bill) => bill.carriedOverFromPayPeriodId)
  return {
    count: carriedBills.length,
    amount: carriedBills.reduce((sum, bill) => sum + bill.amount, 0),
  }
}

export function getSnapshotLeftlyStatus(leftover: number) {
  if (leftover < 0) {
    return 'Over budget'
  }

  if (leftover === 0) {
    return 'Fully allocated'
  }

  return 'Left after bills and expenses'
}

export function getSnapshotTopExpenseCategories(expenses: Expense[]) {
  const byCategory = new Map<BudgetCategory, SnapshotCategorySummary>()

  for (const expense of expenses) {
    const current = byCategory.get(expense.category)
    if (current) {
      current.total += expense.amount
      current.count += 1
    } else {
      byCategory.set(expense.category, {
        category: expense.category,
        total: expense.amount,
        count: 1,
      })
    }
  }

  return [...byCategory.values()]
    .sort((left, right) => right.total - left.total || right.count - left.count || left.category.localeCompare(right.category))
    .slice(0, 3)
}

export function forecastStatusLabel(status: ForecastViewModel['status']) {
  return status === 'shortfall' ? 'Projected shortfall' : status === 'allocated' ? 'Fully allocated' : 'Projected cushion'
}

export function forecastStatusClass(status: ForecastViewModel['status']) {
  return status === 'shortfall' ? 'text-rose-100' : status === 'allocated' ? 'text-slate-100' : 'text-emerald-100'
}
