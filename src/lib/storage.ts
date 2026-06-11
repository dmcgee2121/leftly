import { DEFAULT_CATEGORIES } from '../types/budget'
import type {
  Bill,
  BudgetPeriod,
  BudgetCategory,
  CategoryOrderMode,
  Expense,
  RecurringItemTemplate,
  SortMode,
} from '../types/budget'

const ACTIVE_BUDGET_KEY = 'leftly.activeBudgetPeriod'
const BILLS_KEY = 'leftly.bills'
const EXPENSES_KEY = 'leftly.expenses'
const RECURRING_TEMPLATES_KEY = 'leftly.recurringTemplates'
const SORT_MODE_KEY = 'leftly.sortMode'
const CATEGORY_ORDER_KEY = 'leftly.categoryOrder'

const DEFAULT_SORT_MODE: SortMode = 'amount-desc'
const DEFAULT_CATEGORY_ORDER: CategoryOrderMode = 'total-desc'

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

function normalizeCategory(category: unknown): BudgetCategory {
  return DEFAULT_CATEGORIES.includes(category as BudgetCategory)
    ? (category as BudgetCategory)
    : 'Other / Misc'
}

function normalizeBill(bill: Bill | Record<string, unknown>): Bill {
  return {
    id: String(bill.id ?? crypto.randomUUID()),
    name: String(bill.name ?? ''),
    amount: Number(bill.amount ?? 0),
    dueDate: String(bill.dueDate ?? ''),
    isPaid: Boolean(bill.isPaid),
    paidDate: typeof bill.paidDate === 'string' ? bill.paidDate : null,
    category: normalizeCategory(bill.category),
  }
}

function normalizeExpense(expense: Expense | Record<string, unknown>): Expense {
  return {
    id: String(expense.id ?? crypto.randomUUID()),
    name: String(expense.name ?? ''),
    amount: Number(expense.amount ?? 0),
    date: String(expense.date ?? ''),
    category: normalizeCategory(expense.category),
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
  const value = readJson<unknown>(BILLS_KEY, [])
  return Array.isArray(value) ? value.map((item) => normalizeBill(item as Bill | Record<string, unknown>)) : []
}

export function saveBills(bills: Bill[]) {
  writeJson(BILLS_KEY, bills)
}

export function loadExpenses(): Expense[] {
  const value = readJson<unknown>(EXPENSES_KEY, [])
  return Array.isArray(value) ? value.map((item) => normalizeExpense(item as Expense | Record<string, unknown>)) : []
}

export function saveExpenses(expenses: Expense[]) {
  writeJson(EXPENSES_KEY, expenses)
}

export function loadRecurringTemplates(): RecurringItemTemplate[] {
  const value = readJson<unknown>(RECURRING_TEMPLATES_KEY, [])
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((template) => {
    const item = template as Record<string, unknown>
    return {
      id: String(item.id ?? crypto.randomUUID()),
      name: String(item.name ?? ''),
      amount: Number(item.amount ?? 0),
      category: DEFAULT_CATEGORIES.includes(item.category as BudgetCategory)
        ? (item.category as BudgetCategory)
        : 'Other / Misc',
      kind: item.kind === 'planned-expense' ? 'planned-expense' : 'bill',
      frequency:
        item.frequency === 'every-pay-period' ||
        item.frequency === 'weekly' ||
        item.frequency === 'biweekly' ||
        item.frequency === 'monthly' ||
        item.frequency === 'one-time'
          ? item.frequency
          : 'every-pay-period',
      dueDay: typeof item.dueDay === 'number' ? item.dueDay : undefined,
      anchorDate: typeof item.anchorDate === 'string' ? item.anchorDate : undefined,
      isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }
  })
}

export function saveRecurringTemplates(templates: RecurringItemTemplate[]) {
  writeJson(RECURRING_TEMPLATES_KEY, templates)
}

export function loadSortMode(): SortMode {
  const mode = readJson<SortMode | string>(SORT_MODE_KEY, DEFAULT_SORT_MODE)
  return mode === 'amount-desc' || mode === 'amount-asc' || mode === 'date' || mode === 'name'
    ? mode
    : DEFAULT_SORT_MODE
}

export function saveSortMode(sortMode: SortMode) {
  writeJson(SORT_MODE_KEY, sortMode)
}

function normalizeCategoryOrder(order: unknown): BudgetCategory[] {
  if (!Array.isArray(order)) {
    return [...DEFAULT_CATEGORIES]
  }

  const normalized = order.filter((item): item is BudgetCategory =>
    DEFAULT_CATEGORIES.includes(item as BudgetCategory),
  )
  const missing = DEFAULT_CATEGORIES.filter((category) => !normalized.includes(category))
  return [...normalized, ...missing]
}

export function loadCategoryOrder(): BudgetCategory[] {
  return normalizeCategoryOrder(readJson<unknown>(CATEGORY_ORDER_KEY, [...DEFAULT_CATEGORIES]))
}

export function saveCategoryOrder(order: BudgetCategory[]) {
  writeJson(CATEGORY_ORDER_KEY, order)
}

export function loadCategoryOrderMode(): CategoryOrderMode {
  const mode = readJson<CategoryOrderMode | string>(CATEGORY_ORDER_KEY + '.mode', DEFAULT_CATEGORY_ORDER)
  return mode === 'custom' ? mode : DEFAULT_CATEGORY_ORDER
}

export function saveCategoryOrderMode(mode: CategoryOrderMode) {
  writeJson(CATEGORY_ORDER_KEY + '.mode', mode)
}

export function clearAllAppData() {
  try {
    window.localStorage.removeItem(ACTIVE_BUDGET_KEY)
    window.localStorage.removeItem(BILLS_KEY)
    window.localStorage.removeItem(EXPENSES_KEY)
    window.localStorage.removeItem(RECURRING_TEMPLATES_KEY)
    window.localStorage.removeItem(SORT_MODE_KEY)
    window.localStorage.removeItem(CATEGORY_ORDER_KEY)
    window.localStorage.removeItem(CATEGORY_ORDER_KEY + '.mode')
  } catch {
    // Ignore storage failures so the app keeps running.
  }
}
