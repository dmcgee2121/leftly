import type { Bill, Expense, PayPeriodSnapshot } from '../types/budget'

export type InsightRange = 3 | 6 | 12 | 'all'
export type InsightDirection = 'up' | 'down' | 'unchanged'

export type InsightComparison = {
  latest: number
  previous: number
  difference: number
  direction: InsightDirection
}

export type InsightCategoryRow = {
  category: string
  total: number
  average: number
  share: number
  count: number
}

export type InsightBillMeasure = { count: number; amount: number }

export type InsightBillFollowThrough = {
  paidOnOrBeforeDue: InsightBillMeasure
  paidAfterDue: InsightBillMeasure
  paidDateUnavailable: InsightBillMeasure
  unpaidAtArchive: InsightBillMeasure
  carriedOver: InsightBillMeasure
}

export type RepeatedBillAttention = {
  label: string
  appearances: number
  latePaid: number
  unpaidAtArchive: number
  carriedOver: number
}

export type PayPeriodInsights = {
  range: InsightRange
  availableSnapshots: number
  excludedSnapshotCount: number
  selectedSnapshots: PayPeriodSnapshot[]
  selectedCount: number
  rangeLabel: string
  averages: {
    income: number
    bills: number
    spendingExcludingSetAsides: number
    setAsides: number
    leftover: number
  }
  totals: {
    income: number
    bills: number
    spendingExcludingSetAsides: number
    setAsides: number
    leftover: number
  }
  comparison: {
    latest: PayPeriodSnapshot
    previous: PayPeriodSnapshot
    periodsLabel: string
    metrics: {
      income: InsightComparison
      bills: InsightComparison
      spendingExcludingSetAsides: InsightComparison
      setAsides: InsightComparison
      leftover: InsightComparison
    }
  } | null
  categories: InsightCategoryRow[]
  billFollowThrough: InsightBillFollowThrough
  repeatedBillAttention: RepeatedBillAttention[]
  state: 'empty' | 'single' | 'comparison' | 'range'
}

type DateParts = { year: number; month: number; day: number }

function parseDateOnly(value: unknown): DateParts | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? { year, month, day } : null
}

function dateValue(value: unknown) {
  const date = parseDateOnly(value)
  return date ? Date.UTC(date.year, date.month - 1, date.day) : null
}

function formatRange(start: string, end: string) {
  return `${start} to ${end}`
}

function safeCents(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null
}

function fromCents(value: number) {
  return Math.round(value) / 100
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function billAmount(bill: Bill) {
  const amount = safeCents(bill.amount)
  return amount === null ? 0 : amount
}

function expenseAmount(expense: Expense) {
  const amount = safeCents(expense.amount)
  return amount === null ? 0 : amount
}

function snapshotBills(snapshot: PayPeriodSnapshot) {
  return safeArray<Bill>(snapshot.bills)
}

function snapshotExpenses(snapshot: PayPeriodSnapshot) {
  return safeArray<Expense>(snapshot.expenses)
}

function totalBills(snapshot: PayPeriodSnapshot) {
  const stored = safeCents(snapshot.totals?.totalBills)
  return stored === null ? snapshotBills(snapshot).reduce((sum, bill) => sum + billAmount(bill), 0) : stored
}

function spending(snapshot: PayPeriodSnapshot) {
  return snapshotExpenses(snapshot).reduce((sum, expense) => sum + (expense.setAsideForTemplateId ? 0 : expenseAmount(expense)), 0)
}

function setAsides(snapshot: PayPeriodSnapshot) {
  return snapshotExpenses(snapshot).reduce((sum, expense) => sum + (expense.setAsideForTemplateId ? expenseAmount(expense) : 0), 0)
}

function snapshotMetric(snapshot: PayPeriodSnapshot, metric: 'income' | 'leftover') {
  const value = safeCents(metric === 'income' ? snapshot.income : snapshot.totals?.leftover)
  return value === null ? 0 : value
}

function compare(latest: number, previous: number): InsightComparison {
  const difference = latest - previous
  return { latest: fromCents(latest), previous: fromCents(previous), difference: fromCents(difference), direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'unchanged' }
}

function isValidSnapshot(snapshot: PayPeriodSnapshot) {
  const start = dateValue(snapshot?.startDate)
  const end = dateValue(snapshot?.endDate)
  return start !== null && end !== null && start <= end
}

function billAttention(snapshot: PayPeriodSnapshot, bill: Bill) {
  const dueDate = dateValue(bill.dueDate)
  const paidDate = dateValue(bill.paidDate)
  const late = Boolean(bill.isPaid && dueDate !== null && paidDate !== null && paidDate > dueDate)
  const onOrBefore = Boolean(bill.isPaid && dueDate !== null && paidDate !== null && paidDate <= dueDate)
  const paidDateUnavailable = Boolean(bill.isPaid && !onOrBefore && !late)
  const unpaid = bill.isPaid === false
  const carried = Boolean(bill.carriedOverFromPayPeriodId)
  return { dueDate, paidDate, late, onOrBefore, paidDateUnavailable, unpaid, carried, amount: billAmount(bill), snapshotId: snapshot.id }
}

export function buildPayPeriodInsights(snapshots: PayPeriodSnapshot[], range: InsightRange): PayPeriodInsights {
  const valid = safeArray<PayPeriodSnapshot>(snapshots).filter(isValidSnapshot).sort((left, right) => {
    return (dateValue(left.startDate) as number) - (dateValue(right.startDate) as number) || (dateValue(left.endDate) as number) - (dateValue(right.endDate) as number)
  })
  const selected = range === 'all' ? valid : valid.slice(-range)
  const selectedCount = selected.length
  const count = Math.max(1, selectedCount)
  const metricTotals = selected.reduce(
    (totals, snapshot) => {
      totals.income += snapshotMetric(snapshot, 'income')
      totals.bills += totalBills(snapshot)
      totals.spending += spending(snapshot)
      totals.setAsides += setAsides(snapshot)
      totals.leftover += snapshotMetric(snapshot, 'leftover')
      return totals
    },
    { income: 0, bills: 0, spending: 0, setAsides: 0, leftover: 0 },
  )

  const categories = new Map<string, { total: number; count: number }>()
  let totalCategorySpending = 0
  for (const snapshot of selected) {
    for (const expense of snapshotExpenses(snapshot)) {
      if (expense.setAsideForTemplateId) continue
      const amount = expenseAmount(expense)
      totalCategorySpending += amount
      const current = categories.get(expense.category) ?? { total: 0, count: 0 }
      current.total += amount
      current.count += 1
      categories.set(expense.category, current)
    }
  }

  const categoryRows = [...categories.entries()]
    .map(([category, value]) => ({ category, total: fromCents(value.total), average: fromCents(Math.round(value.total / count)), share: totalCategorySpending > 0 ? value.total / totalCategorySpending : 0, count: value.count }))
    .sort((left, right) => right.total - left.total || left.category.localeCompare(right.category))

  const followThrough: InsightBillFollowThrough = {
    paidOnOrBeforeDue: { count: 0, amount: 0 },
    paidAfterDue: { count: 0, amount: 0 },
    paidDateUnavailable: { count: 0, amount: 0 },
    unpaidAtArchive: { count: 0, amount: 0 },
    carriedOver: { count: 0, amount: 0 },
  }
  const billGroups = new Map<string, RepeatedBillAttention & { periodIds: Set<string> }>()

  for (const snapshot of selected) {
    for (const bill of snapshotBills(snapshot)) {
      const attention = billAttention(snapshot, bill)
      if (attention.onOrBefore) {
        followThrough.paidOnOrBeforeDue.count += 1
        followThrough.paidOnOrBeforeDue.amount += attention.amount
      } else if (attention.late) {
        followThrough.paidAfterDue.count += 1
        followThrough.paidAfterDue.amount += attention.amount
      } else if (attention.paidDateUnavailable) {
        followThrough.paidDateUnavailable.count += 1
        followThrough.paidDateUnavailable.amount += attention.amount
      } else if (attention.unpaid) {
        followThrough.unpaidAtArchive.count += 1
        followThrough.unpaidAtArchive.amount += attention.amount
      }
      if (attention.carried) {
        followThrough.carriedOver.count += 1
        followThrough.carriedOver.amount += attention.amount
      }

      const fallbackKey = `${typeof bill.name === 'string' ? bill.name.trim().toLocaleLowerCase() : ''}:${typeof bill.category === 'string' ? bill.category : ''}`
      const key = bill.templateId || fallbackKey
      const group = billGroups.get(key) ?? { label: bill.name || 'Unnamed bill', appearances: 0, latePaid: 0, unpaidAtArchive: 0, carriedOver: 0, periodIds: new Set<string>() }
      if (!group.periodIds.has(snapshot.id)) {
        group.periodIds.add(snapshot.id)
        group.appearances += 1
      }
      if (attention.late) group.latePaid += 1
      if (attention.unpaid) group.unpaidAtArchive += 1
      if (attention.carried) group.carriedOver += 1
      billGroups.set(key, group)
    }
  }

  const repeatedBillAttention = [...billGroups.values()]
    .filter((group) => group.appearances >= 2 && group.latePaid + group.unpaidAtArchive + group.carriedOver >= 2)
    .map((group) => ({
      label: group.label,
      appearances: group.appearances,
      latePaid: group.latePaid,
      unpaidAtArchive: group.unpaidAtArchive,
      carriedOver: group.carriedOver,
    }))
    .sort((left, right) => right.appearances - left.appearances || left.label.localeCompare(right.label))

  const billFollowThrough: InsightBillFollowThrough = {
    paidOnOrBeforeDue: { ...followThrough.paidOnOrBeforeDue, amount: fromCents(followThrough.paidOnOrBeforeDue.amount) },
    paidAfterDue: { ...followThrough.paidAfterDue, amount: fromCents(followThrough.paidAfterDue.amount) },
    paidDateUnavailable: { ...followThrough.paidDateUnavailable, amount: fromCents(followThrough.paidDateUnavailable.amount) },
    unpaidAtArchive: { ...followThrough.unpaidAtArchive, amount: fromCents(followThrough.unpaidAtArchive.amount) },
    carriedOver: { ...followThrough.carriedOver, amount: fromCents(followThrough.carriedOver.amount) },
  }

  let comparison: PayPeriodInsights['comparison'] = null
  if (selectedCount >= 2) {
    const previous = selected[selectedCount - 2]
    const latest = selected[selectedCount - 1]
    comparison = {
      latest,
      previous,
      periodsLabel: `${formatRange(previous.startDate, previous.endDate)} → ${formatRange(latest.startDate, latest.endDate)}`,
      metrics: {
        income: compare(snapshotMetric(latest, 'income'), snapshotMetric(previous, 'income')),
        bills: compare(totalBills(latest), totalBills(previous)),
        spendingExcludingSetAsides: compare(spending(latest), spending(previous)),
        setAsides: compare(setAsides(latest), setAsides(previous)),
        leftover: compare(snapshotMetric(latest, 'leftover'), snapshotMetric(previous, 'leftover')),
      },
    }
  }

  return {
    range,
    availableSnapshots: valid.length,
    excludedSnapshotCount: safeArray<PayPeriodSnapshot>(snapshots).length - valid.length,
    selectedSnapshots: selected,
    selectedCount,
    rangeLabel: selectedCount > 0 ? formatRange(selected[0].startDate, selected[selectedCount - 1].endDate) : 'No archived periods selected',
    averages: {
      income: fromCents(Math.round(metricTotals.income / count)),
      bills: fromCents(Math.round(metricTotals.bills / count)),
      spendingExcludingSetAsides: fromCents(Math.round(metricTotals.spending / count)),
      setAsides: fromCents(Math.round(metricTotals.setAsides / count)),
      leftover: fromCents(Math.round(metricTotals.leftover / count)),
    },
    totals: {
      income: fromCents(metricTotals.income),
      bills: fromCents(metricTotals.bills),
      spendingExcludingSetAsides: fromCents(metricTotals.spending),
      setAsides: fromCents(metricTotals.setAsides),
      leftover: fromCents(metricTotals.leftover),
    },
    comparison,
    categories: categoryRows,
    billFollowThrough,
    repeatedBillAttention,
    state: selectedCount === 0 ? 'empty' : selectedCount === 1 ? 'single' : selectedCount === 2 ? 'comparison' : 'range',
  }
}
