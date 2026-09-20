import type { Bill, Expense } from '../types/budget'

export type RecentActivityItem =
  | { kind: 'bill'; item: Bill }
  | { kind: 'expense'; item: Expense }

function activityTime(activity: RecentActivityItem) {
  const createdAt = activity.item.createdAt ? Date.parse(activity.item.createdAt) : Number.NaN
  if (Number.isFinite(createdAt)) return createdAt

  const dateOnly = activity.kind === 'bill' ? activity.item.dueDate : activity.item.date
  const dateTime = Date.parse(`${dateOnly}T00:00:00`)
  return Number.isFinite(dateTime) ? dateTime : 0
}

export function buildRecentActivity(bills: Bill[], expenses: Expense[], limit = 5): RecentActivityItem[] {
  return [
    ...bills.map((item) => ({ kind: 'bill' as const, item })),
    ...expenses.map((item) => ({ kind: 'expense' as const, item })),
  ]
    .sort((left, right) => activityTime(right) - activityTime(left) || left.item.name.localeCompare(right.item.name))
    .slice(0, Math.max(0, limit))
}
