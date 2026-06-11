import type { Bill, BudgetPeriod, Expense } from '../types/budget'

const ACTIVE_BUDGET_KEY = 'leftly.activeBudgetPeriod'
const BILLS_KEY = 'leftly.bills'
const EXPENSES_KEY = 'leftly.expenses'

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    if (!value) {
      return fallback
    }

    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures so the app keeps running.
  }
}

export function loadActiveBudgetPeriod(): BudgetPeriod | null {
  return readJson<BudgetPeriod | null>(ACTIVE_BUDGET_KEY, null)
}

export function saveActiveBudgetPeriod(period: BudgetPeriod | null) {
  writeJson(ACTIVE_BUDGET_KEY, period)
}

export function loadBills(): Bill[] {
  return readJson<Bill[]>(BILLS_KEY, [])
}

export function saveBills(bills: Bill[]) {
  writeJson(BILLS_KEY, bills)
}

export function loadExpenses(): Expense[] {
  return readJson<Expense[]>(EXPENSES_KEY, [])
}

export function saveExpenses(expenses: Expense[]) {
  writeJson(EXPENSES_KEY, expenses)
}

export function clearAllAppData() {
  try {
    window.localStorage.removeItem(ACTIVE_BUDGET_KEY)
    window.localStorage.removeItem(BILLS_KEY)
    window.localStorage.removeItem(EXPENSES_KEY)
  } catch {
    // Ignore storage failures so the app keeps running.
  }
}
