import type { Bill, BudgetPeriod, BudgetCategory, Expense, RecurringItemTemplate } from '../types/budget'

export type RecurringPreviewItem = {
  templateId: string
  kind: 'bill' | 'planned-expense'
  name: string
  amount: number
  category: BudgetCategory
  dateLabel: string
  frequency: RecurringItemTemplate['frequency']
}

export type RecurringPreviewGroups = {
  bills: RecurringPreviewItem[]
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

function getOccurrences(template: RecurringItemTemplate, period: BudgetPeriod) {
  const start = parseDate(period.startDate)
  const end = parseDate(period.endDate)

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

  if (template.frequency === 'monthly') {
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

  if (!template.anchorDate) {
    return []
  }

  const cadenceDays = template.frequency === 'weekly' ? 7 : 14
  const anchor = parseDate(template.anchorDate)
  if (anchor.getTime() > end.getTime()) {
    return []
  }

  let candidate = new Date(anchor)
  while (candidate.getTime() < start.getTime()) {
    candidate = addDays(candidate, cadenceDays)
  }

  const results: string[] = []
  while (candidate.getTime() <= end.getTime()) {
    results.push(formatDate(candidate))
    candidate = addDays(candidate, cadenceDays)
  }

  return results
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

export function buildRecurringPreview({ templates, period }: { templates: RecurringItemTemplate[]; period: BudgetPeriod }): RecurringPreviewGroups {
  const bills: RecurringPreviewItem[] = []
  const plannedExpenses: RecurringPreviewItem[] = []

  for (const template of templates) {
    const occurrences = getOccurrences(template, period)
    for (const dateLabel of occurrences) {
        const item = {
          templateId: template.id,
          kind: template.kind,
          name: template.name,
          amount: template.amount,
          category: template.category,
          dateLabel,
          frequency: template.frequency,
        }

      if (template.kind === 'bill') {
        bills.push(item)
      } else {
        plannedExpenses.push(item)
      }
    }
  }

  return {
    bills,
    plannedExpenses,
    total: bills.length + plannedExpenses.length,
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
      existingKeys.add(`bill:${bill.templateId}:${bill.dueDate}:${bill.generatedForPeriodId}`)
    }
  }

  for (const expense of expenses) {
    if (expense.source === 'recurring' && expense.templateId && expense.generatedForPeriodId === periodKey) {
      existingKeys.add(`expense:${expense.templateId}:${expense.date}:${expense.generatedForPeriodId}`)
    }
  }

  for (const template of nextTemplates) {
    const occurrences = getOccurrences(template, period)
    for (const dateLabel of occurrences) {
      const key = `${template.kind}:${template.id}:${dateLabel}:${periodKey}`
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
