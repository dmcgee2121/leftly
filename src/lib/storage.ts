import { DEFAULT_CATEGORIES } from '../types/budget'
import {
  FALLBACK_CATEGORY,
  deriveCustomCategories,
  normalizeCategoryName,
  reconcileCategoryOrder,
} from './categories'
import { normalizeRecurringPlanName, normalizeRecurringWeekday } from './recurring'
import type {
  Bill,
  BudgetPeriod,
  BudgetCategory,
  CategoryTargets,
  CategoryOrderMode,
  Expense,
  LeftlyPreferences,
  PayPeriodSnapshot,
  RecurringItemTemplate,
  SortMode,
} from '../types/budget'

const ACTIVE_BUDGET_KEY = 'leftly.activeBudgetPeriod'
const BILLS_KEY = 'leftly.bills'
const EXPENSES_KEY = 'leftly.expenses'
const RECURRING_TEMPLATES_KEY = 'leftly.recurringTemplates'
const PAY_PERIOD_HISTORY_KEY = 'leftly.payPeriodHistory'
const SORT_MODE_KEY = 'leftly.sortMode'
const CATEGORY_ORDER_KEY = 'leftly.categoryOrder'
const CATEGORY_TARGETS_KEY = 'leftly.categoryTargets'
const CUSTOM_CATEGORIES_KEY = 'leftly.customCategories'
const PREFERENCES_KEY = 'leftly.preferences'
const ACTIVE_TAB_KEY = 'leftly.activeTab'
const SETUP_DRAFT_KEY = 'leftly.setupDraft'

const DEFAULT_SORT_MODE: SortMode = 'amount-desc'
const DEFAULT_CATEGORY_ORDER: CategoryOrderMode = 'total-desc'
export const DEFAULT_PREFERENCES: LeftlyPreferences = {
  defaultPayCadence: 'biweekly',
  defaultCategory: 'Other / Misc',
  quickAddDateBehavior: 'today',
}

export type LeftlyBackupSummary = {
  hasActivePayPeriod: boolean
  billCount: number
  expenseCount: number
  recurringTemplateCount: number
  historySnapshotCount: number
  categoryCount: number
  displaySettingsIncluded: boolean
  preferencesIncluded: boolean
}

export type LeftlyBackup = {
  version: 1
  app: 'leftly'
  appName?: 'Leftly'
  backupVersion?: 1
  exportedAt: string
  summary?: LeftlyBackupSummary
  activeBudgetPeriod: BudgetPeriod | null
  bills: Bill[]
  expenses: Expense[]
  recurringTemplates: RecurringItemTemplate[]
  payPeriodHistory: PayPeriodSnapshot[]
  categoryTargets?: CategoryTargets
  categoryOrder?: BudgetCategory[]
  customCategories?: BudgetCategory[]
  categoryOrderMode?: CategoryOrderMode
  sortMode?: SortMode
  preferences?: LeftlyPreferences
}

export function buildLeftlyBackup(params: {
  activeBudgetPeriod: BudgetPeriod | null
  bills: Bill[]
  expenses: Expense[]
  recurringTemplates: RecurringItemTemplate[]
  payPeriodHistory: PayPeriodSnapshot[]
  categoryTargets?: CategoryTargets
  categoryOrder?: BudgetCategory[]
  customCategories?: BudgetCategory[]
  categoryOrderMode?: CategoryOrderMode
  sortMode?: SortMode
  preferences?: LeftlyPreferences
}): LeftlyBackup {
  const exportedAt = new Date().toISOString()
  const summary = getLeftlyBackupSummary(params)

  return {
    version: 1 as const,
    app: 'leftly' as const,
    appName: 'Leftly' as const,
    backupVersion: 1 as const,
    exportedAt,
    summary,
    activeBudgetPeriod: params.activeBudgetPeriod,
    bills: params.bills,
    expenses: params.expenses,
    recurringTemplates: params.recurringTemplates,
    payPeriodHistory: params.payPeriodHistory,
    categoryTargets: normalizeCategoryTargets(params.categoryTargets),
    categoryOrder: params.categoryOrder,
    customCategories: params.customCategories,
    categoryOrderMode: params.categoryOrderMode,
    sortMode: params.sortMode,
    preferences: params.preferences,
  }
}

export function serializeLeftlyBackup(backup: LeftlyBackup) {
  return JSON.stringify(backup, null, 2)
}

export function getLeftlyBackupSummary(params: {
  activeBudgetPeriod: BudgetPeriod | null
  bills: Bill[]
  expenses: Expense[]
  recurringTemplates: RecurringItemTemplate[]
  payPeriodHistory: PayPeriodSnapshot[]
  categoryTargets?: CategoryTargets
  categoryOrder?: BudgetCategory[]
  customCategories?: BudgetCategory[]
  categoryOrderMode?: CategoryOrderMode
  sortMode?: SortMode
  preferences?: LeftlyPreferences
}): LeftlyBackupSummary {
  return {
    hasActivePayPeriod: params.activeBudgetPeriod !== null,
    billCount: params.bills.length,
    expenseCount: params.expenses.length,
    recurringTemplateCount: params.recurringTemplates.length,
    historySnapshotCount: params.payPeriodHistory.length,
    categoryCount: params.categoryOrder?.length ?? 0,
    displaySettingsIncluded: params.categoryOrderMode !== undefined && params.sortMode !== undefined,
    preferencesIncluded: params.preferences !== undefined,
  }
}

export function normalizeCategoryTargets(value: unknown): CategoryTargets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const targets: CategoryTargets = {}
  for (const [rawCategory, rawAmount] of Object.entries(value as Record<string, unknown>)) {
    const category = normalizeCategoryName(rawCategory)
    const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount)
    if (!category || !Number.isFinite(amount) || amount < 0) {
      continue
    }

    targets[category] = Math.round(amount * 100) / 100
  }

  return targets
}

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
  return normalizeCategoryName(category) ?? FALLBACK_CATEGORY
}

function normalizePayCadence(value: unknown) {
  return value === 'weekly' || value === 'biweekly' || value === 'monthly' ? value : DEFAULT_PREFERENCES.defaultPayCadence
}

function normalizeQuickAddDateBehavior(value: unknown) {
  return value === 'today' || value === 'pay-period-start' || value === 'blank'
    ? value
    : DEFAULT_PREFERENCES.quickAddDateBehavior
}

function normalizePreferences(value: unknown): LeftlyPreferences {
  const prefs = value as Record<string, unknown> | undefined

  return {
    defaultPayCadence: normalizePayCadence(prefs?.defaultPayCadence),
    defaultCategory: normalizeCategory(prefs?.defaultCategory),
    quickAddDateBehavior: normalizeQuickAddDateBehavior(prefs?.quickAddDateBehavior),
  }
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
    source: bill.source === 'recurring' ? 'recurring' : 'manual',
    templateId: typeof bill.templateId === 'string' ? bill.templateId : undefined,
    generatedForPeriodId: typeof bill.generatedForPeriodId === 'string' ? bill.generatedForPeriodId : undefined,
    carriedOverFromPayPeriodId: typeof bill.carriedOverFromPayPeriodId === 'string' ? bill.carriedOverFromPayPeriodId : undefined,
    notes: typeof bill.notes === 'string' ? bill.notes : undefined,
    createdAt: typeof bill.createdAt === 'string' ? bill.createdAt : undefined,
  }
}

function normalizeExpense(expense: Expense | Record<string, unknown>): Expense {
  return {
    id: String(expense.id ?? crypto.randomUUID()),
    name: String(expense.name ?? ''),
    amount: Number(expense.amount ?? 0),
    date: String(expense.date ?? ''),
    category: normalizeCategory(expense.category),
    isPlanned: typeof expense.isPlanned === 'boolean' ? expense.isPlanned : undefined,
    source: expense.source === 'recurring' ? 'recurring' : 'manual',
    templateId: typeof expense.templateId === 'string' ? expense.templateId : undefined,
    generatedForPeriodId: typeof expense.generatedForPeriodId === 'string' ? expense.generatedForPeriodId : undefined,
    setAsideForTemplateId: typeof expense.setAsideForTemplateId === 'string' ? expense.setAsideForTemplateId : undefined,
    createdAt: typeof expense.createdAt === 'string' ? expense.createdAt : undefined,
  }
}

function normalizePayPeriodTotals(value: unknown) {
  const totals = value as Record<string, unknown> | undefined
  return {
    totalBills: Number(totals?.totalBills ?? 0),
    paidBills: Number(totals?.paidBills ?? 0),
    unpaidBills: Number(totals?.unpaidBills ?? 0),
    totalExpenses: Number(totals?.totalExpenses ?? 0),
    totalSetAsides: Number(totals?.totalSetAsides ?? 0),
    safeToSpend: Number(totals?.safeToSpend ?? 0),
    leftover: Number(totals?.leftover ?? 0),
  }
}

function normalizePayPeriodSnapshot(snapshot: PayPeriodSnapshot | Record<string, unknown>): PayPeriodSnapshot {
  const item = snapshot as Record<string, unknown>
  const bills = Array.isArray(item.bills) ? item.bills.map((bill) => normalizeBill(bill as Bill | Record<string, unknown>)) : []
  const expenses = Array.isArray(item.expenses)
    ? item.expenses.map((expense) => normalizeExpense(expense as Expense | Record<string, unknown>))
    : []

  return {
    id: String(item.id ?? crypto.randomUUID()),
    label: String(item.label ?? ''),
    cadence:
      item.cadence === 'weekly' || item.cadence === 'biweekly' || item.cadence === 'monthly'
        ? item.cadence
        : 'biweekly',
    startDate: String(item.startDate ?? ''),
    endDate: String(item.endDate ?? ''),
    income: Number(item.income ?? 0),
    baseIncome: typeof item.baseIncome === 'number' && Number.isFinite(item.baseIncome) ? item.baseIncome : undefined,
    rolloverAmount: typeof item.rolloverAmount === 'number' && Number.isFinite(item.rolloverAmount) ? item.rolloverAmount : undefined,
    rolloverApplied: typeof item.rolloverApplied === 'boolean' ? item.rolloverApplied : undefined,
    bills,
    expenses,
    categoryTargets: normalizeCategoryTargets(item.categoryTargets),
    totals: normalizePayPeriodTotals(item.totals),
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    archivedAt: typeof item.archivedAt === 'string' ? item.archivedAt : new Date().toISOString(),
  }
}

function normalizePayPeriodHistory(history: unknown): PayPeriodSnapshot[] {
  return Array.isArray(history)
    ? history.map((snapshot) => normalizePayPeriodSnapshot(snapshot as PayPeriodSnapshot | Record<string, unknown>))
    : []
}

function isLeftlyPreferences(value: unknown): value is LeftlyPreferences {
  if (!value || typeof value !== 'object') {
    return false
  }

  const prefs = value as Record<string, unknown>
  return (
    (prefs.defaultPayCadence === 'weekly' || prefs.defaultPayCadence === 'biweekly' || prefs.defaultPayCadence === 'monthly') &&
    normalizeCategoryName(prefs.defaultCategory) !== null &&
    (prefs.quickAddDateBehavior === 'today' || prefs.quickAddDateBehavior === 'pay-period-start' || prefs.quickAddDateBehavior === 'blank')
  )
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures so the app keeps running.
  }
}

type SetupDraftEnvelope = {
  version: 1
  draft: unknown
}

function isSetupDraftEnvelope(value: unknown): value is SetupDraftEnvelope {
  if (!value || typeof value !== 'object') {
    return false
  }

  const envelope = value as Record<string, unknown>
  return envelope.version === 1 && Object.prototype.hasOwnProperty.call(envelope, 'draft')
}

function isBudgetPeriod(value: unknown): value is BudgetPeriod {
  const period = value as Record<string, unknown> | null
  return !!period && typeof period.cadence === 'string' && typeof period.startDate === 'string' && typeof period.endDate === 'string' && typeof period.income === 'number'
}

function isLeftlyBackup(value: unknown): value is LeftlyBackup {
  if (!value || typeof value !== 'object') {
    return false
  }

  const backup = value as Record<string, unknown>
  return (
    backup.version === 1 &&
    backup.app === 'leftly' &&
    typeof backup.exportedAt === 'string' &&
    (backup.activeBudgetPeriod === null || isBudgetPeriod(backup.activeBudgetPeriod)) &&
    Array.isArray(backup.bills) &&
    Array.isArray(backup.expenses) &&
    Array.isArray(backup.recurringTemplates) &&
    Array.isArray(backup.payPeriodHistory) &&
    (backup.categoryTargets === undefined || (!!backup.categoryTargets && typeof backup.categoryTargets === 'object' && !Array.isArray(backup.categoryTargets))) &&
    (backup.categoryOrder === undefined || Array.isArray(backup.categoryOrder)) &&
    (backup.customCategories === undefined || Array.isArray(backup.customCategories)) &&
    (backup.categoryOrderMode === undefined || backup.categoryOrderMode === 'total-desc' || backup.categoryOrderMode === 'custom') &&
    (backup.sortMode === undefined || backup.sortMode === 'amount-desc' || backup.sortMode === 'amount-asc' || backup.sortMode === 'date' || backup.sortMode === 'name') &&
    (backup.preferences === undefined || isLeftlyPreferences(backup.preferences))
  )
}

export function parseLeftlyBackupValue(value: unknown): { ok: true; backup: LeftlyBackup } | { ok: false; error: string } {
  if (!isLeftlyBackup(value)) {
    return { ok: false, error: 'That file does not look like a Leftly backup.' }
  }

  return { ok: true, backup: value }
}

export function parseLeftlyBackupJson(text: string): { ok: true; backup: LeftlyBackup } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown
    return parseLeftlyBackupValue(parsed)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
}

export function saveLeftlyBackup(backup: LeftlyBackup) {
  const normalizedPayPeriodHistory = normalizePayPeriodHistory(backup.payPeriodHistory)
  const customCategories = deriveCustomCategories({
    explicitCustomCategories: backup.customCategories,
    bills: backup.bills,
    expenses: backup.expenses,
    recurringTemplates: backup.recurringTemplates,
    payPeriodHistory: normalizedPayPeriodHistory,
    categoryTargets: normalizeCategoryTargets(backup.categoryTargets),
    preferences: backup.preferences ?? DEFAULT_PREFERENCES,
    setupDraft: null,
  })

  saveActiveBudgetPeriod(backup.activeBudgetPeriod)
  saveBills(backup.bills)
  saveExpenses(backup.expenses)
  saveRecurringTemplates(backup.recurringTemplates)
  savePayPeriodHistory(normalizedPayPeriodHistory)
  saveCategoryTargets(backup.categoryTargets)
  saveCustomCategories(customCategories)
  saveCategoryOrder(backup.categoryOrder ?? [...DEFAULT_CATEGORIES], customCategories)
  saveCategoryOrderMode(backup.categoryOrderMode ?? DEFAULT_CATEGORY_ORDER)
  saveSortMode(backup.sortMode ?? DEFAULT_SORT_MODE)
  savePreferences(backup.preferences ?? DEFAULT_PREFERENCES)
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
      category: normalizeCategory(item.category),
      kind: item.kind === 'planned-expense' ? 'planned-expense' : 'bill',
      planName: typeof item.planName === 'string' ? normalizeRecurringPlanName(item.planName) : undefined,
      scheduleType:
        item.scheduleType === 'monthly' || item.scheduleType === 'weekly' || item.scheduleType === 'biweekly'
          ? item.scheduleType
          : item.frequency === 'monthly' || item.frequency === 'weekly' || item.frequency === 'biweekly'
            ? item.frequency
            : undefined,
      frequency:
        item.frequency === 'every-pay-period' ||
        item.frequency === 'weekly' ||
        item.frequency === 'biweekly' ||
        item.frequency === 'monthly' ||
        item.frequency === 'one-time'
          ? item.frequency
          : 'every-pay-period',
      dueDay: typeof item.dueDay === 'number' ? item.dueDay : undefined,
      dayOfWeek: normalizeRecurringWeekday(item.dayOfWeek),
      anchorDate: typeof item.anchorDate === 'string' ? item.anchorDate : undefined,
      setAsideEnabled: typeof item.setAsideEnabled === 'boolean' ? item.setAsideEnabled : undefined,
      setAsideAmount: typeof item.setAsideAmount === 'number' && Number.isFinite(item.setAsideAmount) ? item.setAsideAmount : undefined,
      isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }
  })
}

export function saveRecurringTemplates(templates: RecurringItemTemplate[]) {
  writeJson(RECURRING_TEMPLATES_KEY, templates)
}

export function loadPayPeriodHistory(): PayPeriodSnapshot[] {
  const value = readJson<unknown>(PAY_PERIOD_HISTORY_KEY, [])
  return normalizePayPeriodHistory(value)
}

export function savePayPeriodHistory(history: PayPeriodSnapshot[]) {
  writeJson(PAY_PERIOD_HISTORY_KEY, history)
}

export function loadCategoryTargets(): CategoryTargets {
  return normalizeCategoryTargets(readJson<unknown>(CATEGORY_TARGETS_KEY, {}))
}

export function saveCategoryTargets(targets: CategoryTargets | undefined) {
  writeJson(CATEGORY_TARGETS_KEY, normalizeCategoryTargets(targets))
}

export function addPayPeriodSnapshot(snapshot: PayPeriodSnapshot) {
  const history = loadPayPeriodHistory()
  savePayPeriodHistory([snapshot, ...history])
}

export function deletePayPeriodSnapshot(id: string) {
  const history = loadPayPeriodHistory()
  savePayPeriodHistory(history.filter((snapshot) => snapshot.id !== id))
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

export function loadPreferences(): LeftlyPreferences {
  return normalizePreferences(readJson<unknown>(PREFERENCES_KEY, DEFAULT_PREFERENCES))
}

export function savePreferences(preferences: LeftlyPreferences) {
  writeJson(PREFERENCES_KEY, normalizePreferences(preferences))
}

export function loadActiveTab() {
  try {
    const value = window.localStorage.getItem(ACTIVE_TAB_KEY)
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

export function saveActiveTab(tab: string) {
  try {
    window.localStorage.setItem(ACTIVE_TAB_KEY, tab)
  } catch {
    // Ignore storage failures so the app keeps running.
  }
}

export function loadSetupDraft(activeBudgetPeriod: BudgetPeriod | null): unknown | null {
  if (activeBudgetPeriod) {
    clearSetupDraft()
    return null
  }

  const value = readJson<unknown>(SETUP_DRAFT_KEY, null)
  if (!isSetupDraftEnvelope(value)) {
    if (value !== null) {
      clearSetupDraft()
    }
    return null
  }

  return value.draft
}

export function saveSetupDraft(draft: unknown) {
  writeJson(SETUP_DRAFT_KEY, { version: 1 as const, draft })
}

export function loadRawSetupDraft(activeBudgetPeriod: BudgetPeriod | null): unknown | null {
  return loadSetupDraft(activeBudgetPeriod)
}

export function clearSetupDraft() {
  try {
    window.localStorage.removeItem(SETUP_DRAFT_KEY)
  } catch {
    // Ignore storage failures so the app keeps running.
  }
}

export function loadCustomCategories() {
  const bills = loadBills()
  const expenses = loadExpenses()
  const recurringTemplates = loadRecurringTemplates()
  const payPeriodHistory = loadPayPeriodHistory()
  const preferences = loadPreferences()
  const explicitCustomCategories = readJson<unknown>(CUSTOM_CATEGORIES_KEY, [])
  const setupDraft = loadSetupDraft(null)

  return deriveCustomCategories({
    explicitCustomCategories,
    bills,
    expenses,
    recurringTemplates,
    payPeriodHistory,
    categoryTargets: loadCategoryTargets(),
    preferences,
    setupDraft,
  })
}

export function saveCustomCategories(categories: BudgetCategory[]) {
  writeJson(CUSTOM_CATEGORIES_KEY, deriveCustomCategories({ explicitCustomCategories: categories }))
}

export function loadCategoryOrder(customCategories: BudgetCategory[] = []) {
  return reconcileCategoryOrder(readJson<unknown>(CATEGORY_ORDER_KEY, [...DEFAULT_CATEGORIES]), customCategories)
}

export function saveCategoryOrder(order: BudgetCategory[], customCategories: BudgetCategory[] = []) {
  writeJson(CATEGORY_ORDER_KEY, reconcileCategoryOrder(order, customCategories))
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
    window.localStorage.removeItem(PAY_PERIOD_HISTORY_KEY)
    window.localStorage.removeItem(SORT_MODE_KEY)
    window.localStorage.removeItem(CATEGORY_ORDER_KEY)
    window.localStorage.removeItem(CATEGORY_TARGETS_KEY)
    window.localStorage.removeItem(CUSTOM_CATEGORIES_KEY)
    window.localStorage.removeItem(CATEGORY_ORDER_KEY + '.mode')
    window.localStorage.removeItem(PREFERENCES_KEY)
    window.localStorage.removeItem(ACTIVE_TAB_KEY)
    window.localStorage.removeItem(SETUP_DRAFT_KEY)
  } catch {
    // Ignore storage failures so the app keeps running.
  }
}
