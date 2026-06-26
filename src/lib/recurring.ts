import type {
  Bill,
  BudgetCategory,
  BudgetPeriod,
  Expense,
  RecurringItemTemplate,
  RecurringScheduleType,
} from '../types/budget'

export const MAIN_BILL_PLAN = 'Main Bill Plan'

export type RecurringPreviewItem = {
  templateId: string
  kind: 'bill' | 'planned-expense'
  name: string
  amount: number
  category: BudgetCategory
  dateLabel: string
  frequency: RecurringItemTemplate['frequency']
  planName: string
  scheduleType: RecurringScheduleType
  scheduleLabel: string
  occurrenceLabel: string
  isSetAside?: boolean
}

export type RecurringPreviewGroups = {
  bills: RecurringPreviewItem[]
  setAsides: RecurringPreviewItem[]
  plannedExpenses: RecurringPreviewItem[]
  total: number
}

type GenerateRecurringArgs = {
  templates: RecurringItemTemplate[]
  period: BudgetPeriod
  existingBills?: Bill[]
  existingExpenses?: Expense[]
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function isWithin(value: Date, start: Date, end: Date) {
  return value.getTime() >= start.getTime() && value.getTime() <= end.getTime()
}

function getPeriodKey(period: BudgetPeriod) {
  return `${period.cadence}:${period.startDate}:${period.endDate}`
}

export function getRecurringOccurrenceKey(params: {
  kind: RecurringPreviewItem['kind']
  templateId: string
  dateLabel: string
  periodKey: string
}) {
  return `${params.kind}:${params.templateId}:${params.dateLabel}:${params.periodKey}`
}

export function getRecurringSetAsideKey(templateId: string, periodKey: string) {
  return `expense:set-aside:${templateId}:${periodKey}`
}

export function normalizeRecurringPlanName(planName?: string) {
  return planName?.trim() || MAIN_BILL_PLAN
}

const weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const shortWeekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function isValidWeekday(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

function getWeekdayFromIsoDate(value: string) {
  const date = parseDate(value)
  return Number.isNaN(date.getTime()) ? undefined : date.getDay()
}

export function normalizeRecurringWeekday(value: unknown) {
  return isValidWeekday(value) ? value : undefined
}

export function normalizeRecurringScheduleType(
  template: Pick<RecurringItemTemplate, 'scheduleType' | 'frequency' | 'dueDay' | 'dayOfWeek' | 'anchorDate'>,
) {
  if (template.scheduleType === 'monthly' || template.scheduleType === 'weekly' || template.scheduleType === 'biweekly') {
    return template.scheduleType
  }

  if (template.frequency === 'monthly' || template.frequency === 'weekly' || template.frequency === 'biweekly') {
    return template.frequency
  }

  if (typeof template.dueDay === 'number') {
    return 'monthly'
  }

  if (isValidWeekday(template.dayOfWeek) || template.anchorDate) {
    return 'weekly'
  }

  return 'monthly'
}

export function formatWeekday(dayOfWeek: number, style: 'long' | 'short' = 'long') {
  const labels = style === 'short' ? shortWeekdayLabels : weekdayLabels
  return labels[dayOfWeek] ?? ''
}

export function alignIsoDateToWeekdayOnOrAfter(value: string, dayOfWeek: number) {
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const next = new Date(date)
  while (next.getDay() !== dayOfWeek) {
    next.setDate(next.getDate() + 1)
  }

  return formatDate(next)
}

export function formatOrdinalDay(day: number) {
  const normalized = Math.trunc(Math.abs(day))
  const lastTwo = normalized % 100
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${normalized}th`
  }

  switch (normalized % 10) {
    case 1:
      return `${normalized}st`
    case 2:
      return `${normalized}nd`
    case 3:
      return `${normalized}rd`
    default:
      return `${normalized}th`
  }
}

export function formatMonthlyDueDay(day: number) {
  return `${formatOrdinalDay(day)} of each month`
}

export function formatRecurringScheduleLabel(
  template: Pick<RecurringItemTemplate, 'scheduleType' | 'frequency' | 'dueDay' | 'dayOfWeek' | 'anchorDate'>,
) {
  if (template.frequency === 'one-time') {
    return 'One-time'
  }

  if (template.frequency === 'every-pay-period') {
    return 'Every pay period'
  }

  const scheduleType = normalizeRecurringScheduleType(template)

  if (scheduleType === 'monthly') {
    return template.dueDay ? formatMonthlyDueDay(template.dueDay) : 'Monthly'
  }

  const weekday = normalizeRecurringWeekday(template.dayOfWeek) ?? (template.anchorDate ? getWeekdayFromIsoDate(template.anchorDate) : undefined)
  if (weekday === undefined) {
    return scheduleType === 'biweekly' ? 'Every other week' : 'Every week'
  }

  return scheduleType === 'biweekly' ? `Every other ${formatWeekday(weekday)}` : `Every ${formatWeekday(weekday)}`
}

export function formatRecurringOccurrenceLabel(dateLabel: string) {
  const date = parseDate(dateLabel)
  if (Number.isNaN(date.getTime())) {
    return dateLabel
  }

  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

function getOccurrences(template: RecurringItemTemplate, period: BudgetPeriod) {
  const start = parseDate(period.startDate)
  const end = parseDate(period.endDate)
  const scheduleType = normalizeRecurringScheduleType(template)

  if (!template.isActive) {
    return [] as string[]
  }

  if (template.frequency === 'every-pay-period') {
    return [period.startDate]
  }

  if (template.frequency === 'one-time') {
    if (!template.anchorDate) {
      return []
    }

    const anchor = parseDate(template.anchorDate)
    return isWithin(anchor, start, end) ? [template.anchorDate] : []
  }

  if (scheduleType === 'monthly') {
    if (!template.dueDay) {
      return []
    }

    const results: string[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const endCursor = new Date(end.getFullYear(), end.getMonth(), 1)

    while (cursor.getTime() <= endCursor.getTime()) {
      const year = cursor.getFullYear()
      const month = cursor.getMonth()
      const dueDate = new Date(year, month, Math.min(template.dueDay, daysInMonth(year, month)))

      if (isWithin(dueDate, start, end)) {
        results.push(formatDate(dueDate))
      }

      cursor.setMonth(cursor.getMonth() + 1)
    }

    return results
  }

  if (scheduleType === 'weekly') {
    const weekday = normalizeRecurringWeekday(template.dayOfWeek) ?? (template.anchorDate ? getWeekdayFromIsoDate(template.anchorDate) : undefined)
    if (weekday === undefined) {
      return []
    }

    const results: string[] = []
    for (let current = new Date(start); current.getTime() <= end.getTime(); current = addDays(current, 1)) {
      if (current.getDay() === weekday) {
        results.push(formatDate(current))
      }
    }

    return results
  }

  if (scheduleType === 'biweekly') {
    if (!template.anchorDate) {
      return []
    }

    const anchor = parseDate(template.anchorDate)
    if (anchor.getTime() > end.getTime()) {
      return []
    }

    let candidate = new Date(anchor)
    while (candidate.getTime() < start.getTime()) {
      candidate = addDays(candidate, 14)
    }

    const results: string[] = []
    while (candidate.getTime() <= end.getTime()) {
      results.push(formatDate(candidate))
      candidate = addDays(candidate, 14)
    }

    return results
  }

  return []
}

function createBill(template: RecurringItemTemplate, date: string, periodKey: string): Bill {
  return {
    id: crypto.randomUUID(),
    name: template.name,
    amount: template.amount,
    dueDate: date,
    isPaid: false,
    paidDate: null,
    category: template.category,
    source: 'recurring',
    templateId: template.id,
    generatedForPeriodId: periodKey,
  }
}

function createExpense(template: RecurringItemTemplate, date: string, periodKey: string): Expense {
  return {
    id: crypto.randomUUID(),
    name: template.name,
    amount: template.amount,
    date,
    category: template.category,
    isPlanned: true,
    source: 'recurring',
    templateId: template.id,
    generatedForPeriodId: periodKey,
  }
}

function createSetAsideExpense(template: RecurringItemTemplate, period: BudgetPeriod, periodKey: string): Expense {
  const setAsideAmount = template.setAsideAmount ?? 0
  return {
    id: crypto.randomUUID(),
    name: `${template.name} set-aside`,
    amount: setAsideAmount,
    date: period.startDate,
    category: template.category,
    isPlanned: true,
    source: 'recurring',
    templateId: template.id,
    generatedForPeriodId: periodKey,
    setAsideForTemplateId: template.id,
  }
}

export function buildRecurringPreview({ templates, period }: { templates: RecurringItemTemplate[]; period: BudgetPeriod }): RecurringPreviewGroups {
  const bills: RecurringPreviewItem[] = []
  const setAsides: RecurringPreviewItem[] = []
  const plannedExpenses: RecurringPreviewItem[] = []

  for (const template of templates) {
    const occurrences = getOccurrences(template, period)
    for (const dateLabel of occurrences) {
        const scheduleType = normalizeRecurringScheduleType(template)
        const item = {
          templateId: template.id,
          kind: template.kind,
          name: template.name,
          amount: template.amount,
          category: template.category,
          dateLabel,
          frequency: template.frequency,
          planName: normalizeRecurringPlanName(template.planName),
          scheduleType,
          scheduleLabel: formatRecurringScheduleLabel(template),
          occurrenceLabel: formatRecurringOccurrenceLabel(dateLabel),
        }

      if (template.kind === 'bill') {
        bills.push(item)
      } else {
        plannedExpenses.push(item)
      }
    }

    if (template.kind === 'bill' && template.setAsideEnabled && (template.setAsideAmount ?? 0) > 0) {
      setAsides.push({
        templateId: template.id,
        kind: 'planned-expense',
        name: `${template.name} set-aside`,
        amount: template.setAsideAmount ?? 0,
        category: template.category,
        dateLabel: 'Every pay period',
        frequency: 'every-pay-period',
        planName: normalizeRecurringPlanName(template.planName),
        scheduleType: normalizeRecurringScheduleType(template),
        scheduleLabel: 'Every pay period',
        occurrenceLabel: 'This pay period',
        isSetAside: true,
      })
    }
  }

  return {
    bills,
    setAsides,
    plannedExpenses,
    total: bills.length + setAsides.length + plannedExpenses.length,
  }
}

export function generateRecurringItems({
  templates,
  period,
  existingBills = [],
  existingExpenses = [],
}: GenerateRecurringArgs) {
  const periodKey = getPeriodKey(period)
  const bills = [...existingBills]
  const expenses = [...existingExpenses]
  const nextTemplates = templates.map((template) => ({ ...template }))
  const existingKeys = new Set<string>()

  for (const bill of bills) {
    if (bill.source === 'recurring' && bill.templateId && bill.generatedForPeriodId === periodKey) {
      existingKeys.add(
        getRecurringOccurrenceKey({
          kind: 'bill',
          templateId: bill.templateId,
          dateLabel: bill.dueDate,
          periodKey: bill.generatedForPeriodId,
        }),
      )
    }
  }

  for (const expense of expenses) {
    if (expense.source === 'recurring' && expense.templateId && expense.generatedForPeriodId === periodKey) {
      if (expense.setAsideForTemplateId) {
        existingKeys.add(getRecurringSetAsideKey(expense.setAsideForTemplateId, expense.generatedForPeriodId))
      }
      existingKeys.add(
        getRecurringOccurrenceKey({
          kind: 'planned-expense',
          templateId: expense.templateId,
          dateLabel: expense.date,
          periodKey: expense.generatedForPeriodId,
        }),
      )
    }
  }

  for (const template of nextTemplates) {
    const occurrences = getOccurrences(template, period)
    for (const dateLabel of occurrences) {
      const key = getRecurringOccurrenceKey({
        kind: template.kind,
        templateId: template.id,
        dateLabel,
        periodKey,
      })
      if (existingKeys.has(key)) {
        continue
      }

      if (template.kind === 'bill') {
        bills.push(createBill(template, dateLabel, periodKey))
      } else {
        expenses.push(createExpense(template, dateLabel, periodKey))
      }

      existingKeys.add(key)

      if (template.frequency === 'one-time') {
        template.isActive = false
      }
    }

    if (template.kind === 'bill' && template.setAsideEnabled && (template.setAsideAmount ?? 0) > 0) {
      const setAsideKey = getRecurringSetAsideKey(template.id, periodKey)
      if (!existingKeys.has(setAsideKey)) {
        expenses.push(createSetAsideExpense(template, period, periodKey))
        existingKeys.add(setAsideKey)
      }
    }
  }

  return {
    bills,
    expenses,
    templates: nextTemplates,
  }
}

export function getRecurringPeriodKey(period: BudgetPeriod) {
  return getPeriodKey(period)
}
