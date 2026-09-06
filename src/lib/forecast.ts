import { buildRecurringPreview } from './recurring'
import { deriveNextDateOnlyRange } from './dateOnly'
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
  const range = deriveNextDateOnlyRange(period.startDate, period.endDate)
  return range
    ? { forecastStart: range.startDate, forecastEnd: range.endDate, duration: range.duration }
    : null
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
