import { buildRecurringPreview } from './recurring'
import type { Bill, BudgetPeriod, RecurringItemTemplate } from '../types/budget'

export type ForecastStatus = 'cushion' | 'allocated' | 'shortfall'

export type ForecastBill = {
  templateId: string
  name: string
  amount: number
  dueDate: string
  category: string
}

export type ForecastViewModel = {
  available: boolean
  unavailableReason?: string
  forecastStart: string
  forecastEnd: string
  expectedIncome: number
  projectedBills: ForecastBill[]
  scheduledBillTotal: number
  potentialCarryoverItems: Bill[]
  potentialCarryoverTotal: number
  projectedLeft: number
  status: ForecastStatus
}

type DateParts = { year: number; month: number; day: number }

function parseDateOnly(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return { year, month, day }
}

function toDate(parts: DateParts) {
  return new Date(parts.year, parts.month - 1, parts.day)
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function cents(value: number) {
  return Math.round(value * 100)
}

function dollars(value: number) {
  return cents(value) / 100
}

function unavailable(reason: string): ForecastViewModel {
  return {
    available: false,
    unavailableReason: reason,
    forecastStart: '',
    forecastEnd: '',
    expectedIncome: 0,
    projectedBills: [],
    scheduledBillTotal: 0,
    potentialCarryoverItems: [],
    potentialCarryoverTotal: 0,
    projectedLeft: 0,
    status: 'allocated',
  }
}

export function deriveForecastRange(period: Pick<BudgetPeriod, 'startDate' | 'endDate'>) {
  const start = parseDateOnly(period.startDate)
  const end = parseDateOnly(period.endDate)
  if (!start || !end) return null
  const activeStart = toDate(start)
  const activeEnd = toDate(end)
  if (activeEnd < activeStart) return null
  const duration = Math.round((Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000) + 1
  const forecastStart = new Date(activeEnd)
  forecastStart.setDate(forecastStart.getDate() + 1)
  const forecastEnd = new Date(forecastStart)
  forecastEnd.setDate(forecastEnd.getDate() + duration - 1)
  return { forecastStart: formatDate(forecastStart), forecastEnd: formatDate(forecastEnd), duration }
}

export function buildForecast(params: {
  period: BudgetPeriod | null
  templates: RecurringItemTemplate[]
  unpaidBills?: Bill[]
  expectedIncome?: number
  includeCarryover?: boolean
}): ForecastViewModel {
  if (!params.period) return unavailable('There is no active pay period to use as the forecast cadence.')
  const range = deriveForecastRange(params.period)
  if (!range) return unavailable('The active pay-period dates are missing or invalid.')
  const expectedIncome = Number.isFinite(params.expectedIncome) && (params.expectedIncome ?? 0) >= 0 ? params.expectedIncome ?? 0 : 0
  const forecastPeriod: BudgetPeriod = { ...params.period, startDate: range.forecastStart, endDate: range.forecastEnd }
  const preview = buildRecurringPreview({ templates: params.templates, period: forecastPeriod })
  const projectedBills = preview.bills
    .map((bill) => ({ templateId: bill.templateId, name: bill.name, amount: bill.amount, dueDate: bill.dateLabel, category: bill.category }))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.name.localeCompare(right.name))
  const scheduledBillTotal = dollars(projectedBills.reduce((sum, bill) => sum + cents(bill.amount), 0))
  const potentialCarryoverItems = (params.unpaidBills ?? []).filter((bill) => !bill.isPaid).slice().sort((a, b) => a.name.localeCompare(b.name))
  const potentialCarryoverTotal = dollars(potentialCarryoverItems.reduce((sum, bill) => sum + cents(bill.amount), 0))
  const projectedLeft = dollars(cents(expectedIncome) - cents(scheduledBillTotal) - (params.includeCarryover ? cents(potentialCarryoverTotal) : 0))
  return {
    available: true,
    forecastStart: range.forecastStart,
    forecastEnd: range.forecastEnd,
    expectedIncome: dollars(cents(expectedIncome)),
    projectedBills,
    scheduledBillTotal,
    potentialCarryoverItems,
    potentialCarryoverTotal,
    projectedLeft,
    status: projectedLeft < 0 ? 'shortfall' : projectedLeft === 0 ? 'allocated' : 'cushion',
  }
}

export function parseForecastIncome(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const withoutCurrency = trimmed.startsWith('$') ? trimmed.slice(1) : trimmed
  if (!withoutCurrency || withoutCurrency.includes('$')) return null

  const hasCommas = withoutCurrency.includes(',')
  const validNumber = hasCommas
    ? /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(withoutCurrency)
    : /^(?:\d+(\.\d{1,2})?|\.\d{1,2})$/.test(withoutCurrency)
  if (!validNumber) return null

  const parsed = Number(withoutCurrency.replaceAll(',', ''))
  return Number.isFinite(parsed) && parsed >= 0 ? dollars(parsed) : null
}
