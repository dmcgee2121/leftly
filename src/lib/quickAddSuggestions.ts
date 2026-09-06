import { parseDateOnly } from './dateOnly'
import type { BudgetCategory, Expense, PayPeriodSnapshot } from '../types/budget'

export type QuickAddSuggestionSource = 'current-period' | 'history'

export type QuickAddSuggestion = {
  key: string
  name: string
  amount: number
  category: BudgetCategory
  source: QuickAddSuggestionSource
  sourcePeriodLabel?: string
}

type SuggestionCandidate = QuickAddSuggestion & { date: string; createdAt?: string; order: number }

function normalizedIdentity(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function dateOnlyTimestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const parts = parseDateOnly(value)
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : null
}

function timestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : null
}

function compareDatesDescending(left: SuggestionCandidate, right: SuggestionCandidate) {
  const leftDate = dateOnlyTimestamp(left.date)
  const rightDate = dateOnlyTimestamp(right.date)
  if (leftDate !== null && rightDate !== null && leftDate !== rightDate) return rightDate - leftDate
  if (leftDate !== null && rightDate === null) return -1
  if (leftDate === null && rightDate !== null) return 1

  const leftCreated = timestamp(left.createdAt)
  const rightCreated = timestamp(right.createdAt)
  if (leftCreated !== null && rightCreated !== null && leftCreated !== rightCreated) return rightCreated - leftCreated
  if (leftCreated !== null && rightCreated === null) return -1
  if (leftCreated === null && rightCreated !== null) return 1
  return left.order - right.order
}

function isEligibleExpense(expense: Expense, categories: ReadonlySet<string>) {
  return (
    typeof expense?.name === 'string' &&
    expense.name.trim().length > 0 &&
    Number.isFinite(expense.amount) &&
    expense.amount > 0 &&
    expense.source !== 'recurring' &&
    !expense.setAsideForTemplateId &&
    !expense.isPlanned &&
    typeof expense.category === 'string' &&
    categories.has(expense.category)
  )
}

function toCandidate(expense: Expense, source: QuickAddSuggestionSource, sourcePeriodLabel: string | undefined, order: number): SuggestionCandidate {
  const identity = `${normalizedIdentity(expense.name)}|${normalizedIdentity(expense.category)}`
  return {
    key: `quick-add:${identity}`,
    name: expense.name,
    amount: expense.amount,
    category: expense.category,
    source,
    sourcePeriodLabel,
    date: expense.date,
    createdAt: expense.createdAt,
    order,
  }
}

function snapshotSortValue(snapshot: PayPeriodSnapshot) {
  return dateOnlyTimestamp(snapshot.endDate) ?? dateOnlyTimestamp(snapshot.startDate)
}

function compareSnapshotsDescending(left: { snapshot: PayPeriodSnapshot; order: number }, right: { snapshot: PayPeriodSnapshot; order: number }) {
  const leftDate = snapshotSortValue(left.snapshot)
  const rightDate = snapshotSortValue(right.snapshot)
  if (leftDate !== null && rightDate !== null && leftDate !== rightDate) return rightDate - leftDate
  if (leftDate !== null && rightDate === null) return -1
  if (leftDate === null && rightDate !== null) return 1

  const leftArchived = timestamp(left.snapshot.archivedAt) ?? timestamp(left.snapshot.createdAt)
  const rightArchived = timestamp(right.snapshot.archivedAt) ?? timestamp(right.snapshot.createdAt)
  if (leftArchived !== null && rightArchived !== null && leftArchived !== rightArchived) return rightArchived - leftArchived
  if (leftArchived !== null && rightArchived === null) return -1
  if (leftArchived === null && rightArchived !== null) return 1
  return left.order - right.order
}

export function buildQuickAddSuggestions({
  activeExpenses,
  payPeriodHistory,
  currentCategories,
  limit = 6,
}: {
  activeExpenses: readonly Expense[]
  payPeriodHistory: readonly PayPeriodSnapshot[]
  currentCategories: readonly BudgetCategory[]
  limit?: number
}): QuickAddSuggestion[] {
  const categories = new Set(currentCategories)
  const candidates: SuggestionCandidate[] = activeExpenses
    .filter((expense) => isEligibleExpense(expense, categories))
    .map((expense, order) => toCandidate(expense, 'current-period', undefined, order))
    .sort(compareDatesDescending)

  const snapshots = payPeriodHistory
    .map((snapshot, order) => ({ snapshot, order }))
    .filter(({ snapshot }) => snapshot && Array.isArray(snapshot.expenses))
    .sort(compareSnapshotsDescending)

  let historyOrder = 0
  for (const { snapshot } of snapshots) {
    candidates.push(
      ...snapshot.expenses
        .filter((expense) => isEligibleExpense(expense, categories))
        .map((expense) => toCandidate(expense, 'history', typeof snapshot.label === 'string' ? snapshot.label : undefined, historyOrder++))
        .sort(compareDatesDescending),
    )
  }

  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 6
  const seen = new Set<string>()
  const suggestions: QuickAddSuggestion[] = []
  for (const candidate of candidates) {
    if (seen.has(candidate.key)) continue
    seen.add(candidate.key)
    suggestions.push({
      key: candidate.key,
      name: candidate.name,
      amount: candidate.amount,
      category: candidate.category,
      source: candidate.source,
      sourcePeriodLabel: candidate.sourcePeriodLabel,
    })
    if (suggestions.length >= safeLimit) break
  }
  return suggestions
}
