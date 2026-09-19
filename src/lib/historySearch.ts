import { parseDateOnly } from './dateOnly'
import type { Bill, Expense, PayPeriodSnapshot } from '../types/budget'

export const HISTORY_ACTIVITY_RESULT_LIMIT = 50

export type HistoryActivityResult = {
  key: string
  snapshotId: string
  snapshotLabel: string
  itemId: string
  kind: 'bill' | 'expense'
  name: string
  amount: number
  category: string
  date: string | null
  context: string[]
}

type Candidate = HistoryActivityResult & { snapshotOrder: number; itemDateOrder: number | null; itemOrder: number }

export function normalizeHistorySearchQuery(value: string) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase() : ''
}

function safeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback
}

function usableDate(value: unknown) {
  return typeof value === 'string' && parseDateOnly(value) ? value : null
}

function dateOrder(value: unknown) {
  const date = usableDate(value)
  return date ? Date.parse(`${date}T00:00:00Z`) : null
}

function snapshotOrder(snapshot: PayPeriodSnapshot, index: number) {
  const archived = typeof snapshot.archivedAt === 'string' ? Date.parse(snapshot.archivedAt) : Number.NaN
  if (Number.isFinite(archived)) return archived
  return dateOrder(snapshot.endDate) ?? dateOrder(snapshot.startDate) ?? -index
}

function matchesQuery(query: string, name: string, category: string) {
  return normalizeHistorySearchQuery(`${name} ${category}`).includes(query)
}

function billContext(bill: Bill) {
  return [bill.isPaid ? 'Paid' : 'Unpaid', ...(bill.source === 'recurring' ? ['Recurring'] : []), ...(bill.carriedOverFromPayPeriodId ? ['Carried over'] : [])]
}

function expenseContext(expense: Expense) {
  return [
    ...(expense.source === 'recurring' ? ['Recurring'] : []),
    ...(expense.isPlanned ? ['Planned expense'] : []),
    ...(expense.setAsideForTemplateId ? ['Set-aside'] : []),
  ]
}

function collectItem(params: {
  item: Bill | Expense
  kind: 'bill' | 'expense'
  snapshot: PayPeriodSnapshot
  snapshotIndex: number
  itemIndex: number
  query: string
}): Candidate | null {
  const name = safeText(params.item.name)
  const category = safeText(params.item.category, 'Uncategorized')
  if (!name || !Number.isFinite(params.item.amount) || !matchesQuery(params.query, name, category)) return null

  const date = usableDate(params.kind === 'bill' ? (params.item as Bill).dueDate : (params.item as Expense).date)
  const itemId = safeText(params.item.id, `${params.kind}-${params.itemIndex}`)
  return {
    key: `${safeText(params.snapshot.id, `snapshot-${params.snapshotIndex}`)}:${params.kind}:${itemId}:${params.itemIndex}`,
    snapshotId: safeText(params.snapshot.id),
    snapshotLabel: safeText(params.snapshot.label, 'Archived pay period'),
    itemId,
    kind: params.kind,
    name,
    amount: params.item.amount,
    category,
    date,
    context: params.kind === 'bill' ? billContext(params.item as Bill) : expenseContext(params.item as Expense),
    snapshotOrder: snapshotOrder(params.snapshot, params.snapshotIndex),
    itemDateOrder: dateOrder(date),
    itemOrder: params.itemIndex,
  }
}

export function searchHistoryActivity(snapshots: readonly PayPeriodSnapshot[], queryInput: string, limit = HISTORY_ACTIVITY_RESULT_LIMIT) {
  const query = normalizeHistorySearchQuery(queryInput)
  if (!query) return { query, results: [] as HistoryActivityResult[], isLimited: false }

  const candidates: Candidate[] = []
  snapshots.forEach((snapshot, snapshotIndex) => {
    if (!snapshot || typeof snapshot !== 'object') return
    const bills = Array.isArray(snapshot.bills) ? snapshot.bills : []
    const expenses = Array.isArray(snapshot.expenses) ? snapshot.expenses : []
    bills.forEach((item, itemIndex) => {
      const result = item && typeof item === 'object' ? collectItem({ item: item as Bill, kind: 'bill', snapshot, snapshotIndex, itemIndex, query }) : null
      if (result) candidates.push(result)
    })
    expenses.forEach((item, itemIndex) => {
      const result = item && typeof item === 'object' ? collectItem({ item: item as Expense, kind: 'expense', snapshot, snapshotIndex, itemIndex, query }) : null
      if (result) candidates.push(result)
    })
  })

  candidates.sort((left, right) => right.snapshotOrder - left.snapshotOrder || (right.itemDateOrder ?? Number.NEGATIVE_INFINITY) - (left.itemDateOrder ?? Number.NEGATIVE_INFINITY) || left.itemOrder - right.itemOrder)
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : HISTORY_ACTIVITY_RESULT_LIMIT
  return { query, results: candidates.slice(0, safeLimit), isLimited: candidates.length > safeLimit }
}
