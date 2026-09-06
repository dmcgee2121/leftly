import { deriveFollowingDateOnlyRange, deriveNextDateOnlyRange, type DateOnlyRange } from './dateOnly'
import {
  buildRecurringPreview,
  normalizeRecurringPlanName,
  type RecurringPreviewItem,
} from './recurring'
import type { BudgetPeriod, RecurringItemTemplate } from '../types/budget'

export type PlanningHorizonLength = 3 | 6
export type PlanningPlanFilter = 'all' | string
export type PlanningOccurrenceType = 'bill' | 'planned-expense' | 'set-aside'

export type PlanningOccurrence = {
  id: string
  templateId: string
  type: PlanningOccurrenceType
  name: string
  amount: number
  category: string
  planName: string
  scheduleLabel: string
  projectedDate: string
  periodIndex: number
}

export type PlanningPeriod = DateOnlyRange & {
  index: number
  total: number
  billsTotal: number
  plannedExpensesTotal: number
  setAsidesTotal: number
  occurrenceCount: number
  occurrences: PlanningOccurrence[]
}

export type PlanningPlanTotal = {
  planName: string
  total: number
  occurrenceCount: number
}

export type PlanningHorizon = {
  available: boolean
  unavailableReason?: string
  emptyReason?: 'no-active-templates'
  horizonLength: PlanningHorizonLength
  horizonLabel: string
  periods: PlanningPeriod[]
  activeTemplateCount: number
  totalProjectedAmount: number
  billsTotal: number
  plannedExpensesTotal: number
  setAsidesTotal: number
  occurrenceCount: number
  planTotals: PlanningPlanTotal[]
}

function cents(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

function dollars(value: number) {
  return value / 100
}

function sumCents(values: number[]) {
  return values.reduce((total, value) => total + cents(value), 0)
}

function createUnavailable(length: PlanningHorizonLength, reason: string): PlanningHorizon {
  return {
    available: false,
    unavailableReason: reason,
    horizonLength: length,
    horizonLabel: `Next ${length} estimated pay periods`,
    periods: [],
    activeTemplateCount: 0,
    totalProjectedAmount: 0,
    billsTotal: 0,
    plannedExpensesTotal: 0,
    setAsidesTotal: 0,
    occurrenceCount: 0,
    planTotals: [],
  }
}

function makePeriod(activePeriod: BudgetPeriod, range: DateOnlyRange): BudgetPeriod {
  return { ...activePeriod, startDate: range.startDate, endDate: range.endDate }
}

function toOccurrence(item: RecurringPreviewItem, type: PlanningOccurrenceType, date: string, periodIndex: number): PlanningOccurrence {
  return {
    id: `${type}:${item.templateId}:${date}:${periodIndex}`,
    templateId: item.templateId,
    type,
    name: item.name,
    amount: dollars(cents(item.amount)),
    category: item.category,
    planName: item.planName,
    scheduleLabel: item.scheduleLabel,
    projectedDate: date,
    periodIndex,
  }
}

function sortOccurrences(left: PlanningOccurrence, right: PlanningOccurrence) {
  return left.projectedDate.localeCompare(right.projectedDate) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
}

function buildPeriodOccurrences(preview: ReturnType<typeof buildRecurringPreview>, range: DateOnlyRange, periodIndex: number) {
  const occurrences = [
    ...preview.bills.map((item) => toOccurrence(item, 'bill', item.dateLabel, periodIndex)),
    ...preview.plannedExpenses.map((item) => toOccurrence(item, 'planned-expense', item.dateLabel, periodIndex)),
    ...preview.setAsides.map((item) => toOccurrence(item, 'set-aside', range.startDate, periodIndex)),
  ].sort(sortOccurrences)
  const bills = occurrences.filter((item) => item.type === 'bill')
  const plannedExpenses = occurrences.filter((item) => item.type === 'planned-expense')
  const setAsides = occurrences.filter((item) => item.type === 'set-aside')

  return {
    occurrences,
    billsTotal: dollars(sumCents(bills.map((item) => item.amount))),
    plannedExpensesTotal: dollars(sumCents(plannedExpenses.map((item) => item.amount))),
    setAsidesTotal: dollars(sumCents(setAsides.map((item) => item.amount))),
  }
}

export function getPlanningPlanNames(templates: RecurringItemTemplate[]) {
  return [...new Set(templates.filter((template) => template.isActive).map((template) => normalizeRecurringPlanName(template.planName)))].sort((left, right) => left.localeCompare(right))
}

export function buildPlanningHorizon(params: {
  activePayPeriod: BudgetPeriod | null
  templates: RecurringItemTemplate[]
  horizonLength?: PlanningHorizonLength
  planFilter?: PlanningPlanFilter
}): PlanningHorizon {
  const horizonLength = params.horizonLength ?? 3
  const activeTemplates = params.templates.filter((template) => {
    if (!template.isActive) return false
    return params.planFilter === undefined || params.planFilter === 'all' || normalizeRecurringPlanName(template.planName) === params.planFilter
  })
  if (!params.activePayPeriod) return createUnavailable(horizonLength, 'An active pay period is needed to estimate future ranges.')
  if (activeTemplates.length === 0) {
    return {
      ...createUnavailable(horizonLength, 'No active Bill Plan items are available for this plan.'),
      available: true,
      unavailableReason: undefined,
      emptyReason: 'no-active-templates',
    }
  }

  const firstRange = deriveNextDateOnlyRange(params.activePayPeriod.startDate, params.activePayPeriod.endDate)
  if (!firstRange) return createUnavailable(horizonLength, 'The active pay-period dates are missing or invalid.')

  const ranges: DateOnlyRange[] = [firstRange]
  while (ranges.length < horizonLength) {
    const next = deriveFollowingDateOnlyRange(ranges[ranges.length - 1], firstRange.duration)
    if (!next) return createUnavailable(horizonLength, 'Future pay-period dates could not be derived safely.')
    ranges.push(next)
  }

  const periods = ranges.map((range, index) => {
    const preview = buildRecurringPreview({ templates: activeTemplates, period: makePeriod(params.activePayPeriod as BudgetPeriod, range) })
    const projected = buildPeriodOccurrences(preview, range, index)
    const total = dollars(sumCents(projected.occurrences.map((item) => item.amount)))
    return {
      ...range,
      index,
      total,
      billsTotal: projected.billsTotal,
      plannedExpensesTotal: projected.plannedExpensesTotal,
      setAsidesTotal: projected.setAsidesTotal,
      occurrenceCount: projected.occurrences.length,
      occurrences: projected.occurrences,
    }
  })

  const allOccurrences = periods.flatMap((period) => period.occurrences)
  const planTotals = [...new Set(allOccurrences.map((item) => item.planName))]
    .map((planName) => ({
      planName,
      total: dollars(sumCents(allOccurrences.filter((item) => item.planName === planName).map((item) => item.amount))),
      occurrenceCount: allOccurrences.filter((item) => item.planName === planName).length,
    }))
    .sort((left, right) => left.planName.localeCompare(right.planName))

  return {
    available: true,
    horizonLength,
    horizonLabel: `Next ${horizonLength} estimated pay periods`,
    periods,
    activeTemplateCount: new Set(allOccurrences.map((item) => item.templateId)).size,
    totalProjectedAmount: dollars(sumCents(allOccurrences.map((item) => item.amount))),
    billsTotal: dollars(sumCents(periods.map((period) => period.billsTotal))),
    plannedExpensesTotal: dollars(sumCents(periods.map((period) => period.plannedExpensesTotal))),
    setAsidesTotal: dollars(sumCents(periods.map((period) => period.setAsidesTotal))),
    occurrenceCount: allOccurrences.length,
    planTotals,
  }
}
