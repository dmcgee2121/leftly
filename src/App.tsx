import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import {
  clearAllAppData,
  addPayPeriodSnapshot,
  deletePayPeriodSnapshot,
  buildLeftlyBackup,
  clearSetupDraft,
  getLeftlyBackupSummary,
  parseLeftlyBackupJson,
  loadActiveBudgetPeriod,
  loadActiveTab,
  loadBills,
  loadCategoryOrder,
  loadCategoryOrderMode,
  loadCategoryTargets,
  loadCustomCategories,
  loadExpenses,
  loadPreferences,
  loadPayPeriodHistory,
  loadRawSetupDraft,
  loadSortMode,
  loadRecurringTemplates,
  savePreferences,
  saveActiveBudgetPeriod,
  saveActiveTab,
  saveBills,
  saveCategoryOrder,
  saveCategoryOrderMode,
  saveCategoryTargets,
  saveCustomCategories,
  saveExpenses,
  savePayPeriodHistory,
  saveLeftlyBackup,
  saveRecurringTemplates,
  saveSetupDraft,
  saveSortMode,
  serializeLeftlyBackup,
  DEFAULT_PREFERENCES,
} from './lib/storage'
import type { LeftlyBackupSummary } from './lib/storage'
import {
  FALLBACK_CATEGORY,
  getAllCategories,
  getCategoryReferenceCounts,
  isBuiltInCategory,
  removeCategoryTargetKey,
  reconcileCategoryOrder,
  removeCategoryFromCustomList,
  replaceCategoryAcrossData,
  removeTargetKeyAcrossHistorySnapshots,
  renameCategoryTargetKey,
  updateTargetKeysAcrossHistorySnapshots,
  validateCategoryName,
} from './lib/categories'
import {
  MAIN_BILL_PLAN,
  formatRecurringScheduleLabel,
  generateRecurringItems,
  getRecurringPeriodKey,
  normalizeRecurringPlanName,
} from './lib/recurring'
import { createAllHistoryCsv, createCurrentPeriodCsv, createHistorySnapshotCsv, downloadCsv } from './lib/export'
import {
  DEFAULT_CATEGORIES,
  type Bill,
  type BudgetCategory,
  type BudgetPeriod,
  type CategoryOrderMode,
  type CategoryTargets,
  type Expense,
  type LeftlyPreferences,
  type PayPeriodSnapshot,
  type PayPeriodTotals,
  type PayCadence,
  type RecurringItemTemplate,
  type SortMode,
} from './types/budget'
import type { EditTarget } from './components/EditItemPanel'
import { EditItemPanel } from './components/EditItemPanel'
import { DataSection } from './components/DataSection'
import { LandingScreen } from './components/LandingScreen'
import { ApplyBillPlanPanel } from './components/ApplyBillPlanPanel'
import { RecurringSection } from './components/RecurringSection'
import { SetupFlowPanel } from './components/SetupFlowPanel'
import { StartFromHistoryPanel } from './components/StartFromHistoryPanel'
import { PayPeriodCalendar } from './components/PayPeriodCalendar'
import { StartNewPayPeriodPanel } from './components/StartNewPayPeriodPanel'
import { HelpAboutFeedbackSection } from './components/HelpAboutFeedbackSection'
import { AppOverlay } from './components/AppOverlay'
import { getLeftlyCloudConfig } from './lib/cloudConfig'

type MainTabKey = 'overview' | 'quick-add' | 'recurring' | 'history' | 'more'
type MoreMenuKey = 'income' | 'bill' | 'expense' | 'categories' | 'data' | 'help'
type TabKey = MainTabKey | MoreMenuKey
type OverlayKey = Extract<TabKey, 'quick-add' | 'more'>
type ContentTabKey = Exclude<TabKey, OverlayKey>
type ActiveOverlay = OverlayKey | 'history-detail' | null
type HistorySort = 'newest' | 'oldest' | 'highest-leftly' | 'lowest-leftly'
type PayPeriodDraft = {
  cadence: PayCadence
  income: string
  startDate: string
  endDate: string
}

type BillDraft = {
  name: string
  amount: string
  dueDate: string
  category: BudgetCategory
}

type ExpenseDraft = {
  name: string
  amount: string
  date: string
  category: BudgetCategory
}

type BudgetItem = {
  id: string
  name: string
  amount: number
  category: BudgetCategory
  kind: 'bill' | 'expense'
  dueDate?: string
  date?: string
  isPaid?: boolean
  paidDate?: string | null
  source?: 'manual' | 'recurring'
  templateId?: string
  generatedForPeriodId?: string
  isPlanned?: boolean
  setAsideForTemplateId?: string
  carriedOverFromPayPeriodId?: string
}

type CategorySummary = {
  category: BudgetCategory
  items: BudgetItem[]
  total: number
  billCount: number
  expenseCount: number
  manualExpenseCount: number
}

type CurrentPeriodItemFilter = 'all' | 'bills' | 'expenses' | 'set-asides' | 'unpaid-bills' | 'paid-bills'

type DueSoonBillRow = {
  bill: Bill
  status: 'Overdue' | 'Due today' | 'Due in next 7 days'
  statusTone: 'rose' | 'cyan' | 'amber'
  dueDateLabel: string
  scheduleLabel?: string
  planName?: string
}

type BillPaymentSummary = {
  totalCount: number
  paidCount: number
  unpaidCount: number
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
}

type OverviewTotals = {
  income: number
  totalPlannedBills: number
  paidBills: number
  unpaidBills: number
  totalExpenses: number
  totalSetAside: number
  leftover: number
  safeToSpend: number
}

type SpendingSnapshotRow = {
  category: BudgetCategory
  total: number
  count: number
}

type CategoryTargetProgress = {
  category: BudgetCategory
  target: number
  spent: number
  remaining: number
  percentUsed: number
  status: 'On track' | 'Getting close' | 'At target' | 'Over target'
  progressValue: number
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

const dueSoonDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function cloneBillForDemo(bill: Bill): Bill {
  return {
    ...bill,
    id: crypto.randomUUID(),
  }
}

function cloneExpenseForDemo(expense: Expense): Expense {
  return {
    ...expense,
    id: crypto.randomUUID(),
  }
}

function summarizeBillPayments(bills: Bill[]): BillPaymentSummary {
  return bills.reduce<BillPaymentSummary>(
    (summary, bill) => {
      summary.totalCount += 1
      summary.totalAmount += bill.amount

      if (bill.isPaid) {
        summary.paidCount += 1
        summary.paidAmount += bill.amount
      } else {
        summary.unpaidCount += 1
        summary.unpaidAmount += bill.amount
      }

      return summary
    },
    {
      totalCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
    },
  )
}

function buildDemoHistorySnapshot(params: {
  label: string
  period: BudgetPeriod
  bills: Bill[]
  expenses: Expense[]
  categoryTargets?: CategoryTargets
}): PayPeriodSnapshot {
  const archivedAt = new Date().toISOString()
  const totals = calculatePayPeriodTotals(params.period, params.bills, params.expenses)

  return {
    id: crypto.randomUUID(),
    label: params.label,
    cadence: params.period.cadence,
    startDate: params.period.startDate,
    endDate: params.period.endDate,
    income: params.period.income,
    bills: params.bills.map((bill) => ({ ...bill })),
    expenses: params.expenses.map((expense) => ({ ...expense })),
    categoryTargets: { ...(params.categoryTargets ?? {}) },
    totals,
    createdAt: archivedAt,
    archivedAt,
  }
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const cadenceOptions: Array<{ value: PayCadence; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: 'amount-desc', label: 'High to low amount' },
  { value: 'amount-asc', label: 'Low to high amount' },
  { value: 'date', label: 'Due date / date' },
  { value: 'name', label: 'Name A-Z' },
]

const currentPeriodItemFilterOptions: Array<{ value: CurrentPeriodItemFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'bills', label: 'Bills' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'set-asides', label: 'Set-asides' },
  { value: 'unpaid-bills', label: 'Unpaid bills' },
  { value: 'paid-bills', label: 'Paid bills' },
]

const categoryOrderOptions: Array<{ value: CategoryOrderMode; label: string }> = [
  { value: 'total-desc', label: 'Total high to low' },
  { value: 'custom', label: 'Custom order' },
]

const tabLabels: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'quick-add', label: 'Quick Add' },
  { key: 'income', label: 'Income' },
  { key: 'bill', label: 'One-time Bill' },
  { key: 'expense', label: 'Manual Expense' },
  { key: 'categories', label: 'Categories' },
  { key: 'recurring', label: 'Bill Plan' },
  { key: 'history', label: 'History' },
  { key: 'more', label: 'More' },
  { key: 'data', label: 'Data' },
]

// Keep this order explicit so a future preference can reorder More without changing the screen model.
const moreMenuItems: Array<{ key: MoreMenuKey; label: string; helper: string }> = [
  {
    key: 'income',
    label: 'Income',
    helper: 'Update paycheck income and pay period details.',
  },
  {
    key: 'expense',
    label: 'Manual Expense',
    helper: 'Log spending that happened during this pay period.',
  },
  {
    key: 'categories',
    label: 'Categories',
    helper: 'Review where bills and spending are grouped.',
  },
  {
    key: 'bill',
    label: 'One-time Bill',
    helper: 'Add an unusual bill for this pay period.',
  },
  {
    key: 'data',
    label: 'Data',
    helper: 'Back up, restore, export spreadsheets, reset, and manage preferences.',
  },
  {
    key: 'help',
    label: 'Help / About / Feedback',
    helper: 'Find the beta tester guide, privacy basics, and the feedback template.',
  },
]

const tabScreenLabels: Record<TabKey, string> = {
  overview: 'Overview',
  'quick-add': 'Quick Add',
  income: 'Income',
  bill: 'One-time Bill',
  expense: 'Manual Expense',
  categories: 'Categories',
  recurring: 'Bill Plan',
  history: 'History',
  more: 'More',
  data: 'Data',
  help: 'Help / About / Feedback',
}

const quickAddDateBehaviorLabels: Record<LeftlyPreferences['quickAddDateBehavior'], string> = {
  today: 'Today',
  'pay-period-start': 'Pay period start',
  blank: 'Choose date',
}

const initialPayPeriod = loadActiveBudgetPeriod()
const initialBills = loadBills()
const initialExpenses = loadExpenses()
const initialRecurringTemplates = loadRecurringTemplates()
const initialPayPeriodHistory = loadPayPeriodHistory()
const initialSortMode = loadSortMode()
const initialPreferences = loadPreferences()
const initialCustomCategories = loadCustomCategories()
const initialCategoryOrder = loadCategoryOrder(initialCustomCategories)
const initialCategoryOrderMode = loadCategoryOrderMode()
const initialCategoryTargets = loadCategoryTargets()
const initialAllCategories = getAllCategories(initialCustomCategories)
const initialHasMeaningfulLocalData =
  initialPayPeriod !== null ||
  initialBills.length > 0 ||
  initialExpenses.length > 0 ||
  initialRecurringTemplates.length > 0 ||
  initialPayPeriodHistory.length > 0 ||
  initialCustomCategories.length > 0 ||
  initialSortMode !== 'amount-desc' ||
  initialCategoryOrderMode !== 'total-desc' ||
  Object.keys(initialCategoryTargets).length > 0 ||
  initialCategoryOrder.length !== initialAllCategories.length ||
  initialCategoryOrder.some((category, index) => category !== initialAllCategories[index]) ||
  initialPreferences.defaultPayCadence !== DEFAULT_PREFERENCES.defaultPayCadence ||
  initialPreferences.defaultCategory !== DEFAULT_PREFERENCES.defaultCategory ||
  initialPreferences.quickAddDateBehavior !== DEFAULT_PREFERENCES.quickAddDateBehavior

const cloudConfig = getLeftlyCloudConfig()

function isValidTabKey(tab: string | null): tab is TabKey {
  return tab !== null && Object.prototype.hasOwnProperty.call(tabScreenLabels, tab)
}

function getInitialActiveTab(): ContentTabKey {
  if (!initialHasMeaningfulLocalData) {
    return 'overview'
  }

  const savedTab = loadActiveTab()
  if (!isValidTabKey(savedTab)) {
    return 'overview'
  }

  return savedTab === 'quick-add' || savedTab === 'more' ? 'overview' : savedTab
}

function getDraftFromPeriod(period: BudgetPeriod | null, defaultCadence: PayCadence = DEFAULT_PREFERENCES.defaultPayCadence): PayPeriodDraft {
  return {
    cadence: period?.cadence ?? defaultCadence,
    income: period ? String(period.income) : '',
    startDate: period?.startDate ?? '',
    endDate: period?.endDate ?? '',
  }
}

function getBlankBillDraft(defaultCategory: BudgetCategory): BillDraft {
  return {
    name: '',
    amount: '',
    dueDate: '',
    category: defaultCategory,
  }
}

function getBlankExpenseDraft(defaultCategory: BudgetCategory): ExpenseDraft {
  return {
    name: '',
    amount: '',
    date: '',
    category: defaultCategory,
  }
}

function getQuickAddDateValue(preferences: LeftlyPreferences, payPeriod: BudgetPeriod | null) {
  if (preferences.quickAddDateBehavior === 'blank') {
    return ''
  }

  if (preferences.quickAddDateBehavior === 'pay-period-start') {
    return payPeriod?.startDate ?? ''
  }

  return formatIsoDate(new Date())
}

const historyDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const historyShortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

function formatCompactDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : historyDateFormatter.format(date)
}

function formatHistoryPeriodLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} - ${endDate}`
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${historyShortDateFormatter.format(start)} - ${historyDateFormatter.format(end)}`
  }

  return `${historyDateFormatter.format(start)} - ${historyDateFormatter.format(end)}`
}

function formatPlanSchedule(template: RecurringItemTemplate) {
  return formatRecurringScheduleLabel(template)
}

function getUpcomingRecurringBills(templates: RecurringItemTemplate[], bills: Bill[]) {
  const presentTemplateIds = new Set(
    bills.filter((bill) => bill.source === 'recurring' && bill.templateId).map((bill) => bill.templateId as string),
  )

  return templates.filter((template) => template.isActive && template.kind === 'bill' && !presentTemplateIds.has(template.id))
}

function calculatePayPeriodTotals(period: BudgetPeriod, bills: Bill[], expenses: Expense[]): PayPeriodTotals {
  const totalBills = bills.reduce((sum, bill) => sum + bill.amount, 0)
  const paidBills = bills.filter((bill) => bill.isPaid).reduce((sum, bill) => sum + bill.amount, 0)
  const unpaidBills = totalBills - paidBills
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalSetAsides = expenses.filter((expense) => expense.setAsideForTemplateId).reduce((sum, expense) => sum + expense.amount, 0)
  const safeToSpend = period.income - totalBills - totalExpenses
  const leftover = period.income - unpaidBills - paidBills - totalExpenses

  return {
    totalBills,
    paidBills,
    unpaidBills,
    totalExpenses,
    totalSetAsides,
    safeToSpend,
    leftover,
  }
}

function roundCurrencyAmount(amount: number) {
  return Math.round(amount * 100) / 100
}

function getCategoryTargetSpent(expenses: Expense[], category: BudgetCategory) {
  return roundCurrencyAmount(expenses
    .filter((expense) => expense.category === category && !expense.setAsideForTemplateId)
    .reduce((sum, expense) => sum + expense.amount, 0))
}

function calculateCategoryTargetProgress(categoryTargets: CategoryTargets, expenses: Expense[], categories: BudgetCategory[]) {
  const categorySet = new Set(categories)
  for (const category of Object.keys(categoryTargets)) {
    categorySet.add(category)
  }

  return [...categorySet]
    .flatMap<CategoryTargetProgress>((category) => {
      const target = categoryTargets[category]
      if (target === undefined) {
        return []
      }

      const spent = getCategoryTargetSpent(expenses, category)
      const remaining = roundCurrencyAmount(target - spent)
      const percentUsed = target > 0 ? (spent / target) * 100 : spent > 0 ? Number.POSITIVE_INFINITY : 0
      const status =
        spent > target
          ? 'Over target'
          : target === 0
            ? 'On track'
            : percentUsed === 100
              ? 'At target'
              : percentUsed >= 75
                ? 'Getting close'
                : 'On track'

      return [{
        category,
        target,
        spent,
        remaining,
        percentUsed,
        status,
        progressValue: target > 0 ? Math.min(100, Math.max(0, percentUsed)) : spent > 0 ? 100 : 0,
      }]
    })
}

function createPayPeriodSnapshot(period: BudgetPeriod, bills: Bill[], expenses: Expense[], categoryTargets: CategoryTargets): PayPeriodSnapshot {
  const archivedAt = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    label: formatHistoryPeriodLabel(period.startDate, period.endDate),
    cadence: period.cadence,
    startDate: period.startDate,
    endDate: period.endDate,
    income: period.income,
    baseIncome: period.baseIncome,
    rolloverAmount: period.rolloverAmount,
    rolloverApplied: period.rolloverApplied,
    bills: bills.map((bill) => ({ ...bill })),
    expenses: expenses.map((expense) => ({ ...expense })),
    categoryTargets: { ...categoryTargets },
    totals: calculatePayPeriodTotals(period, bills, expenses),
    createdAt: archivedAt,
    archivedAt,
  }
}

function getBillDedupKey(bill: Bill) {
  const templateKey = bill.templateId ? `template:${bill.templateId}` : `name:${bill.name.trim().toLowerCase()}`
  const amountKey = `amount:${bill.amount.toFixed(2)}`
  const categoryKey = `category:${bill.category}`
  const dueDateKey = `due:${bill.dueDate || ''}`
  return [templateKey, amountKey, categoryKey, dueDateKey].join('|')
}

function cloneBillForCarryover(bill: Bill, sourcePayPeriodId: string): Bill {
  return {
    ...bill,
    id: crypto.randomUUID(),
    isPaid: false,
    paidDate: null,
    carriedOverFromPayPeriodId: sourcePayPeriodId,
    notes: 'Carried over from previous pay period',
  }
}

function isCarriedOverBill(bill: Bill) {
  return Boolean(bill.carriedOverFromPayPeriodId)
}

function mergeBillsForNewPeriod(existingBills: Bill[], carriedBills: Bill[]) {
  const merged: Bill[] = []
  const seen = new Set<string>()

  for (const bill of existingBills) {
    const key = getBillDedupKey(bill)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    merged.push(bill)
  }

  for (const bill of carriedBills) {
    const key = getBillDedupKey(bill)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    merged.push(bill)
  }

  return merged
}

function getExpandedCategoriesFromItems(bills: Bill[], expenses: Expense[], categories: BudgetCategory[]) {
  const seeded = new Set<BudgetCategory>()
  for (const category of categories) {
    if (bills.some((bill) => bill.category === category) || expenses.some((expense) => expense.category === category)) {
      seeded.add(category)
    }
  }

  if (seeded.size === 0) {
    seeded.add(categories[0] ?? 'Housing')
  }

  return seeded
}

function formatBackupSummary(summary: LeftlyBackupSummary) {
  return [
    summary.hasActivePayPeriod ? 'active pay period saved' : 'no active pay period',
    `${summary.billCount} bill${summary.billCount === 1 ? '' : 's'}`,
    `${summary.expenseCount} expense${summary.expenseCount === 1 ? '' : 's'}`,
    `${summary.recurringTemplateCount} Bill Plan item${summary.recurringTemplateCount === 1 ? '' : 's'}`,
    `${summary.historySnapshotCount} history snapshot${summary.historySnapshotCount === 1 ? '' : 's'}`,
    `${summary.categoryCount} categor${summary.categoryCount === 1 ? 'y' : 'ies'} in saved order`,
    summary.displaySettingsIncluded ? 'display settings included' : 'display settings not included',
    summary.preferencesIncluded ? 'preferences included' : 'preferences not included',
  ]
}

function formatArchivedDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : historyDateFormatter.format(date)
}

type SnapshotCategorySummary = {
  category: BudgetCategory
  total: number
  count: number
}

function getSnapshotStartingIncome(snapshot: PayPeriodSnapshot) {
  if (typeof snapshot.baseIncome === 'number' && Number.isFinite(snapshot.baseIncome)) {
    return snapshot.baseIncome
  }

  if (snapshot.rolloverApplied && typeof snapshot.rolloverAmount === 'number' && Number.isFinite(snapshot.rolloverAmount)) {
    return Math.max(0, snapshot.income - snapshot.rolloverAmount)
  }

  return snapshot.income
}

function getSnapshotCarriedOverSummary(bills: Bill[]) {
  const carriedBills = bills.filter((bill) => bill.carriedOverFromPayPeriodId)
  return {
    count: carriedBills.length,
    amount: carriedBills.reduce((sum, bill) => sum + bill.amount, 0),
  }
}

function getSnapshotLeftlyStatus(leftover: number) {
  if (leftover < 0) {
    return 'Over budget'
  }

  if (leftover === 0) {
    return 'Fully allocated'
  }

  return 'Left after bills and expenses'
}

function getSnapshotTopExpenseCategories(expenses: Expense[]) {
  const byCategory = new Map<BudgetCategory, SnapshotCategorySummary>()

  for (const expense of expenses) {
    const current = byCategory.get(expense.category)
    if (current) {
      current.total += expense.amount
      current.count += 1
    } else {
      byCategory.set(expense.category, {
        category: expense.category,
        total: expense.amount,
        count: 1,
      })
    }
  }

  return [...byCategory.values()]
    .sort((left, right) => right.total - left.total || right.count - left.count || left.category.localeCompare(right.category))
    .slice(0, 3)
}

function HistorySection({
  snapshots,
  selectedSnapshot,
  onSelectSnapshot,
  onUseAsStartingPoint,
  onExportSnapshotCsv,
  onBackToList,
  onDeleteSnapshot,
  formatCurrency,
}: {
  snapshots: PayPeriodSnapshot[]
  selectedSnapshot: PayPeriodSnapshot | null
  onSelectSnapshot: (id: string) => void
  onUseAsStartingPoint: (snapshot: PayPeriodSnapshot) => void
  onExportSnapshotCsv: (snapshot: PayPeriodSnapshot) => void
  onBackToList: () => void
  onDeleteSnapshot: (id: string) => void
  formatCurrency: (value: number) => string
}) {
  const [showAllExpenses, setShowAllExpenses] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [historySort, setHistorySort] = useState<HistorySort>('newest')

  const filteredSnapshots = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    const matchingSnapshots = snapshots.filter((snapshot) => {
      if (!query) return true
      const periodText = formatHistoryPeriodLabel(snapshot.startDate, snapshot.endDate)
      return [snapshot.label, snapshot.startDate, snapshot.endDate, snapshot.cadence, periodText]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    })
    return matchingSnapshots
      .map((snapshot, index) => ({ snapshot, index }))
      .sort((left, right) => {
        const comparison = historySort === 'highest-leftly' || historySort === 'lowest-leftly'
          ? (historySort === 'highest-leftly' ? right.snapshot.totals.leftover - left.snapshot.totals.leftover : left.snapshot.totals.leftover - right.snapshot.totals.leftover)
          : (() => {
              const leftDate = Date.parse(left.snapshot.archivedAt)
              const rightDate = Date.parse(right.snapshot.archivedAt)
              const safeLeft = Number.isFinite(leftDate) ? leftDate : historySort === 'newest' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
              const safeRight = Number.isFinite(rightDate) ? rightDate : historySort === 'newest' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
              const dateComparison = safeLeft - safeRight
              return historySort === 'newest' ? -dateComparison : dateComparison
            })()
        return comparison || left.index - right.index
      })
      .map(({ snapshot }) => snapshot)
  }, [historySort, searchQuery, snapshots])

  if (selectedSnapshot) {
    const billItems = selectedSnapshot.bills
    const expenseItems = selectedSnapshot.expenses
    const carriedOverSummary = getSnapshotCarriedOverSummary(billItems)
    const topExpenseCategories = getSnapshotTopExpenseCategories(expenseItems)
    const snapshotCategories = Array.from(new Set([...billItems.map((bill) => bill.category), ...expenseItems.map((expense) => expense.category), ...Object.keys(selectedSnapshot.categoryTargets)]))
    const snapshotTargetProgress = calculateCategoryTargetProgress(selectedSnapshot.categoryTargets, expenseItems, snapshotCategories)
    const rolloverAmount = typeof selectedSnapshot.rolloverAmount === 'number' && selectedSnapshot.rolloverAmount > 0 ? selectedSnapshot.rolloverAmount : 0
    const rolloverApplied = typeof selectedSnapshot.rolloverApplied === 'boolean' ? selectedSnapshot.rolloverApplied : null
    const visibleExpenses = showAllExpenses || expenseItems.length <= 5 ? expenseItems : expenseItems.slice(0, 5)
    const finalLeftlyStatus = getSnapshotLeftlyStatus(selectedSnapshot.totals.leftover)

    return (
    <div className="grid gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 sm:text-sm">Archived pay period</p>
            <h3 className="mt-1 text-lg font-semibold text-white sm:text-xl">{selectedSnapshot.label}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
              Archived {formatArchivedDate(selectedSnapshot.archivedAt)} · {selectedSnapshot.cadence}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] sm:mt-3 sm:gap-2 sm:text-[11px]">
              <Badge muted>{selectedSnapshot.cadence}</Badge>
              {rolloverAmount > 0 ? <Badge success>Rollover {formatCurrency(rolloverAmount)}</Badge> : null}
              {rolloverApplied !== null ? <Badge muted>{rolloverApplied ? 'Rollover applied' : 'Rollover not applied'}</Badge> : null}
              {carriedOverSummary.count > 0 ? <Badge muted>{carriedOverSummary.count} carried over</Badge> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => onUseAsStartingPoint(selectedSnapshot)} className="button-primary w-full sm:w-auto">
              Use as starting point
            </button>
            <button type="button" onClick={() => onExportSnapshotCsv(selectedSnapshot)} className="button-secondary w-full sm:w-auto">
              Export CSV
            </button>
            <button type="button" onClick={onBackToList} className="button-secondary w-full sm:w-auto">
              Back
            </button>
            <button
              type="button"
              onClick={() => onDeleteSnapshot(selectedSnapshot.id)}
              className="button-danger sm:w-auto"
            >
              Delete snapshot
            </button>
          </div>
        </div>

        <div className="leftly-shell-accent grid gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Final Leftly</p>
              <p className={`mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl ${selectedSnapshot.totals.leftover < 0 ? 'text-rose-200' : 'text-cyan-50'}`}>
                {formatCurrency(selectedSnapshot.totals.leftover)}
              </p>
              <p className="mt-1 text-sm text-slate-300">{finalLeftlyStatus}</p>
            </div>
            <div className="text-right text-xs leading-5 text-slate-400 sm:text-sm">
              <p>{selectedSnapshot.label}</p>
              <p>Archived {formatArchivedDate(selectedSnapshot.archivedAt)} · {selectedSnapshot.cadence}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <MiniStat label="Starting income" value={formatCurrency(getSnapshotStartingIncome(selectedSnapshot))} dense />
            <MiniStat label="Total bills" value={formatCurrency(selectedSnapshot.totals.totalBills)} dense />
            <MiniStat label="Paid bills" value={formatCurrency(selectedSnapshot.totals.paidBills)} dense />
            <MiniStat label="Unpaid bills" value={formatCurrency(selectedSnapshot.totals.unpaidBills)} dense />
            <MiniStat label="Total expenses" value={formatCurrency(selectedSnapshot.totals.totalExpenses)} dense />
          </div>
        </div>

        {rolloverAmount > 0 || carriedOverSummary.count > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            {rolloverAmount > 0 ? (
              <div className="leftly-shell p-3 sm:p-4">
                <p className="text-sm font-semibold text-white">Rollover</p>
                <p className="mt-2 text-base font-semibold text-slate-100 sm:text-lg">{formatCurrency(rolloverAmount)}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {rolloverApplied !== null ? (rolloverApplied ? 'Applied to the next pay period.' : 'Not applied to the next pay period.') : 'Rollover metadata available.'}
                </p>
              </div>
            ) : null}
            {carriedOverSummary.count > 0 ? (
              <div className="leftly-shell p-3 sm:p-4">
                <p className="text-sm font-semibold text-white">Carried over bills</p>
                <p className="mt-2 text-base font-semibold text-slate-100 sm:text-lg">
                  {carriedOverSummary.count} unpaid bill{carriedOverSummary.count === 1 ? '' : 's'} · {formatCurrency(carriedOverSummary.amount)}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">These were moved forward from the previous pay period.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="leftly-shell p-3 sm:p-4">
            <p className="text-sm font-semibold text-white">Bills</p>
            <div className="mt-3 grid gap-2">
              {billItems.length > 0 ? (
                billItems.map((bill) => (
                  <div
                    key={bill.id}
                    className={`flex flex-col gap-2 rounded-2xl border p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-3 ${
                      bill.isPaid ? 'border-slate-800/70 bg-slate-950/60' : 'border-rose-500/25 bg-rose-500/8'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-white">{bill.name}</p>
                        {bill.source === 'recurring' ? <Badge muted>Bill Plan</Badge> : null}
                        {bill.carriedOverFromPayPeriodId ? <Badge muted>Carried over</Badge> : null}
                        {bill.isPaid ? <Badge success>Paid</Badge> : <Badge muted>Unpaid</Badge>}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400 sm:text-xs">
                        {bill.category} · Due {bill.dueDate}
                        {bill.source === 'recurring' ? ' · generated from Bill Plan' : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white sm:text-base">{formatCurrency(bill.amount)}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No bills in this period" text="This archived pay period did not include any bills." compact />
              )}
            </div>
          </div>

          <div className="leftly-shell p-3 sm:p-4">
            <p className="text-sm font-semibold text-white">Expenses</p>
            <div className="mt-3 grid gap-2">
              {expenseItems.length > 0 ? (
                visibleExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-2 leftly-shell-soft p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-white">{expense.name}</p>
                        {expense.source === 'recurring' ? (
                          <Badge muted>{expense.setAsideForTemplateId ? 'Set-aside' : expense.isPlanned ? 'Planned spending' : 'Bill Plan'}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400 sm:text-xs">
                        {expense.category} · {expense.date}
                        {expense.setAsideForTemplateId ? ' · reserves money before the bill is due' : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white sm:text-base">{formatCurrency(expense.amount)}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No expenses in this period" text="This archived pay period did not include any expenses." compact />
              )}
            </div>
            {expenseItems.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllExpenses((current) => !current)}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-700 hover:bg-slate-900"
              >
                {showAllExpenses ? 'Show less expenses' : `Show more expenses (+${expenseItems.length - 5})`}
              </button>
            ) : null}
          </div>
        </div>

        <div className="leftly-shell p-3 sm:p-4">
          <p className="text-sm font-semibold text-white">Top spending categories</p>
          {topExpenseCategories.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {topExpenseCategories.map((summary) => (
                <div key={summary.category} className="leftly-shell-soft px-3 py-2.5">
                  <p className="text-sm font-medium text-white">{summary.category}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400 sm:text-xs">
                    {formatCurrency(summary.total)} · {summary.count} item{summary.count === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-400">No spending categories for this archived pay period.</p>
          )}
        </div>

        {snapshotTargetProgress.length > 0 ? (
          <div className="leftly-shell p-3 sm:p-4">
            <p className="text-sm font-semibold text-white">Category target results</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {snapshotTargetProgress.map((progress) => (
                <TargetProgressCard key={progress.category} progress={progress} formatCurrency={formatCurrency} compact />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {snapshots.length > 0 ? (
        <div className="grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-4">
          <label className="leftly-field">
            <span>Search archived periods</span>
            <span className="leftly-input-shell"><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="June, 2026-06, biweekly…" /></span>
          </label>
          <label className="leftly-field sm:min-w-56">
            <span>Sort history</span>
            <span className="leftly-input-shell">
              <select value={historySort} onChange={(event) => setHistorySort(event.target.value as HistorySort)}>
                <option value="newest">Newest archived first</option>
                <option value="oldest">Oldest archived first</option>
                <option value="highest-leftly">Highest Final Leftly</option>
                <option value="lowest-leftly">Lowest Final Leftly</option>
              </select>
            </span>
          </label>
        </div>
      ) : null}
      {snapshots.length > 0 && filteredSnapshots.length === 0 ? (
        <EmptyState title="No archived periods match" text="Try a different search term or clear the search field." />
      ) : snapshots.length > 0 ? (
        <div className="grid gap-2.5 sm:gap-3">
          {filteredSnapshots.map((snapshot) => (
            <article key={snapshot.id} className="leftly-shell p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <button type="button" onClick={() => onSelectSnapshot(snapshot.id)} aria-label={`Open details for ${snapshot.label}`} className="min-w-0 flex-1 rounded-xl text-left focus:outline-none focus:ring-4 focus:ring-cyan-400/20">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3 className="min-w-0 text-sm font-semibold text-white sm:text-base">{snapshot.label}</h3>
                    <Badge muted>{snapshot.cadence}</Badge>
                    {snapshot.rolloverAmount && snapshot.rolloverAmount > 0 ? (
                      <Badge success>
                        Rollover {formatCurrency(snapshot.rolloverAmount)}
                        {snapshot.rolloverApplied === false ? ' not applied' : ''}
                      </Badge>
                    ) : null}
                    {getSnapshotCarriedOverSummary(snapshot.bills).count > 0 ? <Badge muted>{getSnapshotCarriedOverSummary(snapshot.bills).count} carried over</Badge> : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400 sm:text-sm">Archived {formatArchivedDate(snapshot.archivedAt)} · {snapshot.startDate} to {snapshot.endDate}</p>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-800/70 pt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Final Leftly</span>
                    <span className={`text-right text-base font-semibold sm:text-lg ${snapshot.totals.leftover < 0 ? 'text-rose-200' : 'text-cyan-50'}`}>
                      {formatCurrency(snapshot.totals.leftover)}
                      <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{getSnapshotLeftlyStatus(snapshot.totals.leftover)}</span>
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteSnapshot(snapshot.id)}
                  className="button-danger sm:self-start"
                >
                  Delete
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-800/70 pt-3 sm:grid-cols-4">
                <MiniStat label="Starting income" value={formatCurrency(getSnapshotStartingIncome(snapshot))} dense />
                <MiniStat label="Total bills" value={formatCurrency(snapshot.totals.totalBills)} dense />
                <MiniStat label="Total expenses" value={formatCurrency(snapshot.totals.totalExpenses)} dense />
                <MiniStat label="Paid / unpaid" value={`${formatCurrency(snapshot.totals.paidBills)} paid · ${formatCurrency(snapshot.totals.unpaidBills)} unpaid`} dense />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No pay periods archived yet" text="When you start a new pay period, Leftly saves the current one here." />
      )}
    </div>
  )
}

function MiniStat({
  label,
  value,
  detail,
  tone = 'default',
  dense = false,
}: {
  label: string
  value: string
  detail?: string
  tone?: 'default' | 'highlight'
  dense?: boolean
}) {
  return (
    <div
      className={`leftly-shell-soft px-3 ${dense ? 'py-2.5' : 'py-3 sm:py-3.5'} ${tone === 'highlight' ? 'leftly-shell-accent' : ''}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">{label}</p>
      <p className={`mt-2 ${dense ? 'text-sm sm:text-[0.96rem]' : 'text-base sm:text-lg'} font-semibold tracking-[-0.02em] leading-tight ${tone === 'highlight' ? 'text-cyan-50' : 'text-white'}`}>{value}</p>
      {detail ? <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${dense ? 'sm:text-[11px]' : 'sm:text-xs'}`}>{detail}</p> : null}
    </div>
  )
}

function App() {
  const landingBackupInputRef = useRef<HTMLInputElement | null>(null)
  const mainContentRef = useRef<HTMLDivElement | null>(null)
  const quickAddNameInputRef = useRef<HTMLInputElement | null>(null)
  const moreFirstItemRef = useRef<HTMLButtonElement | null>(null)
  const overlayTriggerRef = useRef<HTMLElement | null>(null)
  const hasMountedScreenTransitionRef = useRef(false)
  const [activeTab, setActiveTab] = useState<ContentTabKey>(getInitialActiveTab)
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null)
  const [screenTransitionPhase, setScreenTransitionPhase] = useState<'a' | 'b'>('a')
  const [payPeriod, setPayPeriod] = useState<BudgetPeriod | null>(initialPayPeriod)
  const [bills, setBills] = useState<Bill[]>(initialBills)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringItemTemplate[]>(initialRecurringTemplates)
  const [payPeriodHistory, setPayPeriodHistory] = useState<PayPeriodSnapshot[]>(initialPayPeriodHistory)
  const [historyStartSnapshot, setHistoryStartSnapshot] = useState<PayPeriodSnapshot | null>(null)
  const [editingItem, setEditingItem] = useState<EditTarget | null>(null)
  const [preferences, setPreferences] = useState<LeftlyPreferences>(initialPreferences)
  const [sortMode, setSortMode] = useState<SortMode>(initialSortMode)
  const [categoryOrderMode, setCategoryOrderMode] = useState<CategoryOrderMode>(initialCategoryOrderMode)
  const [customCategories, setCustomCategories] = useState<BudgetCategory[]>(initialCustomCategories)
  const [categoryOrder, setCategoryOrder] = useState<BudgetCategory[]>(initialCategoryOrder)
  const [categoryTargets, setCategoryTargets] = useState<CategoryTargets>(initialCategoryTargets)
  const [expandedCategories, setExpandedCategories] = useState<Set<BudgetCategory>>(() => {
    return getExpandedCategoriesFromItems(initialBills, initialExpenses, initialAllCategories)
  })
  const [payPeriodDraft, setPayPeriodDraft] = useState<PayPeriodDraft>(() =>
    getDraftFromPeriod(initialPayPeriod, initialPreferences.defaultPayCadence),
  )
  const [billDraft, setBillDraft] = useState<BillDraft>(() => getBlankBillDraft(initialPreferences.defaultCategory))
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => getBlankExpenseDraft(initialPreferences.defaultCategory))
  const [payPeriodError, setPayPeriodError] = useState('')
  const [billError, setBillError] = useState('')
  const [expenseError, setExpenseError] = useState('')
  const [incomeSuccess, setIncomeSuccess] = useState('')
  const [billSuccess, setBillSuccess] = useState('')
  const [expenseSuccess, setExpenseSuccess] = useState('')
  const [billStatus, setBillStatus] = useState('')
  const [categoryStatus, setCategoryStatus] = useState('')
  const [dataMessage, setDataMessage] = useState('')
  const [dataError, setDataError] = useState('')
  const [setupSuccess, setSetupSuccess] = useState('')
  const [billPlanMessage, setBillPlanMessage] = useState('')
  const [newCustomCategoryName, setNewCustomCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [renamingCategory, setRenamingCategory] = useState<BudgetCategory | null>(null)
  const [renameCategoryDraft, setRenameCategoryDraft] = useState('')
  const [deletingCategory, setDeletingCategory] = useState<BudgetCategory | null>(null)
  const [deleteReplacementCategory, setDeleteReplacementCategory] = useState<BudgetCategory>(FALLBACK_CATEGORY)
  const [targetEditingCategory, setTargetEditingCategory] = useState<BudgetCategory | null>(null)
  const [targetDraft, setTargetDraft] = useState('')
  const [currentPeriodSearch, setCurrentPeriodSearch] = useState('')
  const [currentPeriodFilter, setCurrentPeriodFilter] = useState<CurrentPeriodItemFilter>('all')
  const [isImportingBackup, setIsImportingBackup] = useState(false)
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [isApplyBillPlanOpen, setIsApplyBillPlanOpen] = useState(false)
  const [isStartNewPayPeriodOpen, setIsStartNewPayPeriodOpen] = useState(false)
  const [startNewPayPeriodInitialDraft, setStartNewPayPeriodInitialDraft] = useState<{
    income: string
    cadence: PayCadence
    startDate: string
    endDate: string
  } | null>(null)
  const [isCorrectingCurrentPeriodDates, setIsCorrectingCurrentPeriodDates] = useState(false)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const allCategories = useMemo(() => getAllCategories(customCategories), [customCategories])
  const resolvedCategoryOrder = useMemo(() => reconcileCategoryOrder(categoryOrder, customCategories), [categoryOrder, customCategories])
  const visibleExpandedCategories = useMemo(() => {
    const next = new Set<BudgetCategory>()
    for (const category of allCategories) {
      if (expandedCategories.has(category)) {
        next.add(category)
      }
    }

    if (next.size === 0) {
      next.add(allCategories[0] ?? FALLBACK_CATEGORY)
    }

    return next
  }, [allCategories, expandedCategories])

  useEffect(() => {
    saveActiveBudgetPeriod(payPeriod)
  }, [payPeriod])

  useEffect(() => {
    if (payPeriod) {
      clearSetupDraft()
    }
  }, [payPeriod])

  useEffect(() => {
    saveActiveTab(activeTab)
  }, [activeTab])

  useEffect(() => {
    savePreferences(preferences)
  }, [preferences])

  useEffect(() => {
    saveCustomCategories(customCategories)
  }, [customCategories])

  useEffect(() => {
    saveBills(bills)
  }, [bills])

  useEffect(() => {
    saveExpenses(expenses)
  }, [expenses])

  useEffect(() => {
    saveRecurringTemplates(recurringTemplates)
  }, [recurringTemplates])

  useEffect(() => {
    savePayPeriodHistory(payPeriodHistory)
  }, [payPeriodHistory])

  useEffect(() => {
    saveSortMode(sortMode)
  }, [sortMode])

  useEffect(() => {
    saveCategoryOrder(resolvedCategoryOrder, customCategories)
  }, [customCategories, resolvedCategoryOrder])

  useEffect(() => {
    saveCategoryOrderMode(categoryOrderMode)
  }, [categoryOrderMode])

  useEffect(() => {
    saveCategoryTargets(categoryTargets)
  }, [categoryTargets])

  useEffect(() => {
    if (!incomeSuccess) {
      return undefined
    }

    const timer = window.setTimeout(() => setIncomeSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [incomeSuccess])

  useEffect(() => {
    if (!billSuccess) {
      return undefined
    }

    const timer = window.setTimeout(() => setBillSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [billSuccess])

  useEffect(() => {
    if (!expenseSuccess) {
      return undefined
    }

    const timer = window.setTimeout(() => setExpenseSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [expenseSuccess])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [activeTab])

  useEffect(() => {
    if (!hasMountedScreenTransitionRef.current) {
      hasMountedScreenTransitionRef.current = true
      return
    }

    setScreenTransitionPhase((current) => (current === 'a' ? 'b' : 'a'))
  }, [activeTab])

  useEffect(() => {
    const contentNode = mainContentRef.current
    if (!contentNode) {
      return undefined
    }

    if (activeOverlay) {
      contentNode.setAttribute('aria-hidden', 'true')
      contentNode.setAttribute('inert', '')
    } else {
      contentNode.removeAttribute('aria-hidden')
      contentNode.removeAttribute('inert')
    }

    return () => {
      contentNode.removeAttribute('aria-hidden')
      contentNode.removeAttribute('inert')
    }
  }, [activeOverlay])

  useEffect(() => {
    if (activeTab !== 'history' && activeOverlay === 'history-detail') {
      const cleanupTimer = window.setTimeout(() => {
        setActiveOverlay(null)
        setSelectedHistoryId(null)
      }, 0)
      return () => window.clearTimeout(cleanupTimer)
    }
    return undefined
  }, [activeOverlay, activeTab])

  useEffect(() => {
    if (!dataMessage) {
      return undefined
    }

    const timer = window.setTimeout(() => setDataMessage(''), 3000)
    return () => window.clearTimeout(timer)
  }, [dataMessage])

  useEffect(() => {
    if (!dataError) {
      return undefined
    }

    const timer = window.setTimeout(() => setDataError(''), 5000)
    return () => window.clearTimeout(timer)
  }, [dataError])

  useEffect(() => {
    if (!setupSuccess) {
      return undefined
    }

    const timer = window.setTimeout(() => setSetupSuccess(''), 3000)
    return () => window.clearTimeout(timer)
  }, [setupSuccess])

  useEffect(() => {
    if (!billPlanMessage) {
      return undefined
    }

    const timer = window.setTimeout(() => setBillPlanMessage(''), 3000)
    return () => window.clearTimeout(timer)
  }, [billPlanMessage])

  useEffect(() => {
    if (!categoryStatus) {
      return undefined
    }

    const timer = window.setTimeout(() => setCategoryStatus(''), 3000)
    return () => window.clearTimeout(timer)
  }, [categoryStatus])

  const totals = useMemo(() => {
    const income = payPeriod?.income ?? 0
    const totalPlannedBills = bills.reduce((sum, bill) => sum + bill.amount, 0)
    const paidBills = bills.filter((bill) => bill.isPaid).reduce((sum, bill) => sum + bill.amount, 0)
    const unpaidBills = totalPlannedBills - paidBills
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const totalSetAside = expenses.filter((expense) => expense.setAsideForTemplateId).reduce((sum, expense) => sum + expense.amount, 0)
    const leftover = income - unpaidBills - paidBills - totalExpenses
    const safeToSpend = income - totalPlannedBills - totalExpenses

    return {
      income,
      totalPlannedBills,
      paidBills,
      unpaidBills,
      totalExpenses,
      totalSetAside,
      leftover,
      safeToSpend,
    }
  }, [bills, expenses, payPeriod])

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const itemsByCategory = new Map<BudgetCategory, BudgetItem[]>()

    for (const category of allCategories) {
      itemsByCategory.set(category, [])
    }

    for (const bill of bills) {
      itemsByCategory.get(bill.category)?.push({
        id: bill.id,
        name: bill.name,
        amount: bill.amount,
        category: bill.category,
        kind: 'bill',
        dueDate: bill.dueDate,
        isPaid: bill.isPaid,
        paidDate: bill.paidDate,
        source: bill.source,
        templateId: bill.templateId,
        generatedForPeriodId: bill.generatedForPeriodId,
      })
    }

    for (const expense of expenses) {
      itemsByCategory.get(expense.category)?.push({
        id: expense.id,
        name: expense.name,
        amount: expense.amount,
        category: expense.category,
        kind: 'expense',
        date: expense.date,
        source: expense.source,
        templateId: expense.templateId,
        generatedForPeriodId: expense.generatedForPeriodId,
        isPlanned: expense.isPlanned,
        setAsideForTemplateId: expense.setAsideForTemplateId,
      })
    }

    const summaries = allCategories.map((category) => {
      const items = sortItems(itemsByCategory.get(category) ?? [], sortMode)
      const total = items.reduce((sum, item) => sum + item.amount, 0)
      const billCount = items.filter((item) => item.kind === 'bill').length
      const expenseCount = items.filter((item) => item.kind === 'expense').length
      const manualExpenseCount = items.filter((item) => item.kind === 'expense' && item.source !== 'recurring').length
      return { category, items, total, billCount, expenseCount, manualExpenseCount }
    })

    if (categoryOrderMode === 'custom') {
      const indexByCategory = new Map(resolvedCategoryOrder.map((category, index) => [category, index]))
      return [...summaries].sort(
        (a, b) => (indexByCategory.get(a.category) ?? 0) - (indexByCategory.get(b.category) ?? 0),
      )
    }

    return [...summaries].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
  }, [allCategories, bills, categoryOrderMode, expenses, resolvedCategoryOrder, sortMode])

  const normalizedCurrentPeriodSearch = currentPeriodSearch.trim().toLocaleLowerCase()
  const visibleCategorySummaries = useMemo<CategorySummary[]>(() => {
    return categorySummaries
      .map((summary) => {
        const items = summary.items.filter((item) => {
          if (!matchesCurrentPeriodFilter(item, currentPeriodFilter)) {
            return false
          }

          if (!normalizedCurrentPeriodSearch) {
            return true
          }

          return `${item.name} ${item.category}`.toLocaleLowerCase().includes(normalizedCurrentPeriodSearch)
        })

        if (items.length === 0) {
          return null
        }

        return {
          ...summary,
          items,
          total: items.reduce((sum, item) => sum + item.amount, 0),
          billCount: items.filter((item) => item.kind === 'bill').length,
          expenseCount: items.filter((item) => item.kind === 'expense').length,
          manualExpenseCount: items.filter((item) => item.kind === 'expense' && item.source !== 'recurring').length,
        }
      })
      .filter((summary): summary is CategorySummary => summary !== null)
  }, [categorySummaries, currentPeriodFilter, normalizedCurrentPeriodSearch])

  const topCategories = useMemo(() => {
    return [...categorySummaries]
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
      .slice(0, 3)
  }, [categorySummaries])

  const categoryTargetProgress = useMemo(
    () => calculateCategoryTargetProgress(categoryTargets, expenses, allCategories),
    [allCategories, categoryTargets, expenses],
  )

  const categoryTargetProgressByCategory = useMemo(
    () => new Map(categoryTargetProgress.map((progress) => [progress.category, progress])),
    [categoryTargetProgress],
  )

  const overviewCategoryTargets = useMemo(
    () =>
      [...categoryTargetProgress]
        .sort((left, right) => {
          const leftPriority = left.status === 'Over target' ? 2 : left.status === 'At target' ? 1 : 0
          const rightPriority = right.status === 'Over target' ? 2 : right.status === 'At target' ? 1 : 0
          return rightPriority - leftPriority || right.percentUsed - left.percentUsed || left.remaining - right.remaining || left.category.localeCompare(right.category)
        })
        .slice(0, 4),
    [categoryTargetProgress],
  )

  const recurringTemplateById = useMemo(
    () => new Map(recurringTemplates.map((template) => [template.id, template])),
    [recurringTemplates],
  )

  const upcomingRecurringBills = useMemo(
    () => getUpcomingRecurringBills(recurringTemplates, bills),
    [bills, recurringTemplates],
  )
  const hasActiveBillPlanItems = useMemo(
    () => recurringTemplates.some((template) => template.isActive),
    [recurringTemplates],
  )

  const recentBills = useMemo(() => bills.slice(0, 3), [bills])
  const recurringBills = useMemo(() => bills.filter((bill) => bill.source === 'recurring'), [bills])
  const recurringBillSummary = useMemo(() => summarizeBillPayments(recurringBills), [recurringBills])
  const oneTimeBills = useMemo(() => bills.filter((bill) => bill.source !== 'recurring'), [bills])
  const oneTimeBillSummary = useMemo(() => summarizeBillPayments(oneTimeBills), [oneTimeBills])
  const billPaymentSummary = useMemo(() => summarizeBillPayments(bills), [bills])
  const recentExpenses = useMemo(() => expenses.slice(0, 3), [expenses])
  const dueSoonBills = useMemo<DueSoonBillRow[]>(() => {
    if (!payPeriod) {
      return []
    }

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const soonEnd = addDays(todayStart, 7)
    const currentPeriodKey = getRecurringPeriodKey(payPeriod)
    const dueSoonOrder: Record<DueSoonBillRow['status'], number> = {
      Overdue: 0,
      'Due today': 1,
      'Due in next 7 days': 2,
    }

    return bills
      .filter((bill) => {
        if (bill.isPaid || !bill.dueDate) {
          return false
        }

        return bill.source !== 'recurring' || bill.generatedForPeriodId === currentPeriodKey || !bill.generatedForPeriodId
      })
      .flatMap<DueSoonBillRow>((bill) => {
        const dueDate = parseLocalDate(bill.dueDate)
        if (Number.isNaN(dueDate.getTime()) || dueDate > soonEnd) {
          return []
        }
        const template = bill.templateId ? recurringTemplateById.get(bill.templateId) : undefined

        let status: DueSoonBillRow['status']
        let statusTone: DueSoonBillRow['statusTone']

        if (dueDate < todayStart) {
          status = 'Overdue'
          statusTone = 'rose'
        } else if (dueDate.getTime() === todayStart.getTime()) {
          status = 'Due today'
          statusTone = 'cyan'
        } else {
          status = 'Due in next 7 days'
          statusTone = 'amber'
        }

        return [{
          bill,
          status,
          statusTone,
          dueDateLabel: dueSoonDateFormatter.format(dueDate),
          scheduleLabel: template ? formatPlanSchedule(template) : undefined,
          planName: template ? normalizeRecurringPlanName(template.planName) : undefined,
        }]
      })
      .sort(
        (left, right) =>
          dueSoonOrder[left.status] - dueSoonOrder[right.status] ||
          parseLocalDate(left.bill.dueDate).getTime() - parseLocalDate(right.bill.dueDate).getTime() ||
          left.bill.name.localeCompare(right.bill.name),
      )
  }, [bills, payPeriod, recurringTemplateById])

  const spendingSnapshot = useMemo<SpendingSnapshotRow[]>(() => {
    if (!payPeriod || expenses.length === 0) {
      return []
    }

    const byCategory = new Map<BudgetCategory, SpendingSnapshotRow>()

    for (const expense of expenses) {
      const current = byCategory.get(expense.category)
      if (current) {
        current.total += expense.amount
        current.count += 1
      } else {
        byCategory.set(expense.category, {
          category: expense.category,
          total: expense.amount,
          count: 1,
        })
      }
    }

    return [...byCategory.values()]
      .sort((left, right) => right.total - left.total || left.category.localeCompare(right.category))
      .slice(0, 4)
  }, [expenses, payPeriod])

  const spendingSnapshotTotal = useMemo(
    () => spendingSnapshot.reduce((sum, row) => sum + row.total, 0),
    [spendingSnapshot],
  )

  const spendingSnapshotCategoryCount = useMemo(() => {
    if (!payPeriod || expenses.length === 0) {
      return 0
    }

    return new Set(expenses.map((expense) => expense.category)).size
  }, [expenses, payPeriod])

  const recentManualExpenses = useMemo(
    () => expenses.filter((expense) => expense.source !== 'recurring').slice(0, 4),
    [expenses],
  )

  const manualExpenses = useMemo(
    () => expenses.filter((expense) => expense.source !== 'recurring'),
    [expenses],
  )

  const manualExpenseTotal = useMemo(
    () => manualExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [manualExpenses],
  )

  const quickAddCategorySuggestions = useMemo(() => {
    const suggestions = new Set<BudgetCategory>([preferences.defaultCategory])

    for (const expense of recentManualExpenses) {
      suggestions.add(expense.category)
      if (suggestions.size >= 5) {
        break
      }
    }

    if (suggestions.size < 5) {
      for (const expense of expenses) {
        suggestions.add(expense.category)
        if (suggestions.size >= 5) {
          break
        }
      }
    }

    return [...suggestions]
  }, [expenses, preferences.defaultCategory, recentManualExpenses])

  const currentPayPeriodReview = useMemo(() => {
    if (!payPeriod) {
      return null
    }

    const categories = new Map<BudgetCategory, { total: number; count: number }>()
    for (const expense of expenses) {
      const current = categories.get(expense.category)
      if (current) {
        current.total += expense.amount
        current.count += 1
      } else {
        categories.set(expense.category, { total: expense.amount, count: 1 })
      }
    }

    const topCategory = [...categories.entries()].sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]))[0]

    return {
      periodLabel: formatHistoryPeriodLabel(payPeriod.startDate, payPeriod.endDate),
      income: payPeriod.income,
      totalBills: totals.totalPlannedBills,
      paidBillsCount: bills.filter((bill) => bill.isPaid).length,
      unpaidBillsCount: bills.filter((bill) => !bill.isPaid).length,
      unpaidBills: bills
        .filter((bill) => !bill.isPaid)
        .slice()
        .sort(
          (left, right) =>
            parseLocalDate(left.dueDate).getTime() - parseLocalDate(right.dueDate).getTime() ||
            left.category.localeCompare(right.category) ||
            left.name.localeCompare(right.name),
        ),
      totalExpenses: totals.totalExpenses,
      totalSetAsides: totals.totalSetAside,
      leftover: totals.leftover,
      topCategory: topCategory
        ? {
            category: topCategory[0],
            total: topCategory[1].total,
          }
        : null,
    }
  }, [bills, expenses, payPeriod, totals])

  const selectedHistorySnapshot = useMemo(
    () => payPeriodHistory.find((snapshot) => snapshot.id === selectedHistoryId) ?? null,
    [payPeriodHistory, selectedHistoryId],
  )

  useEffect(() => {
    if (activeOverlay === 'history-detail' && !selectedHistorySnapshot) {
      const cleanupTimer = window.setTimeout(() => {
        setActiveOverlay(null)
        setSelectedHistoryId(null)
      }, 0)
      return () => window.clearTimeout(cleanupTimer)
    }
    return undefined
  }, [activeOverlay, selectedHistorySnapshot])

  const categoryRank = useMemo(() => {
    return new Map(
      [...visibleCategorySummaries]
        .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
        .map((summary, index) => [summary.category, index + 1]),
    )
  }, [visibleCategorySummaries])
  const backupSummary = useMemo(
    () =>
      getLeftlyBackupSummary({
        activeBudgetPeriod: payPeriod,
        bills,
        expenses,
        recurringTemplates,
        payPeriodHistory,
        categoryTargets,
        categoryOrder: resolvedCategoryOrder,
        customCategories,
        preferences,
      }),
    [payPeriod, bills, expenses, recurringTemplates, payPeriodHistory, categoryTargets, resolvedCategoryOrder, customCategories, preferences],
  )

  const activeBottomNavTab: MainTabKey = activeOverlay
    ? activeOverlay === 'history-detail' ? 'history' : activeOverlay
    : activeTab === 'income' ||
        activeTab === 'bill' ||
        activeTab === 'expense' ||
        activeTab === 'categories' ||
        activeTab === 'data' ||
        activeTab === 'help'
      ? 'more'
      : activeTab

  const deleteCategoryCounts = useMemo(() => {
    if (!deletingCategory) {
      return null
    }

    return getCategoryReferenceCounts(
      {
        bills,
        expenses,
        recurringTemplates,
        payPeriodHistory,
        categoryTargets,
        preferences,
        setupDraft: payPeriod ? null : loadRawSetupDraft(payPeriod),
      },
      deletingCategory,
    )
  }, [bills, categoryTargets, deletingCategory, expenses, payPeriod, payPeriodHistory, preferences, recurringTemplates])

  const deleteCategorySummary = useMemo(() => {
    if (!deleteCategoryCounts) {
      return null
    }

    const currentReferenceCount =
      deleteCategoryCounts.activeBills +
      deleteCategoryCounts.activeExpenses +
      deleteCategoryCounts.recurringTemplates +
      deleteCategoryCounts.preferences +
      deleteCategoryCounts.setupDraft
    const historicalReferenceCount = deleteCategoryCounts.historyBills + deleteCategoryCounts.historyExpenses

    return {
      currentReferenceCount,
      historicalReferenceCount,
      activeTargetCount: deleteCategoryCounts.activeTargets,
      historicalTargetSnapshotCount: deleteCategoryCounts.historyTargetSnapshots,
      requiresReplacement: currentReferenceCount + historicalReferenceCount > 0,
    }
  }, [deleteCategoryCounts])

  const activeScreenLabel = tabScreenLabels[activeTab] ?? 'Leftly'

  function formatCurrency(value: number) {
    return currencyFormatter.format(value)
  }

  function openSetup() {
    setActiveTab('overview')
    setIsSetupOpen(true)
    setSetupSuccess('')
  }

  function openBillPlanApply() {
    if (!payPeriod || !hasActiveBillPlanItems) {
      return
    }

    setIsApplyBillPlanOpen(true)
    setBillPlanMessage('')
  }

  function getBackupFilename() {
    return `leftly-backup-${new Date().toISOString().slice(0, 10)}.json`
  }

  function getCsvDateSuffix(value?: string) {
    return (value ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
  }

  function exportCurrentPeriodCsv() {
    const csv = createCurrentPeriodCsv({
      payPeriod,
      bills,
      expenses,
      categoryTotals: categorySummaries.map((summary) => ({ category: summary.category, total: summary.total })),
      totals,
    })

    downloadCsv(`leftly-current-period-${getCsvDateSuffix(payPeriod?.startDate)}.csv`, csv)
  }

  function exportHistorySnapshotCsv(snapshot: PayPeriodSnapshot) {
    const csv = createHistorySnapshotCsv(snapshot)
    downloadCsv(`leftly-period-${getCsvDateSuffix(snapshot.startDate)}.csv`, csv)
  }

  function exportAllHistoryCsv() {
    const csv = createAllHistoryCsv(payPeriodHistory)
    downloadCsv(`leftly-history-${getCsvDateSuffix()}.csv`, csv)
  }

  function handleFinishSetup(result: { period: BudgetPeriod; recurringTemplates?: RecurringItemTemplate[] }) {
    const setupTemplates = result.recurringTemplates ?? []
    const templatesToGenerate = setupTemplates.length > 0 ? [...setupTemplates, ...recurringTemplates] : recurringTemplates
    const generated = generateRecurringItems({
      templates: templatesToGenerate,
      period: result.period,
      existingBills: [],
      existingExpenses: [],
    })

    clearSetupDraft()
    setPayPeriod(result.period)
    setPayPeriodDraft(getDraftFromPeriod(result.period))
    setBills(generated.bills)
    setExpenses(generated.expenses)
    setRecurringTemplates(generated.templates)
    setExpandedCategories(getExpandedCategoriesFromItems(generated.bills, generated.expenses, allCategories))
    setActiveTab('overview')
    setIsSetupOpen(false)
    if (setupTemplates.length > 0) {
      const setupTemplateIds = new Set(setupTemplates.map((template) => template.id))
      const savedLabel = `${setupTemplates.length} Bill Plan item${setupTemplates.length === 1 ? '' : 's'}`
      const savedVerb = setupTemplates.length === 1 ? 'was' : 'were'
      const billAddedCount = generated.bills.filter((bill) => bill.templateId && setupTemplateIds.has(bill.templateId)).length
      const setAsideAddedCount = generated.expenses.filter(
        (expense) => expense.setAsideForTemplateId && setupTemplateIds.has(expense.setAsideForTemplateId),
      ).length

      if (billAddedCount > 0 || setAsideAddedCount > 0) {
        setSetupSuccess(`Setup complete. Your pay period is ready and ${savedLabel} ${savedVerb} saved.`)
      } else {
        setSetupSuccess(`Setup complete. Your pay period is ready and ${savedLabel} ${savedVerb} saved for later.`)
      }
    } else {
      setSetupSuccess('Setup complete. Your pay period is ready.')
    }
    setPayPeriodError('')
    setBillError('')
    setExpenseError('')
    setIncomeSuccess('')
    setBillSuccess('')
    setExpenseSuccess('')
    setBillStatus('')
    setDataMessage('')
    setDataError('')
  }

  function handleApplyBillPlan(result: { bills: Bill[]; expenses: Expense[]; templates: RecurringItemTemplate[] }) {
    setBills(result.bills)
    setExpenses(result.expenses)
    setRecurringTemplates(result.templates)
    setIsApplyBillPlanOpen(false)

    const addedBills = result.bills.length - bills.length
    const addedExpenses = result.expenses.length - expenses.length
    if (addedBills > 0 || addedExpenses > 0) {
      setBillPlanMessage(
        `Bill Plan applied. Added ${addedBills} bill${addedBills === 1 ? '' : 's'} and ${addedExpenses} expense${addedExpenses === 1 ? '' : 's'} to this pay period.`,
      )
    } else {
      setBillPlanMessage('Bill Plan reviewed. No new items were added to this pay period.')
    }
  }

  function exportBackup() {
    setDataError('')
    setDataMessage('')

    const backup = buildLeftlyBackup({
      activeBudgetPeriod: payPeriod,
      bills,
      expenses,
      recurringTemplates,
      payPeriodHistory,
      categoryTargets,
      categoryOrder: resolvedCategoryOrder,
      customCategories,
      categoryOrderMode,
      sortMode,
      preferences,
    })

    const blob = new Blob([serializeLeftlyBackup(backup)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = getBackupFilename()
    anchor.click()
    window.URL.revokeObjectURL(url)
    setDataMessage(
      `Backup exported as ${anchor.download}. Save it somewhere safe before resetting data or switching devices.`,
    )
  }

  async function importBackupFile(file: File | null) {
    setDataError('')
    setDataMessage('')
    setIsImportingBackup(true)

    try {
      if (!file) {
        setDataError('Please choose a backup file.')
        return
      }

      let text = ''
      try {
        text = await file.text()
      } catch {
        setDataError('We could not read that file.')
        return
      }

      const parsed = parseLeftlyBackupJson(text)
      if (!parsed.ok) {
        setDataError(parsed.error)
        return
      }

      const importSummary = parsed.backup.summary ?? getLeftlyBackupSummary(parsed.backup)
      if (
        !window.confirm(
          `Import this Leftly backup from ${file.name}?\n\nIt will replace the current data saved on this device.\n\nThis backup includes ${formatBackupSummary(importSummary).join(', ')}.\n\nOlder Leftly backups still work even if they do not include newer metadata. Export a fresh backup first if you want to keep what is currently saved here.`,
        )
      ) {
        return
      }

      saveLeftlyBackup(parsed.backup)
      clearSetupDraft()
      reloadLocalStateFromStorage()
      setPayPeriodError('')
      setBillError('')
      setExpenseError('')
      setIncomeSuccess('')
      setBillSuccess('')
      setExpenseSuccess('')
      setBillStatus('')
      setDataMessage(`Backup imported from ${file.name}. Leftly restored the saved data from that backup.`)
    } finally {
      setIsImportingBackup(false)
    }
  }

  function resetDrafts(nextPreferences: LeftlyPreferences = preferences) {
    setPayPeriodDraft(getDraftFromPeriod(null, nextPreferences.defaultPayCadence))
    setBillDraft(getBlankBillDraft(nextPreferences.defaultCategory))
    setExpenseDraft(getBlankExpenseDraft(nextPreferences.defaultCategory))
    setPayPeriodError('')
    setBillError('')
    setExpenseError('')
    setIncomeSuccess('')
    setBillSuccess('')
    setExpenseSuccess('')
    setBillStatus('')
  }

  function handleSavePayPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPayPeriodError('')

    const income = Number(payPeriodDraft.income)

    if (!payPeriodDraft.startDate) {
      setPayPeriodError('Start date is required.')
      return
    }

    if (!payPeriodDraft.endDate) {
      setPayPeriodError('End date is required.')
      return
    }

    if (payPeriodDraft.endDate < payPeriodDraft.startDate) {
      setPayPeriodError('End date must be after the start date.')
      return
    }

    if (!Number.isFinite(income) || income <= 0) {
      setPayPeriodError('Income must be greater than 0.')
      return
    }

    const datesDifferFromActivePeriod = Boolean(
      payPeriod && (payPeriodDraft.startDate !== payPeriod.startDate || payPeriodDraft.endDate !== payPeriod.endDate),
    )
    if (datesDifferFromActivePeriod && !isCorrectingCurrentPeriodDates) {
      setPayPeriodError('These dates are different from your active pay period. Use Start new pay period to save the current period to History before beginning the next one.')
      return
    }

    const nextPeriod: BudgetPeriod = {
      cadence: payPeriodDraft.cadence,
      income,
      startDate: payPeriodDraft.startDate,
      endDate: payPeriodDraft.endDate,
    }

    setPayPeriod(nextPeriod)
    setPayPeriodDraft(getDraftFromPeriod(nextPeriod))
    setIsCorrectingCurrentPeriodDates(false)
    setIncomeSuccess(
      payPeriod
        ? isCorrectingCurrentPeriodDates
          ? 'Current pay period dates corrected. No History snapshot was created.'
          : 'Current pay period updated.'
        : 'First pay period started.',
    )
  }

  function handleAddBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBillError('')
    setBillSuccess('')

    const amount = Number(billDraft.amount)

    if (!billDraft.name.trim()) {
      setBillError('Bill name is required.')
      return
    }

    if (!billDraft.dueDate) {
      setBillError('Due date is required.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setBillError('Amount must be greater than 0.')
      return
    }

    setBills((current) => [
      {
        id: crypto.randomUUID(),
        name: billDraft.name.trim(),
        amount,
        dueDate: billDraft.dueDate,
        isPaid: false,
        paidDate: null,
        category: billDraft.category,
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ])

    setBillDraft({
      name: '',
      amount: '',
      dueDate: '',
      category: billDraft.category,
    })
    setBillSuccess('Bill added.')
    setActiveTab('bill')
  }

  function addExpenseFromDraft(draft: ExpenseDraft) {
    const amount = Number(draft.amount)

    if (!draft.name.trim()) {
      setExpenseError('Expense name is required.')
      return false
    }

    if (!draft.date) {
      setExpenseError('Date is required.')
      return false
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('Amount must be greater than 0.')
      return false
    }

    setExpenses((current) => [
      {
        id: crypto.randomUUID(),
        name: draft.name.trim(),
        amount,
        date: draft.date,
        category: draft.category,
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ])

    return true
  }

  function resetExpenseDraft(nextCategory: BudgetCategory = expenseDraft.category) {
    setExpenseDraft({
      name: '',
      amount: '',
      date: '',
      category: nextCategory,
    })
  }

  function openQuickAddExpense() {
    if (!payPeriod) {
      return
    }

    overlayTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedHistoryId(null)
    setActiveOverlay('quick-add')
    setExpenseError('')
    setExpenseSuccess('')
    setExpenseDraft((current) => ({
      ...current,
      date: getQuickAddDateValue(preferences, payPeriod),
    }))
  }

  function openMoreMenu() {
    overlayTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedHistoryId(null)
    setActiveOverlay('more')
  }

  function openHistorySnapshot(id: string) {
    overlayTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedHistoryId(id)
    setActiveOverlay('history-detail')
  }

  function closeHistorySnapshot(restoreFocus = true) {
    setActiveOverlay(null)
    setSelectedHistoryId(null)
    if (restoreFocus) {
      window.setTimeout(() => overlayTriggerRef.current?.focus(), 0)
    }
  }

  function useHistorySnapshotAsStartingPoint(snapshot: PayPeriodSnapshot) {
    closeHistorySnapshot(false)
    setHistoryStartSnapshot(snapshot)
  }

  function openMoreScreen(key: MoreMenuKey) {
    setActiveOverlay(null)
    setActiveTab(key)
  }

  function handlePreferencesChange(nextPreferences: LeftlyPreferences) {
    setPreferences(nextPreferences)

    if (!payPeriod) {
      setPayPeriodDraft((current) => ({ ...current, cadence: nextPreferences.defaultPayCadence }))
    }

    setBillDraft((current) =>
      current.name || current.amount || current.dueDate || current.category === nextPreferences.defaultCategory
        ? current
        : { ...current, category: nextPreferences.defaultCategory },
    )
    setExpenseDraft((current) =>
      current.name || current.amount || current.date || current.category === nextPreferences.defaultCategory
        ? current
        : { ...current, category: nextPreferences.defaultCategory },
    )
  }

  function syncCategoryInDrafts(fromCategory: BudgetCategory, toCategory: BudgetCategory) {
    setBillDraft((current) => (current.category === fromCategory ? { ...current, category: toCategory } : current))
    setExpenseDraft((current) => (current.category === fromCategory ? { ...current, category: toCategory } : current))
    setEditingItem((current) => {
      if (!current || current.item.category !== fromCategory) {
        return current
      }

      return {
        ...current,
        item: {
          ...current.item,
          category: toCategory,
        },
      } as EditTarget
    })
    setExpandedCategories((current) => {
      if (!current.has(fromCategory)) {
        return current
      }

      const next = new Set(current)
      next.delete(fromCategory)
      next.add(toCategory)
      return next
    })
  }

  function handleCreateCustomCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCategoryError('')
    setCategoryStatus('')

    const validation = validateCategoryName({
      value: newCustomCategoryName,
      existingCategories: allCategories,
    })
    if (!validation.ok) {
      setCategoryError(validation.error)
      return
    }

    const nextCustomCategories = [...customCategories, validation.value]
    setCustomCategories(nextCustomCategories)
    setCategoryOrder((current) => reconcileCategoryOrder([...current, validation.value], nextCustomCategories))
    setExpandedCategories((current) => new Set([...current, validation.value]))
    setNewCustomCategoryName('')
    setCategoryStatus(`Category created: ${validation.value}.`)
  }

  function startRenamingCategory(category: BudgetCategory) {
    setRenamingCategory(category)
    setRenameCategoryDraft(category)
    setCategoryError('')
    setCategoryStatus('')
  }

  function cancelRenamingCategory() {
    setRenamingCategory(null)
    setRenameCategoryDraft('')
    setCategoryError('')
  }

  function handleRenameCustomCategory(category: BudgetCategory) {
    const validation = validateCategoryName({
      value: renameCategoryDraft,
      existingCategories: allCategories,
      excludeName: category,
    })
    if (!validation.ok) {
      setCategoryError(validation.error)
      return
    }

    const setupDraft = payPeriod ? null : loadRawSetupDraft(payPeriod)
    const result = replaceCategoryAcrossData(
      {
        bills,
        expenses,
        recurringTemplates,
        payPeriodHistory,
        categoryTargets,
        preferences,
        categoryOrder: resolvedCategoryOrder,
        customCategories,
        setupDraft,
      },
      category,
      validation.value,
    )

    const nextCustomCategories = result.customCategories.filter((value) => !isBuiltInCategory(value))
    const nextCategoryOrder = reconcileCategoryOrder(result.categoryOrder, nextCustomCategories)
    const nextPayPeriodHistory = updateTargetKeysAcrossHistorySnapshots(result.payPeriodHistory, category, validation.value)
    const nextCategoryTargets = renameCategoryTargetKey(categoryTargets, category, validation.value)

    setBills(result.bills)
    setExpenses(result.expenses)
    setRecurringTemplates(result.recurringTemplates)
    setPayPeriodHistory(nextPayPeriodHistory)
    setPreferences(result.preferences)
    setCustomCategories(nextCustomCategories)
    setCategoryOrder(nextCategoryOrder)
    setCategoryTargets(nextCategoryTargets)
    if (result.setupDraft !== null) {
      saveSetupDraft(result.setupDraft)
    }
    syncCategoryInDrafts(category, validation.value)
    setRenamingCategory(null)
    setRenameCategoryDraft('')
    setCategoryError('')
    setCategoryStatus(`Category renamed to ${validation.value}.`)
  }

  function startDeletingCategory(category: BudgetCategory) {
    const fallbackReplacement = allCategories.find((value) => value !== category) ?? FALLBACK_CATEGORY
    setDeletingCategory(category)
    setDeleteReplacementCategory(fallbackReplacement)
    setCategoryError('')
    setCategoryStatus('')
  }

  function cancelDeletingCategory() {
    setDeletingCategory(null)
    setDeleteReplacementCategory(FALLBACK_CATEGORY)
    setCategoryError('')
  }

  function handleDeleteCustomCategory() {
    if (!deletingCategory) {
      return
    }

    const summary = deleteCategorySummary
    const currentReferenceCount = summary?.currentReferenceCount ?? 0
    const historicalReferenceCount = summary?.historicalReferenceCount ?? 0
    const activeTargetCount = summary?.activeTargetCount ?? 0
    const historicalTargetSnapshotCount = summary?.historicalTargetSnapshotCount ?? 0
    const requiresReplacement = summary?.requiresReplacement ?? false

    if (requiresReplacement) {
      if (!deleteReplacementCategory || deleteReplacementCategory === deletingCategory) {
        setCategoryError('Choose a replacement category before deleting this one.')
        return
      }

      const setupDraft = payPeriod ? null : loadRawSetupDraft(payPeriod)
      const result = replaceCategoryAcrossData(
        {
          bills,
          expenses,
          recurringTemplates,
          payPeriodHistory,
          categoryTargets,
          preferences,
          categoryOrder: resolvedCategoryOrder,
          customCategories,
          setupDraft,
        },
        deletingCategory,
        deleteReplacementCategory,
      )

      const nextCustomCategories = removeCategoryFromCustomList(result.customCategories, deletingCategory)
      const nextCategoryOrder = reconcileCategoryOrder(
        result.categoryOrder.filter((category) => category !== deletingCategory),
        nextCustomCategories,
      )
      const nextPayPeriodHistory = removeTargetKeyAcrossHistorySnapshots(result.payPeriodHistory, deletingCategory)
      const nextCategoryTargets = removeCategoryTargetKey(categoryTargets, deletingCategory)

      setBills(result.bills)
      setExpenses(result.expenses)
      setRecurringTemplates(result.recurringTemplates)
      setPayPeriodHistory(nextPayPeriodHistory)
      setPreferences(result.preferences)
      setCustomCategories(nextCustomCategories)
      setCategoryOrder(nextCategoryOrder)
      setCategoryTargets(nextCategoryTargets)
      if (result.setupDraft !== null) {
        saveSetupDraft(result.setupDraft)
      }
      syncCategoryInDrafts(deletingCategory, deleteReplacementCategory)
      setExpandedCategories((current) => {
        const next = new Set(current)
        next.delete(deletingCategory)
        return next
      })
      setDeletingCategory(null)
      setDeleteReplacementCategory(FALLBACK_CATEGORY)
      setCategoryError('')
      setCategoryStatus(
        `Category deleted. Reassigned ${currentReferenceCount} current item(s) and ${historicalReferenceCount} historical item(s). Removed ${activeTargetCount} active target and ${historicalTargetSnapshotCount} historical target record${historicalTargetSnapshotCount === 1 ? '' : 's'}.`,
      )
      return
    }

    if (
      !window.confirm(
        `Delete custom category "${deletingCategory}"? This cannot be undone.\n\nActive targets removed: ${activeTargetCount}\nHistorical target records removed: ${historicalTargetSnapshotCount}\n\nTargets are removed, not transferred to another category.`,
      )
    ) {
      return
    }

    const nextCustomCategories = removeCategoryFromCustomList(customCategories, deletingCategory)
    const nextAllCategories = getAllCategories(nextCustomCategories)
    const nextPayPeriodHistory = removeTargetKeyAcrossHistorySnapshots(payPeriodHistory, deletingCategory)
    const nextCategoryTargets = removeCategoryTargetKey(categoryTargets, deletingCategory)
    setCustomCategories(nextCustomCategories)
    setCategoryOrder((current) => reconcileCategoryOrder(current.filter((category) => category !== deletingCategory), nextCustomCategories))
    setPayPeriodHistory(nextPayPeriodHistory)
    setCategoryTargets(nextCategoryTargets)
    syncCategoryInDrafts(deletingCategory, deleteReplacementCategory)
    setExpandedCategories((current) => {
      const next = new Set(current)
      next.delete(deletingCategory)
      return next.size > 0 ? next : new Set([nextAllCategories[0] ?? FALLBACK_CATEGORY])
    })
    setDeletingCategory(null)
    setDeleteReplacementCategory(FALLBACK_CATEGORY)
    setCategoryError('')
    setCategoryStatus(
      `Category deleted: ${deletingCategory}. Removed ${activeTargetCount} active target and ${historicalTargetSnapshotCount} historical target record${historicalTargetSnapshotCount === 1 ? '' : 's'}.`,
    )
  }

  function reloadLocalStateFromStorage() {
    const nextPayPeriod = loadActiveBudgetPeriod()
    const nextBills = loadBills()
    const nextExpenses = loadExpenses()
    const nextRecurringTemplates = loadRecurringTemplates()
    const nextHistory = loadPayPeriodHistory()
    const nextCustomCategories = loadCustomCategories()
    const nextCategoryOrder = loadCategoryOrder(nextCustomCategories)
    const nextCategoryOrderMode = loadCategoryOrderMode()
    const nextCategoryTargets = loadCategoryTargets()
    const nextSortMode = loadSortMode()
    const nextPreferences = loadPreferences()

    setPayPeriod(nextPayPeriod)
    setBills(nextBills)
    setExpenses(nextExpenses)
    setRecurringTemplates(nextRecurringTemplates)
    setPayPeriodHistory(nextHistory)
    setPreferences(nextPreferences)
    setCustomCategories(nextCustomCategories)
    setCategoryOrder(nextCategoryOrder)
    setCategoryOrderMode(nextCategoryOrderMode)
    setCategoryTargets(nextCategoryTargets)
    setSortMode(nextSortMode)
    setExpandedCategories(getExpandedCategoriesFromItems(nextBills, nextExpenses, getAllCategories(nextCustomCategories)))
    resetDrafts(nextPreferences)
    setPayPeriodDraft(getDraftFromPeriod(nextPayPeriod, nextPreferences.defaultPayCadence))
    setActiveTab('overview')
    setIsStartNewPayPeriodOpen(false)
    setHistoryStartSnapshot(null)
    setSelectedHistoryId(null)
    setEditingItem(null)
    setCategoryStatus('')
    setCategoryError('')
    setNewCustomCategoryName('')
    setRenamingCategory(null)
    setRenameCategoryDraft('')
    setDeletingCategory(null)
    setDeleteReplacementCategory(FALLBACK_CATEGORY)
    setTargetEditingCategory(null)
    setTargetDraft('')
    clearCurrentPeriodSearchAndFilter()
  }

  function closeQuickAddExpense() {
    setExpenseError('')
    setExpenseSuccess('')
    setActiveOverlay(null)
    window.setTimeout(() => {
      overlayTriggerRef.current?.focus()
    }, 0)
  }

  function applyQuickAddRecentExpense(expense: Expense) {
    setExpenseError('')
    setExpenseSuccess('')
    setExpenseDraft({
      name: expense.name,
      amount: String(expense.amount),
      category: expense.category,
      date: getQuickAddDateValue(preferences, payPeriod),
    })
  }

  function applyQuickAddCategory(category: BudgetCategory) {
    setExpenseDraft((current) => ({
      ...current,
      category,
    }))
  }

  function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setExpenseError('')
    setExpenseSuccess('')

    if (!addExpenseFromDraft(expenseDraft)) {
      return
    }

    resetExpenseDraft(expenseDraft.category)
    setExpenseSuccess('Expense added.')
    setActiveTab('expense')
  }

  function handleQuickAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setExpenseError('')
    setExpenseSuccess('')

    if (!addExpenseFromDraft(expenseDraft)) {
      return
    }

    setExpenseDraft({
      name: '',
      amount: '',
      category: expenseDraft.category,
      date: getQuickAddDateValue(preferences, payPeriod),
    })
    setExpenseSuccess('Added to this pay period.')
  }

  function toggleBillPaid(id: string) {
    let nextPaidState = false
    setBills((current) =>
      current.map((bill) => {
        if (bill.id !== id) {
          return bill
        }

        const isPaid = !bill.isPaid
        nextPaidState = isPaid
        return {
          ...bill,
          isPaid,
          paidDate: isPaid ? new Date().toISOString().slice(0, 10) : null,
        }
      }),
    )
    setBillStatus(nextPaidState ? 'Bill marked paid.' : 'Bill marked unpaid.')
  }

  function addRecurringTemplate(template: RecurringItemTemplate) {
    setRecurringTemplates((current) => [template, ...current])
  }

  function updateRecurringTemplate(template: RecurringItemTemplate) {
    setRecurringTemplates((current) => current.map((item) => (item.id === template.id ? template : item)))
  }

  function deleteRecurringTemplate(id: string) {
    setRecurringTemplates((current) => current.filter((template) => template.id !== id))
  }

  function archiveActivePayPeriod() {
    if (!payPeriod) {
      return true
    }

    const hasData = payPeriod.income > 0 || bills.length > 0 || expenses.length > 0
    if (!hasData && !window.confirm('This pay period is empty. Archive it anyway?')) {
      return false
    }

    const snapshot = createPayPeriodSnapshot(payPeriod, bills, expenses, categoryTargets)
    if (!addPayPeriodSnapshot(snapshot)) {
      setPayPeriodError('Leftly could not save the current pay period to History. Your active pay period was not changed.')
      setIncomeSuccess('')
      return false
    }
    setPayPeriodHistory((current) => [snapshot, ...current])
    return true
  }

  function openStartNewPayPeriod(initialDraft?: typeof startNewPayPeriodInitialDraft) {
    setActiveTab('income')
    setStartNewPayPeriodInitialDraft(initialDraft ?? null)
    setIsStartNewPayPeriodOpen(true)
  }

  function handleStartNewPayPeriod(
    period: BudgetPeriod,
    options: { generateRecurring: boolean; carryoverBills: Bill[]; carryCategoryTargets: boolean },
  ) {
    if (!archiveActivePayPeriod()) {
      return false
    }

    const sourcePeriodKey = payPeriod ? getRecurringPeriodKey(payPeriod) : ''
    const periodKey = getRecurringPeriodKey(period)
    const manualBills = bills.filter((bill) => bill.source !== 'recurring')
    const nextExpenses: Expense[] = []
    const carriedBills = options.carryoverBills.map((bill) => cloneBillForCarryover(bill, sourcePeriodKey))
    let mergedBills: Bill[]

    if (options.generateRecurring) {
      const generated = generateRecurringItems({
        templates: recurringTemplates,
        period,
        existingBills: manualBills.filter((bill) => bill.source !== 'recurring' || bill.generatedForPeriodId !== periodKey),
        existingExpenses: nextExpenses,
      })

      const generatedRecurringBills = generated.bills.slice(manualBills.length)
      mergedBills = mergeBillsForNewPeriod([...manualBills, ...carriedBills], generatedRecurringBills)
      setBills(mergedBills)
      setExpenses(generated.expenses)
      setRecurringTemplates(generated.templates)
    } else {
      mergedBills = mergeBillsForNewPeriod(manualBills, carriedBills)
      setBills(mergedBills)
      setExpenses(nextExpenses)
    }

    const carriedOverCount = mergedBills.filter((bill) => bill.carriedOverFromPayPeriodId === sourcePeriodKey).length

    setPayPeriod(period)
    setCategoryTargets(options.carryCategoryTargets ? categoryTargets : {})
    setIsStartNewPayPeriodOpen(false)
    setStartNewPayPeriodInitialDraft(null)
    setIsCorrectingCurrentPeriodDates(false)
    setSelectedHistoryId(null)
    setEditingItem(null)
    setActiveTab('income')
    const successParts = ['New pay period started. The previous period was saved to History.']
    if (period.rolloverAmount && period.rolloverAmount > 0) {
      successParts.push(`Rollover applied: ${formatCurrency(period.rolloverAmount)}.`)
    }
    if (carriedOverCount > 0) {
      successParts.push(`Carried over ${carriedOverCount} unpaid bill${carriedOverCount === 1 ? '' : 's'}.`)
    }
    setIncomeSuccess(successParts.join(' '))
    return true
  }

  function handleStartFromHistory(result: {
    period: BudgetPeriod
    bills: Bill[]
    expenses: Expense[]
    categoryTargets: CategoryTargets
    copyManualExpenses: boolean
  }) {
    if (!archiveActivePayPeriod()) {
      return false
    }

    setPayPeriod(result.period)
    setPayPeriodDraft(getDraftFromPeriod(result.period))
    setBills(result.bills)
    setExpenses(result.expenses)
    setCategoryTargets(result.categoryTargets)
    setHistoryStartSnapshot(null)
    setSelectedHistoryId(null)
    setIsStartNewPayPeriodOpen(false)
    setEditingItem(null)
    setActiveTab('overview')
    return true
  }

  function loadDemoData() {
    if (
      !window.confirm(
        'Load demo data on this device? Demo data adds a sample pay period, bills, and expenses so you can explore Leftly. It replaces the current data saved in this browser. Export a backup first if you may want to restore your current data later.',
      )
    ) {
      return
    }

    const today = new Date()
    const startDate = formatIsoDate(today)
    const endDate = formatIsoDate(addDays(today, 13))
    const nextPayPeriod: BudgetPeriod = {
      cadence: 'biweekly',
      income: 3200,
      startDate,
      endDate,
    }

    const rentTemplateId = crypto.randomUUID()
    const groceriesTemplateId = crypto.randomUUID()
    const gasTemplateId = crypto.randomUUID()
    const phoneTemplateId = crypto.randomUUID()

    const nextRecurringTemplates: RecurringItemTemplate[] = [
      {
        id: rentTemplateId,
        name: 'Rent',
        amount: 1200,
        category: 'Housing',
        kind: 'bill',
        planName: MAIN_BILL_PLAN,
        frequency: 'monthly',
        dueDay: 1,
        setAsideEnabled: true,
        setAsideAmount: 600,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: groceriesTemplateId,
        name: 'Groceries',
        amount: 200,
        category: 'Food',
        kind: 'planned-expense',
        planName: MAIN_BILL_PLAN,
        frequency: 'every-pay-period',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: gasTemplateId,
        name: 'Gas',
        amount: 80,
        category: 'Transportation',
        kind: 'planned-expense',
        planName: MAIN_BILL_PLAN,
        frequency: 'every-pay-period',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: phoneTemplateId,
        name: 'Phone',
        amount: 85,
        category: 'Utilities',
        kind: 'bill',
        planName: MAIN_BILL_PLAN,
        frequency: 'monthly',
        dueDay: 12,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ]

    const periodKey = getRecurringPeriodKey(nextPayPeriod)
    const nextBills: Bill[] = [
      {
        id: crypto.randomUUID(),
        name: 'Rent',
        amount: 1200,
        dueDate: startDate,
        isPaid: false,
        paidDate: null,
        category: 'Housing',
        source: 'recurring',
        templateId: rentTemplateId,
        generatedForPeriodId: periodKey,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Phone',
        amount: 85,
        dueDate: endDate,
        isPaid: false,
        paidDate: null,
        category: 'Utilities',
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Internet',
        amount: 75,
        dueDate: formatIsoDate(addDays(today, 4)),
        isPaid: true,
        paidDate: startDate,
        category: 'Utilities',
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Car insurance',
        amount: 145,
        dueDate: formatIsoDate(addDays(today, 7)),
        isPaid: false,
        paidDate: null,
        category: 'Insurance',
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Netflix',
        amount: 15.99,
        dueDate: formatIsoDate(addDays(today, 9)),
        isPaid: true,
        paidDate: formatIsoDate(addDays(today, 1)),
        category: 'Subscriptions',
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Credit card payment',
        amount: 125,
        dueDate: formatIsoDate(addDays(today, 11)),
        isPaid: false,
        paidDate: null,
        category: 'Debt',
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
    ]

    const nextExpenses: Expense[] = [
      {
        id: crypto.randomUUID(),
        name: 'Groceries',
        amount: 185,
        date: startDate,
        category: 'Food',
        isPlanned: true,
        source: 'recurring',
        templateId: groceriesTemplateId,
        generatedForPeriodId: periodKey,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Gas',
        amount: 60,
        date: formatIsoDate(addDays(today, 2)),
        category: 'Transportation',
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Lunch',
        amount: 18.5,
        date: formatIsoDate(addDays(today, 3)),
        category: 'Food',
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Walmart',
        amount: 42.75,
        date: formatIsoDate(addDays(today, 5)),
        category: 'Personal',
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Rent set-aside',
        amount: 600,
        date: startDate,
        category: 'Housing',
        isPlanned: true,
        source: 'recurring',
        setAsideForTemplateId: rentTemplateId,
        generatedForPeriodId: periodKey,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Phone',
        amount: 85,
        date: endDate,
        category: 'Utilities',
        isPlanned: true,
        source: 'recurring',
        templateId: phoneTemplateId,
        generatedForPeriodId: periodKey,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: 'Gas reserve',
        amount: 80,
        date: startDate,
        category: 'Transportation',
        isPlanned: true,
        source: 'recurring',
        templateId: gasTemplateId,
        generatedForPeriodId: periodKey,
        createdAt: new Date().toISOString(),
      },
    ]

    const firstHistoryPeriod: BudgetPeriod = {
      cadence: 'biweekly',
      income: 3100,
      startDate: formatIsoDate(addDays(today, -28)),
      endDate: formatIsoDate(addDays(today, -15)),
    }

    const secondHistoryPeriod: BudgetPeriod = {
      cadence: 'biweekly',
      income: 3250,
      startDate: formatIsoDate(addDays(today, -14)),
      endDate: formatIsoDate(addDays(today, -1)),
    }

    const firstHistoryBills = [
      cloneBillForDemo({
        id: crypto.randomUUID(),
        name: 'Rent',
        amount: 1200,
        dueDate: firstHistoryPeriod.startDate,
        isPaid: true,
        paidDate: firstHistoryPeriod.startDate,
        category: 'Housing',
        source: 'recurring',
        templateId: rentTemplateId,
        generatedForPeriodId: getRecurringPeriodKey(firstHistoryPeriod),
        createdAt: new Date().toISOString(),
      }),
      cloneBillForDemo({
        id: crypto.randomUUID(),
        name: 'Phone',
        amount: 85,
        dueDate: firstHistoryPeriod.endDate,
        isPaid: false,
        paidDate: null,
        category: 'Utilities',
        source: 'manual',
        createdAt: new Date().toISOString(),
      }),
    ]

    const firstHistoryExpenses = [
      cloneExpenseForDemo({
        id: crypto.randomUUID(),
        name: 'Groceries',
        amount: 175,
        date: firstHistoryPeriod.startDate,
        category: 'Food',
        isPlanned: true,
        source: 'recurring',
        templateId: groceriesTemplateId,
        generatedForPeriodId: getRecurringPeriodKey(firstHistoryPeriod),
        createdAt: new Date().toISOString(),
      }),
      cloneExpenseForDemo({
        id: crypto.randomUUID(),
        name: 'Gas',
        amount: 54.2,
        date: formatIsoDate(addDays(today, -23)),
        category: 'Transportation',
        source: 'manual',
        createdAt: new Date().toISOString(),
      }),
    ]

    const secondHistoryBills = [
      cloneBillForDemo({
        id: crypto.randomUUID(),
        name: 'Rent',
        amount: 1200,
        dueDate: secondHistoryPeriod.startDate,
        isPaid: true,
        paidDate: secondHistoryPeriod.startDate,
        category: 'Housing',
        source: 'recurring',
        templateId: rentTemplateId,
        generatedForPeriodId: getRecurringPeriodKey(secondHistoryPeriod),
        createdAt: new Date().toISOString(),
      }),
      cloneBillForDemo({
        id: crypto.randomUUID(),
        name: 'Netflix',
        amount: 15.99,
        dueDate: secondHistoryPeriod.endDate,
        isPaid: true,
        paidDate: formatIsoDate(addDays(today, -8)),
        category: 'Subscriptions',
        source: 'manual',
        createdAt: new Date().toISOString(),
      }),
    ]

    const secondHistoryExpenses = [
      cloneExpenseForDemo({
        id: crypto.randomUUID(),
        name: 'Groceries',
        amount: 190,
        date: secondHistoryPeriod.startDate,
        category: 'Food',
        isPlanned: true,
        source: 'recurring',
        templateId: groceriesTemplateId,
        generatedForPeriodId: getRecurringPeriodKey(secondHistoryPeriod),
        createdAt: new Date().toISOString(),
      }),
      cloneExpenseForDemo({
        id: crypto.randomUUID(),
        name: 'Lunch',
        amount: 16.8,
        date: formatIsoDate(addDays(today, -10)),
        category: 'Food',
        source: 'manual',
        createdAt: new Date().toISOString(),
      }),
    ]

    const nextHistory = [
      buildDemoHistorySnapshot({
        label: formatHistoryPeriodLabel(secondHistoryPeriod.startDate, secondHistoryPeriod.endDate),
        period: secondHistoryPeriod,
        bills: secondHistoryBills,
        expenses: secondHistoryExpenses,
      }),
      buildDemoHistorySnapshot({
        label: formatHistoryPeriodLabel(firstHistoryPeriod.startDate, firstHistoryPeriod.endDate),
        period: firstHistoryPeriod,
        bills: firstHistoryBills,
        expenses: firstHistoryExpenses,
      }),
    ]

    setPayPeriod(nextPayPeriod)
    setPayPeriodDraft(getDraftFromPeriod(nextPayPeriod))
    setBills(nextBills)
    setExpenses(nextExpenses)
    setRecurringTemplates(nextRecurringTemplates)
    setPayPeriodHistory(nextHistory)
    setCategoryTargets({})
    setPreferences({ ...DEFAULT_PREFERENCES })
    setCustomCategories([])
    setExpandedCategories(getExpandedCategoriesFromItems(nextBills, nextExpenses, [...DEFAULT_CATEGORIES]))
    setSortMode('amount-desc')
    setCategoryOrderMode('total-desc')
    setCategoryOrder([...DEFAULT_CATEGORIES])
    setActiveTab('overview')
    setIncomeSuccess('Demo income loaded.')
    setBillSuccess('Demo bills loaded.')
    setExpenseSuccess('Demo expenses loaded.')
    setBillStatus('')
    setPayPeriodError('')
    setBillError('')
    setExpenseError('')
    setIsStartNewPayPeriodOpen(false)
    setHistoryStartSnapshot(null)
    setSelectedHistoryId(null)
    setEditingItem(null)
    clearCurrentPeriodSearchAndFilter()
    setDataMessage('Demo data loaded.')
    setDataError('')
    setIsSetupOpen(false)
    resetDrafts(DEFAULT_PREFERENCES)
    setPayPeriodDraft(getDraftFromPeriod(nextPayPeriod, DEFAULT_PREFERENCES.defaultPayCadence))
  }

  function deleteBill(id: string) {
    setBills((current) => current.filter((bill) => bill.id !== id))
  }

  function deleteExpense(id: string) {
    setExpenses((current) => current.filter((expense) => expense.id !== id))
  }

  function startEditBill(bill: Bill) {
    setEditingItem({ kind: 'bill', item: bill })
  }

  function startEditExpense(expense: Expense) {
    setEditingItem({ kind: 'expense', item: expense })
  }

  function saveEditedBill(updatedBill: Bill) {
    setBills((current) => current.map((bill) => (bill.id === updatedBill.id ? updatedBill : bill)))
  }

  function saveEditedExpense(updatedExpense: Expense) {
    setExpenses((current) => current.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense)))
  }

  function deleteHistorySnapshot(id: string) {
    if (!window.confirm('Delete this archived pay period from History? You can\'t undo this.')) {
      return
    }

    deletePayPeriodSnapshot(id)
    setPayPeriodHistory((current) => current.filter((snapshot) => snapshot.id !== id))
    if (selectedHistoryId === id) {
      setActiveOverlay(null)
      setSelectedHistoryId(null)
    }
  }

  function handleReset() {
    if (
      !window.confirm(
        'Reset all Leftly data on this device? This clears the saved Leftly data in this browser. Export a backup first if you may want to restore it later.',
      )
    ) {
      return
    }

    clearAllAppData()
    setPreferences({ ...DEFAULT_PREFERENCES })
    setPayPeriod(null)
    setBills([])
    setExpenses([])
    setRecurringTemplates([])
    setPayPeriodHistory([])
    setCategoryTargets({})
    setCustomCategories([])
    setSortMode('amount-desc')
    setCategoryOrderMode('total-desc')
    setCategoryOrder([...DEFAULT_CATEGORIES])
    setExpandedCategories(new Set([DEFAULT_CATEGORIES[0]]))
    setActiveTab('overview')
    setIsSetupOpen(false)
    setIsStartNewPayPeriodOpen(false)
    setHistoryStartSnapshot(null)
    setSelectedHistoryId(null)
    setEditingItem(null)
    clearCurrentPeriodSearchAndFilter()
    setDataMessage('')
    setDataError('')
    setSetupSuccess('')
    resetDrafts(DEFAULT_PREFERENCES)
  }

  function toggleCategory(category: BudgetCategory) {
    setExpandedCategories((current) => {
      const next = new Set(current)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  function moveCategory(category: BudgetCategory, direction: -1 | 1) {
    setCategoryOrderMode('custom')
    setCategoryOrder((current) => {
      const next = [...current]
      const currentIndex = next.indexOf(category)
      if (currentIndex === -1) {
        return current
      }

      const targetIndex = currentIndex + direction
      if (targetIndex < 0 || targetIndex >= next.length) {
        return current
      }

      const [moved] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  function startEditingCategoryTarget(category: BudgetCategory) {
    setTargetEditingCategory(category)
    setTargetDraft(categoryTargets[category] !== undefined ? categoryTargets[category].toFixed(2) : '')
    setCategoryError('')
    setCategoryStatus('')
  }

  function cancelEditingCategoryTarget() {
    setTargetEditingCategory(null)
    setTargetDraft('')
    setCategoryError('')
  }

  function saveCategoryTarget(category: BudgetCategory) {
    const trimmed = targetDraft.trim()
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setCategoryError('Target must be a nonnegative currency amount with up to two decimal places.')
      return
    }

    const amount = Number(trimmed)
    if (!Number.isFinite(amount) || amount < 0) {
      setCategoryError('Target must be a valid nonnegative amount.')
      return
    }

    setCategoryTargets((current) => ({ ...current, [category]: Math.round(amount * 100) / 100 }))
    setTargetEditingCategory(null)
    setTargetDraft('')
    setCategoryError('')
    setCategoryStatus(`Target saved for ${category}.`)
  }

  function removeCategoryTarget(category: BudgetCategory) {
    setCategoryTargets((current) => {
      if (current[category] === undefined) {
        return current
      }

      const next = { ...current }
      delete next[category]
      return next
    })
    setTargetEditingCategory(null)
    setTargetDraft('')
    setCategoryError('')
    setCategoryStatus(`Target removed for ${category}.`)
  }

  function clearCurrentPeriodSearchAndFilter() {
    setCurrentPeriodSearch('')
    setCurrentPeriodFilter('all')
  }

  const hasAnyData =
    payPeriod !== null ||
    bills.length > 0 ||
    expenses.length > 0 ||
    recurringTemplates.length > 0 ||
    payPeriodHistory.length > 0 ||
    customCategories.length > 0 ||
    sortMode !== 'amount-desc' ||
    categoryOrderMode !== 'total-desc' ||
    Object.keys(categoryTargets).length > 0 ||
    resolvedCategoryOrder.length !== allCategories.length ||
    resolvedCategoryOrder.some((category, index) => category !== allCategories[index]) ||
    preferences.defaultPayCadence !== DEFAULT_PREFERENCES.defaultPayCadence ||
    preferences.defaultCategory !== DEFAULT_PREFERENCES.defaultCategory ||
    preferences.quickAddDateBehavior !== DEFAULT_PREFERENCES.quickAddDateBehavior
  const isTrueEmptyNewUserState = !hasAnyData
  const isFirstRun = isTrueEmptyNewUserState
  const isOverviewTab = activeTab === 'overview'
  const quickAddOverlayId = 'leftly-quick-add-overlay'
  const moreOverlayId = 'leftly-more-overlay'

  const quickAddOverlayContent = payPeriod ? (
    <div className="grid gap-4">
      {recentManualExpenses.length > 0 ? (
        <div className="leftly-panel-section">
          <div className="grid gap-1">
            <p className="leftly-panel-label">Repeat recent</p>
            <p className="leftly-panel-copy">Tap a recent manual expense to prefill the form.</p>
          </div>

          <div className="grid gap-2">
            {recentManualExpenses.slice(0, 3).map((expense) => (
              <button
                key={expense.id}
                type="button"
                onClick={() => applyQuickAddRecentExpense(expense)}
                className="leftly-quick-action"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{expense.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    {expense.category} · {expense.date}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-white">{formatCurrency(expense.amount)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form className="grid gap-4 leftly-shell p-4 sm:p-5" onSubmit={handleQuickAddExpense}>
        <div className="leftly-panel-section">
          <div className="grid gap-1">
            <p className="leftly-panel-label">Quick expense</p>
            <p className="leftly-panel-copy">Name, amount, category, then add it to this pay period.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Badge muted>{quickAddDateBehaviorLabels[preferences.quickAddDateBehavior]}</Badge>
            <span>
              {payPeriod.startDate} to {payPeriod.endDate}
            </span>
            <span>Default: {preferences.defaultCategory}</span>
          </div>

          {quickAddCategorySuggestions.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Category shortcuts</p>
              <div className="flex flex-wrap gap-2">
                {quickAddCategorySuggestions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => applyQuickAddCategory(category)}
                    aria-pressed={expenseDraft.category === category}
                    className={`leftly-chip-button ${expenseDraft.category === category ? 'leftly-chip-button-active' : ''}`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                ref={quickAddNameInputRef}
                value={expenseDraft.name}
                onChange={(event) =>
                  setExpenseDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Groceries"
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={expenseDraft.amount}
                onChange={(event) =>
                  setExpenseDraft((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                placeholder="48.25"
              />
            </Field>
            <Field label="Category">
              <select
                value={expenseDraft.category}
                onChange={(event) =>
                  setExpenseDraft((current) => ({
                    ...current,
                    category: event.target.value as BudgetCategory,
                  }))
                }
              >
                {allCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={expenseDraft.date}
                onChange={(event) =>
                  setExpenseDraft((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
        </div>

        {expenseError ? <FormMessage>{expenseError}</FormMessage> : null}
        {expenseSuccess ? (
          <div className="leftly-success-inline" role="status">
            {expenseSuccess}
          </div>
        ) : null}

        <div className="leftly-action-grid">
          <button type="button" onClick={closeQuickAddExpense} className="button-secondary w-full sm:w-auto">
            Back
          </button>
          <button type="submit" className="button-primary w-full sm:w-auto">
            Add expense
          </button>
        </div>
      </form>
    </div>
  ) : (
    <div className="grid gap-4">
      <EmptyState
        title="Start a pay period first"
        text="Run setup first, or set income and pay period in Income, so Quick Add knows where this spending belongs."
      />
      <div className="leftly-action-grid">
        <button type="button" onClick={() => setActiveTab('income')} className="button-primary w-full sm:w-auto">
          Go to Income
        </button>
      </div>
    </div>
  )

  const moreOverlayContent = (
    <div className="grid gap-3">
      {moreMenuItems.map((item, index) => (
        <button
          key={item.key}
          ref={index === 0 ? moreFirstItemRef : undefined}
          type="button"
          onClick={() => openMoreScreen(item.key)}
          className="leftly-more-menu-card"
        >
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-[-0.02em] text-white">{item.label}</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">{item.helper}</p>
          </div>
          <span className="mt-0.5 shrink-0 text-slate-500">›</span>
        </button>
      ))}
    </div>
  )

  return (
    <main className="leftly-page">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-950/80 to-transparent" />

      <div
        ref={mainContentRef}
        className={`relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 pb-32 sm:px-6 sm:pb-6 lg:px-8 ${
          isFirstRun ? 'py-2.5 sm:py-4 lg:py-5' : isOverviewTab ? 'py-3 sm:py-5 lg:py-6' : 'py-2.5 sm:py-4 lg:py-5'
        }`}
      >
        {isOverviewTab ? (
          isFirstRun ? (
            <header className="leftly-page-header">
              <div className="leftly-shell-soft grid gap-3 p-3 sm:gap-4 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="leftly-chip leftly-chip-default w-fit px-3 py-1 text-[10px] sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.24em]">
                      Manual budget tracker
                    </p>
                    <h1 className="mt-3 text-[1.65rem] font-semibold tracking-[-0.04em] text-white sm:text-5xl">Leftly</h1>
                    <p className="mt-1 text-sm leading-6 text-slate-300 sm:text-lg">Set up your first paycheck and see what is left.</p>
                  </div>
                  <span className="leftly-chip leftly-chip-muted shrink-0 px-2.5 py-1 text-[9px] tracking-[0.16em]">
                    Local only
                  </span>
                </div>
                <p className="max-w-2xl text-[11px] leading-5 text-slate-400 sm:text-sm sm:leading-6">
                  Track a single pay period, your bills, and your spending without connecting a bank.
                </p>
              </div>
            </header>
          ) : (
            <header className="leftly-page-header">
              <div className="flex flex-col gap-4 sm:items-center sm:text-center">
                <div className="flex flex-col gap-4 sm:items-center">
                  <div className="flex flex-col gap-3 sm:items-center">
                    <p className="leftly-chip leftly-chip-default w-fit px-3 py-1 text-[10px] sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.24em]">
                      Manual budget tracker
                    </p>
                    <div className="space-y-1 sm:space-y-2">
                      <h1 className="text-[2.15rem] font-semibold tracking-[-0.04em] text-white sm:text-6xl">Leftly</h1>
                      <p className="text-[0.98rem] text-slate-300 sm:text-2xl">Know what&apos;s left.</p>
                    </div>
                  </div>

                  <div className="leftly-shell-soft grid gap-2 px-3 py-3 text-left sm:max-w-md sm:grid-cols-2 sm:gap-3 sm:px-4 sm:text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Active screen</p>
                      <p className="mt-1 text-sm font-semibold text-white">{activeScreenLabel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Storage</p>
                      <p className="mt-1 text-sm font-semibold text-white">Local only</p>
                    </div>
                  </div>
                </div>

                <p className="max-w-2xl text-[11px] leading-5 text-slate-400 sm:text-sm sm:leading-6">
                  Track a single pay period, your bills, and your spending without connecting a bank.
                </p>
              </div>
            </header>
          )
        ) : (
          <header className="px-1 pb-2 pt-1 sm:px-1 sm:pb-3 sm:pt-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.95rem] font-semibold tracking-[-0.02em] text-white sm:text-base">Leftly</p>
              <span className="leftly-chip leftly-chip-muted px-2 py-0.5 text-[9px] tracking-[0.18em]">Local only</span>
            </div>
          </header>
        )}

        <div className="mt-4 hidden flex-col gap-3 sm:mt-5 sm:gap-3 md:flex">
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
            <div className="flex min-w-max flex-nowrap gap-2 sm:min-w-0 sm:flex-wrap">
            {tabLabels.map((tab) => (
              <TabButton
                key={tab.key}
                label={tab.label}
                active={tab.key === 'quick-add' ? activeOverlay === 'quick-add' : tab.key === 'more' ? activeOverlay === 'more' : activeTab === tab.key}
                disabled={tab.key === 'quick-add' && !payPeriod}
                onClick={() => {
                  if (tab.key === 'quick-add') {
                    openQuickAddExpense()
                    return
                  }

                  if (tab.key === 'more') {
                    openMoreMenu()
                    return
                  }

                  setActiveTab(tab.key)
                }}
              />
            ))}
            </div>
          </div>

        </div>

        <section className={`mx-auto w-full max-w-5xl ${isFirstRun ? 'mt-2 sm:mt-3' : 'mt-4 sm:mt-5'}`}>
          <div className={`leftly-screen-stage leftly-screen-stage-${screenTransitionPhase}`}>
          {activeTab === 'overview' ? (
            <SectionShell
              title="Overview"
              description="A snapshot of the current pay period and recent activity."
              compact={isFirstRun}
            >
              {setupSuccess ? (
                <div className="leftly-banner-success mb-4">
                  {setupSuccess}
                </div>
              ) : null}

              {isFirstRun ? (
                isSetupOpen ? (
                  <SetupFlowPanel
                    defaultPayCadence={preferences.defaultPayCadence}
                    categories={allCategories}
                    activeBudgetPeriod={payPeriod}
                    onClose={() => setIsSetupOpen(false)}
                    onFinish={handleFinishSetup}
                  />
                ) : (
                  <LandingScreen
                    onStartBudgetingLocally={openSetup}
                    onRestoreFromBackup={() => landingBackupInputRef.current?.click()}
                    onOpenCloudBackup={
                      cloudConfig.enabled && cloudConfig.mode === 'ready'
                        ? () => setActiveTab('data')
                        : undefined
                    }
                    showCloudBackupAction={cloudConfig.enabled && cloudConfig.mode === 'ready'}
                  />
                )
              ) : hasAnyData ? (
                <div className="leftly-overview-dashboard">
                  <div className="lg:col-span-2">
                    <FinancialPulseHero
                      payPeriod={payPeriod}
                      totals={totals}
                      billPaymentSummary={billPaymentSummary}
                      formatCurrency={formatCurrency}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <div className="leftly-overview-section">
                      <OverviewSectionHeader
                        title="Quick actions"
                        description="Keep the next move close: add spending, pull in saved bills, or start the next pay period."
                        aside={!payPeriod ? <p className="text-xs leading-5 text-slate-500">Start a pay period to unlock bill and expense actions.</p> : undefined}
                      />

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <OverviewActionCard
                          eyebrow="Fastest"
                          title="Quick Add"
                          helper="Log spending in a few taps."
                          onClick={openQuickAddExpense}
                          disabled={!payPeriod}
                          tone="accent"
                          wide
                        />
                        <OverviewActionCard
                          eyebrow={payPeriod && hasActiveBillPlanItems ? 'Saved items' : 'Bill Plan'}
                          title={payPeriod && hasActiveBillPlanItems ? 'Apply Bill Plan' : 'Open Bill Plan'}
                          helper={payPeriod && hasActiveBillPlanItems ? 'Bring in recurring bills and set-asides.' : 'Manage saved repeating bills.'}
                          onClick={payPeriod && hasActiveBillPlanItems ? openBillPlanApply : () => setActiveTab('recurring')}
                        />
                        <OverviewActionCard
                          eyebrow="One-time"
                          title="One-time Bill"
                          helper="Add a bill for just this period."
                          onClick={() => payPeriod && setActiveTab('bill')}
                          disabled={!payPeriod}
                        />
                        <OverviewActionCard
                          eyebrow="Manual"
                          title="Manual Expense"
                          helper="Open the full expense screen."
                          onClick={() => payPeriod && setActiveTab('expense')}
                          disabled={!payPeriod}
                        />
                        {payPeriod ? (
                          <OverviewActionCard
                            eyebrow="Next paycheck"
                            title="Start New Pay Period"
                            helper="Archive this one and carry forward what matters."
                            onClick={openStartNewPayPeriod}
                            wide
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="leftly-overview-section">
                      <OverviewSectionHeader
                        title="Due Soon"
                        description="Unpaid bills that need attention in the next 7 days."
                        aside={
                          payPeriod && dueSoonBills.length > 0 ? (
                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                              <span className="leftly-chip border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-rose-100">
                                {dueSoonBills.filter((item) => item.status === 'Overdue').length} overdue
                              </span>
                              <span className="leftly-chip border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-100">
                                {dueSoonBills.filter((item) => item.status === 'Due today').length} today
                              </span>
                              <span className="leftly-chip border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                                {dueSoonBills.filter((item) => item.status === 'Due in next 7 days').length} soon
                              </span>
                            </div>
                          ) : undefined
                        }
                      />

                      {payPeriod ? (
                        dueSoonBills.length > 0 ? (
                          <>
                            <div className="mt-3 grid gap-2">
                              {dueSoonBills.slice(0, 3).map(({ bill, status, statusTone, dueDateLabel, scheduleLabel, planName }) => (
                                <OverviewListRow
                                  key={bill.id}
                                  title={bill.name}
                                  badges={
                                    <>
                                      <Badge muted>Unpaid</Badge>
                                      {bill.carriedOverFromPayPeriodId ? <Badge muted>Carried over</Badge> : null}
                                      {planName ? <Badge muted>{planName}</Badge> : null}
                                      {scheduleLabel ? <Badge muted>{scheduleLabel}</Badge> : null}
                                      <DueSoonStatusBadge status={status} tone={statusTone} />
                                    </>
                                  }
                                  meta={
                                    <>
                                      {bill.category} · due {dueDateLabel}
                                    </>
                                  }
                                  amount={formatCurrency(bill.amount)}
                                  actions={
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => toggleBillPaid(bill.id)}
                                        className="leftly-overview-inline-button"
                                      >
                                        Mark paid
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startEditBill(bill)}
                                        className="leftly-overview-inline-button"
                                      >
                                        Edit
                                      </button>
                                    </>
                                  }
                                />
                              ))}
                            </div>

                            {dueSoonBills.length > 3 ? (
                              <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                                <p>+{dueSoonBills.length - 3} more unpaid bills</p>
                                <button type="button" onClick={() => setActiveTab('bill')} className="button-secondary w-full sm:w-auto">
                                  View all bills in One-time Bill
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <EmptyState title="No bills due soon" text="Add a one-time bill or apply Bill Plan when something is coming up next." compact />
                        )
                      ) : (
                        <EmptyState title="No active pay period" text="Start a pay period to see what bills are coming up next." compact />
                      )}
                    </div>
                  </div>

                  <BillPaymentProgress summary={billPaymentSummary} formatCurrency={formatCurrency} />

                  <div className="lg:col-span-2">
                    <PaycheckAllocation totals={totals} formatCurrency={formatCurrency} />
                  </div>

                  <div className={overviewCategoryTargets.length > 0 ? undefined : 'lg:col-span-2'}>
                    <div className="leftly-overview-section">
                      <OverviewSectionHeader
                        title="Spending Snapshot"
                        description="Active expenses in this pay period, grouped by category."
                        aside={
                          payPeriod && spendingSnapshot.length > 0 ? (
                            <p className="text-xs leading-5 text-slate-500">
                              {spendingSnapshotCategoryCount} {spendingSnapshotCategoryCount === 1 ? 'category' : 'categories'} tracked
                            </p>
                          ) : undefined
                        }
                      />

                      {payPeriod ? (
                        spendingSnapshot.length > 0 ? (
                          <>
                            <div className="mt-3 grid gap-2">
                              {spendingSnapshot.map((row) => {
                                const share = spendingSnapshotTotal > 0 ? Math.max(6, (row.total / spendingSnapshotTotal) * 100) : 0

                                return (
                                  <div key={row.category} className="leftly-spending-row">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-white">{row.category}</p>
                                        <p className="mt-1 text-[11px] text-slate-400">
                                          {formatCurrency(row.total)} · {row.count} item{row.count === 1 ? '' : 's'}
                                        </p>
                                      </div>
                                      <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(row.total)}</p>
                                    </div>

                                    <div
                                      className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800/80"
                                      role="progressbar"
                                      aria-label={`${row.category} spending share`}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                      aria-valuenow={Math.round(Math.min(100, share))}
                                    >
                                      <div
                                        className="leftly-progress-fill leftly-progress-cyan"
                                        style={{ width: `${share}%` }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {spendingSnapshotCategoryCount > spendingSnapshot.length ? (
                              <p className="mt-3 text-xs text-slate-500">+{spendingSnapshotCategoryCount - spendingSnapshot.length} more categories</p>
                            ) : null}

                            {topCategories.length > 0 ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                {topCategories.map((summary, index) => (
                                  <div key={summary.category} className="leftly-shell-soft px-3 py-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium text-white">{summary.category}</p>
                                      {index === 0 ? <Badge>Highest cost</Badge> : null}
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                      {formatCurrency(summary.total)} · {summary.items.length} item{summary.items.length === 1 ? '' : 's'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <EmptyState title="No spending yet" text="Use Quick Add or Manual Expense when you start logging spending." compact />
                        )
                      ) : (
                        <EmptyState title="No active pay period" text="Start a pay period to track spending by category." compact />
                      )}
                    </div>
                  </div>

                  {overviewCategoryTargets.length > 0 ? (
                    <div>
                      <div className="leftly-overview-section">
                        <OverviewSectionHeader
                          title="Category targets"
                          description="Planning targets for active expense categories this pay period."
                          aside={
                            <button type="button" onClick={() => setActiveTab('categories')} className="button-secondary w-full sm:w-auto">
                              View all
                            </button>
                          }
                        />

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {overviewCategoryTargets.map((progress) => (
                            <TargetProgressCard
                              key={progress.category}
                              progress={progress}
                              formatCurrency={formatCurrency}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {payPeriod ? (
                    <div className="lg:col-span-2">
                      <PayPeriodCalendar
                        key={`${payPeriod.startDate}:${payPeriod.endDate}`}
                        payPeriod={payPeriod}
                        bills={bills}
                        expenses={expenses}
                        recurringTemplates={recurringTemplates}
                        onEditBill={startEditBill}
                        onEditExpense={startEditExpense}
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
                    <div className="leftly-overview-section">
                      <OverviewSectionHeader title="Recent bills" description="Latest bills in this pay period, with quick paid and edit actions." />
                      <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                        {recentBills.length > 0 ? (
                          recentBills.map((bill) => {
                            const template = bill.templateId ? recurringTemplateById.get(bill.templateId) : undefined

                            return (
                              <OverviewListRow
                                key={bill.id}
                                title={bill.name}
                                badges={
                                  <>
                                    <Badge muted>{bill.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                                    {template ? <Badge muted>{normalizeRecurringPlanName(template.planName)}</Badge> : null}
                                    {template ? <Badge muted>{formatPlanSchedule(template)}</Badge> : null}
                                    {isCarriedOverBill(bill) ? <Badge muted>Carried over</Badge> : null}
                                  </>
                                }
                                meta={
                                  <>
                                    {bill.category} · due {bill.dueDate}
                                  </>
                                }
                                amount={formatCurrency(bill.amount)}
                                actions={
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => toggleBillPaid(bill.id)}
                                      className="leftly-overview-inline-button"
                                    >
                                      {bill.isPaid ? 'Mark unpaid' : 'Mark paid'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEditBill(bill)}
                                      className="leftly-overview-inline-button"
                                    >
                                      Edit
                                    </button>
                                  </>
                                }
                              />
                            )
                          })
                        ) : (
                          <EmptyState title="No bills yet" text="Add a one-time bill or apply Bill Plan to populate this list." compact />
                        )}
                      </div>
                      {bills.length > 3 ? (
                        <div className="mt-3">
                          <button type="button" onClick={() => setActiveTab('bill')} className="button-secondary w-full sm:w-auto">
                            View all bills in One-time Bill
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="leftly-overview-section">
                      <OverviewSectionHeader title="Recent expenses" description="Latest expenses in this pay period, using the same compact card treatment." />
                      <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                        {recentExpenses.length > 0 ? (
                          recentExpenses.map((expense) => {
                            const template = expense.templateId ? recurringTemplateById.get(expense.templateId) : undefined

                            return (
                              <OverviewListRow
                                key={expense.id}
                                title={expense.name}
                                badges={
                                  <>
                                    {expense.source === 'recurring' ? (
                                      <Badge muted={Boolean(expense.setAsideForTemplateId)}>
                                        {expense.setAsideForTemplateId ? 'Set-aside' : expense.isPlanned ? 'Planned spending' : 'Bill Plan'}
                                      </Badge>
                                    ) : null}
                                    {template ? <Badge muted>{normalizeRecurringPlanName(template.planName)}</Badge> : null}
                                  </>
                                }
                                meta={
                                  <>
                                    {expense.category} · {expense.date}
                                    {template && !expense.setAsideForTemplateId ? ` · ${formatPlanSchedule(template)}` : ''}
                                  </>
                                }
                                amount={formatCurrency(expense.amount)}
                                actions={
                                  <button type="button" onClick={() => startEditExpense(expense)} className="leftly-overview-inline-button">
                                    Edit
                                  </button>
                                }
                              />
                            )
                          })
                        ) : (
                          <EmptyState title="No expenses yet" text="Use Quick Add or Manual Expense to start tracking spending in this pay period." compact />
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div className="leftly-overview-section">
                        <OverviewSectionHeader
                          title="Upcoming from your Bill Plan"
                          description="Saved items that are active but not yet in this pay period."
                          aside={
                            payPeriod && hasActiveBillPlanItems ? (
                              <button type="button" onClick={openBillPlanApply} className="button-secondary w-full sm:w-auto sm:min-w-0 sm:px-3 sm:py-2.5 sm:text-xs">
                                Review Bill Plan items
                              </button>
                            ) : undefined
                          }
                        />
                        <div className="mt-3 space-y-2">
                          {upcomingRecurringBills.length > 0 ? (
                            upcomingRecurringBills.slice(0, 2).map((template) => (
                              <OverviewListRow
                                key={template.id}
                                title={template.name}
                                badges={
                                  <>
                                    <Badge muted>{normalizeRecurringPlanName(template.planName)}</Badge>
                                    <Badge muted>{formatPlanSchedule(template)}</Badge>
                                    {template.setAsideEnabled ? <Badge muted>Set-aside active</Badge> : null}
                                  </>
                                }
                                meta={
                                  <>
                                    {template.category}
                                  </>
                                }
                                amount={formatCurrency(template.amount)}
                              />
                            ))
                          ) : (
                            <EmptyState
                              title="Nothing waiting"
                              text="Add regular bills to Bill Plan and Leftly will surface them here before you apply them."
                              compact
                            />
                          )}
                        </div>
                        {upcomingRecurringBills.length > 2 ? (
                          <p className="mt-2 text-xs text-slate-500">+{upcomingRecurringBills.length - 2} more in Bill Plan</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                  <EmptyState
                    title="No budget data yet"
                    text="Start setup to set income and your pay period, then add regular bills in Bill Plan and log spending with Quick Add."
                  />
              )}
            </SectionShell>
          ) : null}

          {activeTab === 'income' ? (
            <SectionShell title="Income" description="Keep today’s pay period clear, then use the next-period wizard when it is time to roll over.">
              <MoreBackBar onBack={openMoreMenu} />

              {isStartNewPayPeriodOpen ? (
                <StartNewPayPeriodPanel
                  currentPayPeriod={payPeriod}
                  currentReview={currentPayPeriodReview}
                  templates={recurringTemplates}
                  categoryTargetCount={Object.keys(categoryTargets).length}
                  isOpen={isStartNewPayPeriodOpen}
                  defaultPayCadence={preferences.defaultPayCadence}
                  initialDraft={startNewPayPeriodInitialDraft ?? undefined}
                  onClose={() => {
                    setIsStartNewPayPeriodOpen(false)
                    setStartNewPayPeriodInitialDraft(null)
                  }}
                  onSubmit={handleStartNewPayPeriod}
                />
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
                <form className="grid gap-4 leftly-shell p-4 sm:p-5" onSubmit={handleSavePayPeriod}>
                  <div className="leftly-panel-section">
                    <div className="grid gap-1">
                      <p className="leftly-panel-label">Current pay period</p>
                      <p className="leftly-panel-copy">
                        {payPeriod ? 'This is the period Leftly is tracking now. Income can be edited; cadence and dates stay locked unless you deliberately correct a mistake.' : 'Create your first pay period so Leftly knows which paycheck to track.'}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Cadence">
                        <select disabled={Boolean(payPeriod)} value={payPeriodDraft.cadence} onChange={(event) => setPayPeriodDraft((current) => ({ ...current, cadence: event.target.value as PayCadence }))}>
                          {cadenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Income amount">
                        <input type="number" min="0" step="0.01" value={payPeriodDraft.income} onChange={(event) => setPayPeriodDraft((current) => ({ ...current, income: event.target.value }))} placeholder="3200" />
                      </Field>
                      <Field label="Start date">
                        <input disabled={Boolean(payPeriod) && !isCorrectingCurrentPeriodDates} type="date" value={payPeriodDraft.startDate} onChange={(event) => setPayPeriodDraft((current) => ({ ...current, startDate: event.target.value }))} />
                      </Field>
                      <Field label="End date">
                        <input disabled={Boolean(payPeriod) && !isCorrectingCurrentPeriodDates} type="date" value={payPeriodDraft.endDate} onChange={(event) => setPayPeriodDraft((current) => ({ ...current, endDate: event.target.value }))} />
                      </Field>
                    </div>
                  </div>

                  {payPeriod && !isCorrectingCurrentPeriodDates ? (
                    <div className="leftly-shell-soft grid gap-3 p-4">
                      <div><p className="leftly-panel-label">Need to fix a mistake?</p><p className="mt-1 text-sm leading-6 text-slate-400">Correct the current period in place. This does not create a History snapshot.</p></div>
                      <button type="button" onClick={() => { setIsCorrectingCurrentPeriodDates(true); setPayPeriodError('') }} className="button-secondary w-full sm:w-auto sm:justify-self-start">Correct current period dates</button>
                    </div>
                  ) : null}

                  {payPeriod && isCorrectingCurrentPeriodDates ? (
                    <div className="leftly-banner-warning grid gap-3">
                      <p>This edits the current period in place. It does not create a History snapshot and should only be used to correct a mistake.</p>
                      <button type="button" onClick={() => { setIsCorrectingCurrentPeriodDates(false); setPayPeriodDraft(getDraftFromPeriod(payPeriod)); setPayPeriodError('') }} className="button-secondary w-full sm:w-auto sm:justify-self-start">Cancel date correction</button>
                    </div>
                  ) : null}

                  {payPeriodError ? <FormMessage>{payPeriodError}</FormMessage> : null}
                  {incomeSuccess ? <SuccessMessage>{incomeSuccess}</SuccessMessage> : null}
                  <div className="leftly-sheet-footer"><div className="leftly-action-grid"><button type="submit" className="button-secondary w-full sm:w-auto">{payPeriod ? (isCorrectingCurrentPeriodDates ? 'Apply date correction' : 'Update current period') : 'Start first pay period'}</button></div></div>
                </form>

                <section className="leftly-shell leftly-shell-accent flex flex-col p-4 sm:p-5">
                  <div className="grid gap-1"><p className="leftly-panel-label">Next pay period</p><h3 className="text-xl font-semibold text-white">Ready for the next paycheck?</h3><p className="leftly-panel-copy">Starting the next period saves the current period to History. The wizard handles rollover, unpaid-bill carryover, Bill Plan generation, and category-target carryover.</p></div>
                  <div className="mt-5 flex-1" />
                  <button type="button" onClick={() => openStartNewPayPeriod(payPeriodDraft)} className="button-primary w-full">{payPeriod ? 'Start next pay period' : 'Start first pay period'}</button>
                  {payPeriod ? <p className="mt-2 text-xs leading-5 text-slate-400">This is the primary action for moving to a new pay period. It creates exactly one History snapshot before rollover.</p> : <p className="mt-2 text-xs leading-5 text-slate-400">Your first period will be created without a History snapshot.</p>}
                </section>
              </div>
            </SectionShell>
          ) : null}

          {activeTab === 'bill' ? (
            <SectionShell title="One-time Bill" description="Review and manage unusual bills that belong only to the current pay period.">
              <MoreBackBar onBack={openMoreMenu} />
              <div className="grid gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-slate-400">
                    Use this screen for unusual charges that belong only to the current pay period.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {payPeriod ? <Badge muted>{payPeriod.startDate} to {payPeriod.endDate}</Badge> : <Badge muted>No active pay period</Badge>}
                    <Badge muted>{oneTimeBills.length} bill{oneTimeBills.length === 1 ? '' : 's'}</Badge>
                    {oneTimeBills.length > 0 ? <Badge muted>{formatCurrency(oneTimeBillSummary.totalAmount)}</Badge> : null}
                    <button type="button" onClick={() => setActiveTab('recurring')} className="button-secondary w-full sm:w-auto">
                      Open Bill Plan
                    </button>
                  </div>
                </div>

                <div className="leftly-shell-soft p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Existing one-time bills</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Review unusual bills for this pay period, then edit, delete, or mark them paid here.
                      </p>
                    </div>
                    {oneTimeBills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <Badge muted>{oneTimeBillSummary.unpaidCount} unpaid</Badge>
                        <Badge muted>{oneTimeBillSummary.paidCount} paid</Badge>
                      </div>
                    ) : null}
                  </div>

                  {billStatus ? (
                    <div className="mt-4">
                      <SuccessMessage>{billStatus}</SuccessMessage>
                    </div>
                  ) : null}

                  {oneTimeBills.length > 0 ? (
                    <div className="mt-4 grid gap-2.5">
                      {oneTimeBills.map((bill) => (
                        <div key={bill.id} className="leftly-compact-list-card">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{bill.name}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-400">
                                  Due {formatCompactDateLabel(bill.dueDate)} · {bill.category}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(bill.amount)}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={`leftly-chip px-3 py-1 text-xs font-medium ${bill.isPaid ? 'leftly-chip-success' : 'leftly-chip-warning'}`}>
                              {bill.isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                            {bill.paidDate ? <Badge muted>Paid {formatCompactDateLabel(bill.paidDate)}</Badge> : null}
                            {isCarriedOverBill(bill) ? <Badge muted>Carried over</Badge> : null}
                          </div>

                          <div className="leftly-compact-actions">
                            <button
                              type="button"
                              onClick={() => toggleBillPaid(bill.id)}
                              className="button-secondary col-span-2 w-full sm:w-auto"
                            >
                              {bill.isPaid ? 'Mark unpaid' : 'Mark paid'}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditBill(bill)}
                              className="button-secondary w-full sm:w-auto"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBill(bill.id)}
                              className="button-secondary w-full sm:w-auto"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <EmptyState title="No one-time bills yet" text="Add an unusual bill for this pay period. Keep regular monthly bills in Bill Plan." compact />
                    </div>
                  )}
                </div>

                <form className="grid gap-4 leftly-shell p-4 sm:p-5" onSubmit={handleAddBill}>
                  <div className="grid gap-1">
                    <p className="leftly-panel-label">Add one-time bill</p>
                    <p className="leftly-panel-copy">Enter the bill details below to track a charge that does not belong in Bill Plan.</p>
                  </div>

                  <div className="leftly-form-grid">
                    <div className="leftly-form-grid-full">
                      <Field label="Name">
                        <input
                          value={billDraft.name}
                          onChange={(event) => setBillDraft((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Car repair"
                        />
                      </Field>
                    </div>
                    <Field label="Amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={billDraft.amount}
                        onChange={(event) => setBillDraft((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="1200"
                      />
                    </Field>
                    <Field label="Due date">
                      <input
                        type="date"
                        value={billDraft.dueDate}
                        onChange={(event) => setBillDraft((current) => ({ ...current, dueDate: event.target.value }))}
                      />
                    </Field>
                    <div className="leftly-form-grid-full">
                      <Field label="Category">
                        <select
                          value={billDraft.category}
                          onChange={(event) =>
                            setBillDraft((current) => ({
                              ...current,
                              category: event.target.value as BudgetCategory,
                            }))
                          }
                        >
                          {allCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>

                  <div className="leftly-shell-faint p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Paid status</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      New one-time bills start unpaid. Mark them paid from the list above after the bill is handled.
                    </p>
                  </div>

                  {billError ? <FormMessage>{billError}</FormMessage> : null}
                  {billSuccess ? <SuccessMessage>{billSuccess}</SuccessMessage> : null}

                  <div className="leftly-action-grid">
                    <button type="button" onClick={openMoreMenu} className="button-secondary w-full sm:w-auto">
                      Back to More
                    </button>
                    <button type="submit" className="button-primary w-full sm:w-auto">
                      Save one-time bill
                    </button>
                  </div>
                </form>
              </div>
            </SectionShell>
          ) : null}

          {activeTab === 'expense' ? (
            <SectionShell title="Manual Expense" description="Review, edit, or add spending in the current pay period.">
              <MoreBackBar onBack={openMoreMenu} />
              <div className="grid gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-slate-400">
                    Quick Add stays the fastest way to log spending. Use this screen when you want to review, edit, or clean up entries.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {payPeriod ? <Badge muted>{payPeriod.startDate} to {payPeriod.endDate}</Badge> : <Badge muted>No active pay period</Badge>}
                    <Badge muted>{manualExpenses.length} item{manualExpenses.length === 1 ? '' : 's'}</Badge>
                    {manualExpenses.length > 0 ? <Badge muted>{formatCurrency(manualExpenseTotal)}</Badge> : null}
                    <button type="button" onClick={openQuickAddExpense} disabled={!payPeriod} className="button-secondary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50">
                      Open Quick Add
                    </button>
                  </div>
                </div>

                <div className="leftly-shell-soft p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Existing manual expenses</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Recent manual spending for this pay period appears here with quick edit and delete actions.
                      </p>
                    </div>
                    {manualExpenses.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <Badge muted>{manualExpenses.length} logged</Badge>
                        <Badge muted>{formatCurrency(manualExpenseTotal)} total</Badge>
                      </div>
                    ) : null}
                  </div>

                  {manualExpenses.length > 0 ? (
                    <div className="mt-4 grid gap-2.5">
                      {manualExpenses.map((expense) => (
                        <div
                          key={expense.id}
                          className="leftly-compact-list-card"
                        >
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{expense.name}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-400">
                                  {formatCompactDateLabel(expense.date)} · {expense.category}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(expense.amount)}</p>
                            </div>
                          </div>

                          <div className="leftly-compact-actions">
                            <button
                              type="button"
                              onClick={() => startEditExpense(expense)}
                              className="button-secondary w-full sm:w-auto"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExpense(expense.id)}
                              className="button-secondary w-full sm:w-auto"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <EmptyState
                        title="No manual expenses yet"
                        text="Use Quick Add for fast spending, or add one here when you want full details."
                        compact
                      />
                    </div>
                  )}
                </div>

                <form className="grid gap-4 leftly-shell p-4 sm:p-5" onSubmit={handleAddExpense}>
                  <div className="grid gap-1">
                    <p className="leftly-panel-label">Add manual expense</p>
                    <p className="leftly-panel-copy">Enter the spending details below to keep this pay period accurate.</p>
                  </div>

                  <div className="leftly-form-grid">
                    <div className="leftly-form-grid-full">
                      <Field label="Name">
                        <input
                          value={expenseDraft.name}
                          onChange={(event) =>
                            setExpenseDraft((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Groceries"
                        />
                      </Field>
                    </div>
                    <Field label="Amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={expenseDraft.amount}
                        onChange={(event) =>
                          setExpenseDraft((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        placeholder="48.25"
                      />
                    </Field>
                    <Field label="Date">
                      <input
                        type="date"
                        value={expenseDraft.date}
                        onChange={(event) =>
                          setExpenseDraft((current) => ({
                            ...current,
                            date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className="leftly-form-grid-full">
                      <Field label="Category">
                        <select
                          value={expenseDraft.category}
                          onChange={(event) =>
                            setExpenseDraft((current) => ({
                              ...current,
                              category: event.target.value as BudgetCategory,
                            }))
                          }
                        >
                          {allCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>

                  {expenseError ? <FormMessage>{expenseError}</FormMessage> : null}
                  {expenseSuccess ? <SuccessMessage>{expenseSuccess}</SuccessMessage> : null}

                  <div className="leftly-action-grid">
                    <button type="button" onClick={openMoreMenu} className="button-secondary w-full sm:w-auto">
                      Back to More
                    </button>
                    <button type="submit" className="button-primary w-full sm:w-auto">
                      Save manual expense
                    </button>
                  </div>
                </form>
              </div>
            </SectionShell>
          ) : null}

          {activeTab === 'categories' ? (
            <SectionShell title="Categories" description="See where bills and spending are grouped for this pay period.">
              <MoreBackBar onBack={openMoreMenu} />
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-slate-400">
                  Tap a category to expand its bills and expenses, then sort the list however you want.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge muted>{categorySummaries.filter((summary) => summary.total > 0).length} active</Badge>
                  <Badge muted>{categorySummaries.reduce((sum, summary) => sum + summary.billCount, 0)} bills</Badge>
                  <Badge muted>{categorySummaries.reduce((sum, summary) => sum + summary.expenseCount, 0)} expenses</Badge>
                </div>
              </div>

              <div className="mb-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Sort items">
                    <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Category order">
                    <select
                      value={categoryOrderMode}
                      onChange={(event) => setCategoryOrderMode(event.target.value as CategoryOrderMode)}
                    >
                      {categoryOrderOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="leftly-shell-soft grid gap-4 p-4">
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-white">Manage custom categories</p>
                    <p className="text-sm leading-6 text-slate-400">
                      Built-in categories stay locked for now. Custom categories appear everywhere Leftly lets you choose a category.
                    </p>
                  </div>

                  <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleCreateCustomCategory}>
                    <Field label="New custom category">
                      <input
                        value={newCustomCategoryName}
                        onChange={(event) => setNewCustomCategoryName(event.target.value)}
                        maxLength={40}
                        placeholder="Medical"
                      />
                    </Field>
                    <button type="submit" className="button-primary w-full self-end sm:w-auto">
                      Add category
                    </button>
                  </form>

                  {categoryError ? <FormMessage>{categoryError}</FormMessage> : null}
                  {categoryStatus ? <SuccessMessage>{categoryStatus}</SuccessMessage> : null}

                  {customCategories.length === 0 ? (
                    <EmptyState
                      title="No custom categories yet"
                      text="Create one here and it will show up in bills, expenses, Quick Add, Bill Plan, setup, and preferences."
                      compact
                    />
                  ) : (
                    <div className="grid gap-3">
                      {customCategories.map((category) => (
                        <div key={category} className="leftly-shell-faint grid gap-3 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">{category}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-400">
                                Custom category
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <button type="button" onClick={() => startRenamingCategory(category)} className="button-secondary w-full sm:w-auto">
                                Rename
                              </button>
                              <button type="button" onClick={() => startDeletingCategory(category)} className="button-secondary w-full sm:w-auto">
                                Delete
                              </button>
                            </div>
                          </div>

                          {renamingCategory === category ? (
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                              <Field label="Rename category">
                                <input
                                  value={renameCategoryDraft}
                                  onChange={(event) => setRenameCategoryDraft(event.target.value)}
                                  maxLength={40}
                                  autoFocus
                                />
                              </Field>
                              <button type="button" onClick={() => handleRenameCustomCategory(category)} className="button-primary w-full self-end sm:w-auto">
                                Save
                              </button>
                              <button type="button" onClick={cancelRenamingCategory} className="button-secondary w-full self-end sm:w-auto">
                                Cancel
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="leftly-shell-soft grid gap-3 p-4">
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-white">Built-in categories</p>
                    <p className="text-sm leading-6 text-slate-400">
                      These defaults cannot be renamed or deleted in this version, but they still participate in sorting and reassignment.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {DEFAULT_CATEGORIES.map((category) => (
                      <div key={category} className="leftly-shell-faint flex items-center justify-between gap-3 p-3">
                        <p className="text-sm font-medium text-white">{category}</p>
                        <Badge muted>Built-in</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {deletingCategory ? (
                <div className="mb-4 leftly-shell-soft grid gap-3 border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-white">Delete custom category</p>
                    <p className="text-sm leading-6 text-slate-300">
                      Delete <span className="font-semibold">{deletingCategory}</span>
                      {deleteCategorySummary?.requiresReplacement
                        ? ' and reassign everything it touches before removal.'
                        : ' directly because no bills, expenses, templates, preferences, setup data, or historical transactions reference it.'}
                    </p>
                    {deleteCategorySummary ? (
                      <p className="text-xs leading-5 text-amber-100/90">
                        {deleteCategorySummary.activeTargetCount > 0 ? 'Its active target will be removed.' : 'It has no active target.'}{' '}
                        {deleteCategorySummary.historicalTargetSnapshotCount > 0
                          ? `${deleteCategorySummary.historicalTargetSnapshotCount} history snapshot${deleteCategorySummary.historicalTargetSnapshotCount === 1 ? '' : 's'} will lose this target record.`
                          : 'No history snapshots contain this target.'}{' '}
                        Targets are removed, not transferred.
                      </p>
                    ) : null}
                  </div>

                  {deleteCategorySummary?.requiresReplacement && deleteCategoryCounts ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="leftly-data-stat">
                          <p className="leftly-data-stat-label">Current references</p>
                          <p className="leftly-data-stat-value">
                            {deleteCategorySummary.currentReferenceCount}
                          </p>
                        </div>
                        <div className="leftly-data-stat">
                          <p className="leftly-data-stat-label">Historical references</p>
                          <p className="leftly-data-stat-value">
                            {deleteCategorySummary.historicalReferenceCount}
                          </p>
                        </div>
                        <div className="leftly-data-stat">
                          <p className="leftly-data-stat-label">Active targets removed</p>
                          <p className="leftly-data-stat-value">{deleteCategorySummary.activeTargetCount}</p>
                        </div>
                        <div className="leftly-data-stat">
                          <p className="leftly-data-stat-label">History target records removed</p>
                          <p className="leftly-data-stat-value">{deleteCategorySummary.historicalTargetSnapshotCount}</p>
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs leading-5 text-slate-300 sm:grid-cols-2">
                        <p>Active bills: {deleteCategoryCounts.activeBills}</p>
                        <p>Active expenses: {deleteCategoryCounts.activeExpenses}</p>
                        <p>Bill Plan items: {deleteCategoryCounts.recurringTemplates}</p>
                        <p>Preferences / setup: {deleteCategoryCounts.preferences + deleteCategoryCounts.setupDraft}</p>
                        <p>History bills: {deleteCategoryCounts.historyBills}</p>
                        <p>History expenses: {deleteCategoryCounts.historyExpenses}</p>
                        <p>Active targets: {deleteCategorySummary.activeTargetCount}</p>
                        <p>History target records: {deleteCategorySummary.historicalTargetSnapshotCount}</p>
                      </div>
                      <p className="text-xs leading-5 text-slate-300">
                        Choose a replacement only for bills, expenses, templates, preferences, setup data, and historical transactions. Deleted targets will not transfer to {deleteReplacementCategory}.
                      </p>
                      <Field label="Replacement category">
                        <select
                          value={deleteReplacementCategory}
                          onChange={(event) => setDeleteReplacementCategory(event.target.value as BudgetCategory)}
                        >
                          {allCategories
                            .filter((category) => category !== deletingCategory)
                            .map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                        </select>
                      </Field>
                    </>
                  ) : null}

                  <div className="leftly-action-grid">
                    <button type="button" onClick={handleDeleteCustomCategory} className="button-primary w-full sm:w-auto">
                      Confirm delete
                    </button>
                    <button type="button" onClick={cancelDeletingCategory} className="button-secondary w-full sm:w-auto">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {bills.length === 0 && expenses.length === 0 ? (
                <div className="mb-4">
                  <EmptyState
                    title="No category items yet"
                    text="Set a pay period, add a bill, or log spending and Leftly will group it here."
                    compact
                  />
                </div>
              ) : null}

              {billStatus ? <SuccessMessage>{billStatus}</SuccessMessage> : null}

              {bills.length > 0 || expenses.length > 0 ? (
                <div className="mb-4 grid gap-3 rounded-[1.2rem] border border-slate-800/80 bg-slate-950/55 p-3 sm:p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <Field label="Search current-period items">
                      <input
                        type="search"
                        value={currentPeriodSearch}
                        onChange={(event) => setCurrentPeriodSearch(event.target.value)}
                        placeholder="Search by item or category"
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={clearCurrentPeriodSearchAndFilter}
                      className="button-secondary w-full lg:w-auto"
                    >
                      Clear search and filters
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {currentPeriodItemFilterOptions.map((option) => (
                      <TabButton
                        key={option.value}
                        label={option.label}
                        active={currentPeriodFilter === option.value}
                        onClick={() => setCurrentPeriodFilter(option.value)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3">
                {visibleCategorySummaries.length > 0 ? (
                  visibleCategorySummaries.map((summary) => (
                    <CategoryCard
                      key={summary.category}
                      summary={summary}
                      targetProgress={categoryTargetProgressByCategory.get(summary.category) ?? null}
                      targetEditing={targetEditingCategory === summary.category}
                      targetDraft={targetEditingCategory === summary.category ? targetDraft : ''}
                      rank={categoryRank.get(summary.category) ?? 0}
                      expanded={visibleExpandedCategories.has(summary.category)}
                      onToggle={() => toggleCategory(summary.category)}
                      onMoveUp={() => moveCategory(summary.category, -1)}
                      onMoveDown={() => moveCategory(summary.category, 1)}
                      onStartEditingTarget={() => startEditingCategoryTarget(summary.category)}
                      onTargetDraftChange={setTargetDraft}
                      onSaveTarget={() => saveCategoryTarget(summary.category)}
                      onRemoveTarget={() => removeCategoryTarget(summary.category)}
                      onCancelTargetEdit={cancelEditingCategoryTarget}
                      onDeleteBill={deleteBill}
                      onDeleteExpense={deleteExpense}
                      onToggleBillPaid={toggleBillPaid}
                      onEditBill={startEditBill}
                      onEditExpense={startEditExpense}
                      formatCurrency={formatCurrency}
                      canMoveUp={resolvedCategoryOrder.indexOf(summary.category) > 0}
                      canMoveDown={resolvedCategoryOrder.indexOf(summary.category) < resolvedCategoryOrder.length - 1}
                    />
                  ))
                ) : bills.length > 0 || expenses.length > 0 ? (
                  <EmptyState
                    title="No matching items"
                    text="Try a different search or filter, or clear both to show the full current pay period again."
                    compact
                  />
                ) : null}
              </div>
            </SectionShell>
          ) : null}

          {activeTab === 'recurring' ? (
            <SectionShell
              title="Bill Plan"
              description="Save recurring bills and planned items here. Apply them to a pay period when you need them."
            >
              {payPeriod && hasActiveBillPlanItems ? (
                <div className="mb-4 flex flex-col gap-3 rounded-[1.3rem] border border-cyan-400/15 bg-cyan-400/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">Apply saved items to this pay period</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Pull in recurring bills and planned spending without starting a new period.
                    </p>
                  </div>
                  <button type="button" onClick={openBillPlanApply} className="button-secondary w-full sm:w-auto">
                    Apply Bill Plan to this pay period
                  </button>
                </div>
              ) : null}
              {payPeriod ? (
                <div className="mb-4 leftly-shell-soft p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">Bills in this pay period from Bill Plan</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Mark generated Bill Plan bills paid here without changing your reserved totals or starting the next period.
                      </p>
                    </div>
                    {recurringBills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <Badge muted>{recurringBillSummary.unpaidCount} unpaid</Badge>
                        <Badge muted>{recurringBillSummary.paidCount} paid</Badge>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <BillPaymentSummaryBlock summary={recurringBillSummary} formatCurrency={formatCurrency} label="Bill Plan bills paid" />
                  </div>

                  {recurringBills.length > 0 ? (
                    <div className="mt-4 grid gap-2.5">
                      {recurringBills.map((bill) => (
                        <div
                          key={bill.id}
                          className={`leftly-compact-list-card ${bill.isPaid ? 'border-emerald-400/20 bg-emerald-400/5' : ''}`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-white">{bill.name}</p>
                                  <Badge muted>Bill Plan</Badge>
                                  <span
                                    className={`leftly-chip px-3 py-1 text-xs font-medium ${bill.isPaid ? 'leftly-chip-success' : 'leftly-chip-warning'}`}
                                  >
                                    {bill.isPaid ? 'Paid' : 'Unpaid'}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-slate-400">
                                  Due {formatCompactDateLabel(bill.dueDate)} · {bill.category}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(bill.amount)}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {bill.paidDate ? <Badge muted>Paid {formatCompactDateLabel(bill.paidDate)}</Badge> : null}
                            {isCarriedOverBill(bill) ? <Badge muted>Carried over</Badge> : null}
                          </div>

                          <div className="leftly-compact-actions">
                            <button
                              type="button"
                              onClick={() => toggleBillPaid(bill.id)}
                              className="button-secondary col-span-2 w-full sm:w-auto"
                            >
                              {bill.isPaid ? 'Mark unpaid' : 'Mark paid'}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditBill(bill)}
                              className="button-secondary w-full sm:w-auto"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBill(bill.id)}
                              className="button-secondary w-full sm:w-auto"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <EmptyState
                        title="No Bill Plan bills in this period"
                        text="Apply Bill Plan to this pay period to bring recurring bills here, then mark them paid as they are completed."
                        compact
                      />
                    </div>
                  )}
                </div>
              ) : null}
              {billPlanMessage ? (
                <div className="leftly-banner-success mb-4">
                  {billPlanMessage}
                </div>
              ) : null}
              <RecurringSection
                categories={allCategories}
                templates={recurringTemplates}
                onAddTemplate={addRecurringTemplate}
                onUpdateTemplate={updateRecurringTemplate}
                onDeleteTemplate={deleteRecurringTemplate}
              />
            </SectionShell>
          ) : null}

          {activeTab === 'history' ? (
            <SectionShell title="History" description="Review archived pay periods saved locally in this browser.">
              {historyStartSnapshot ? (
                <div className="mb-5">
                  <StartFromHistoryPanel
                    key={historyStartSnapshot.id}
                    snapshot={historyStartSnapshot}
                    isOpen={Boolean(historyStartSnapshot)}
                    onClose={() => setHistoryStartSnapshot(null)}
                    onSubmit={handleStartFromHistory}
                  />
                </div>
              ) : null}
              <HistorySection
                snapshots={payPeriodHistory}
                selectedSnapshot={null}
                onSelectSnapshot={openHistorySnapshot}
                onUseAsStartingPoint={useHistorySnapshotAsStartingPoint}
                onExportSnapshotCsv={exportHistorySnapshotCsv}
                onBackToList={() => closeHistorySnapshot()}
                onDeleteSnapshot={deleteHistorySnapshot}
                formatCurrency={formatCurrency}
              />
            </SectionShell>
          ) : null}

          {activeTab === 'data' ? (
            <SectionShell title="Data" description="Back up or restore the Leftly data stored only on this device.">
              <MoreBackBar onBack={openMoreMenu} />
              <DataSection
                backupSummary={backupSummary}
                categories={allCategories}
                preferences={preferences}
                onPreferencesChange={handlePreferencesChange}
                onLocalDataReloaded={reloadLocalStateFromStorage}
                onExport={exportBackup}
                onImportFile={importBackupFile}
                onExportCurrentPeriodCsv={exportCurrentPeriodCsv}
                onExportAllHistoryCsv={exportAllHistoryCsv}
                onLoadDemoData={loadDemoData}
                onReset={handleReset}
                statusMessage={dataMessage}
                errorMessage={dataError}
                isImporting={isImportingBackup}
              />
            </SectionShell>
          ) : null}

          {activeTab === 'help' ? (
            <SectionShell
              title="Help / About / Feedback"
              description="Start here for the beta tester guide, feedback template, and the basics on local-first Leftly data."
            >
              <MoreBackBar onBack={openMoreMenu} />
              <HelpAboutFeedbackSection />
            </SectionShell>
          ) : null}

          {editingItem ? (
            <EditItemPanel
              key={`${editingItem.kind}:${editingItem.item.id}`}
              target={editingItem}
              categories={allCategories}
              isOpen={Boolean(editingItem)}
              onClose={() => setEditingItem(null)}
              onSaveBill={saveEditedBill}
              onSaveExpense={saveEditedExpense}
            />
          ) : null}
          <ApplyBillPlanPanel
            activePayPeriod={payPeriod}
            templates={recurringTemplates}
            bills={bills}
            expenses={expenses}
            isOpen={isApplyBillPlanOpen}
            onClose={() => setIsApplyBillPlanOpen(false)}
            onApply={handleApplyBillPlan}
          />
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/80 bg-slate-950/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 shadow-[0_-20px_40px_rgba(2,6,23,0.35)] backdrop-blur md:hidden">
          <div className="mx-auto grid max-w-7xl grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                aria-label="Go to Overview"
                aria-pressed={activeBottomNavTab === 'overview'}
                className={`leftly-mobile-nav-button ${
                activeBottomNavTab === 'overview'
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-800/70 bg-slate-950/65 text-slate-400'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={openQuickAddExpense}
              disabled={!payPeriod}
              aria-label="Open Quick Add"
              aria-controls={quickAddOverlayId}
              aria-expanded={activeOverlay === 'quick-add'}
              aria-haspopup="dialog"
              aria-pressed={activeBottomNavTab === 'quick-add'}
              className={`leftly-mobile-nav-button disabled:cursor-not-allowed disabled:opacity-50 ${
                activeBottomNavTab === 'quick-add'
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-800/70 bg-slate-950/65 text-slate-400'
              }`}
            >
              Quick Add
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recurring')}
              aria-label="Go to Bill Plan"
              aria-pressed={activeBottomNavTab === 'recurring'}
              className={`leftly-mobile-nav-button ${
                activeBottomNavTab === 'recurring'
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-800/70 bg-slate-950/65 text-slate-400'
              }`}
            >
              Bill Plan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              aria-label="Go to History"
              aria-pressed={activeBottomNavTab === 'history'}
              className={`leftly-mobile-nav-button ${
                activeBottomNavTab === 'history'
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-800/70 bg-slate-950/65 text-slate-400'
              }`}
            >
              History
            </button>
            <button
              type="button"
              onClick={openMoreMenu}
              aria-label="Go to More"
              aria-controls={moreOverlayId}
              aria-expanded={activeOverlay === 'more'}
              aria-haspopup="dialog"
              aria-pressed={activeBottomNavTab === 'more'}
              className={`leftly-mobile-nav-button ${
                activeBottomNavTab === 'more'
                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-800/70 bg-slate-950/65 text-slate-400'
              }`}
            >
              More
            </button>
          </div>
        </div>
      </div>
      <AppOverlay
        id={quickAddOverlayId}
        isOpen={activeOverlay === 'quick-add'}
        title="Quick Add"
        description="Log everyday spending quickly in your current pay period."
        desktopPresentation="dialog"
        initialFocusRef={quickAddNameInputRef}
        closeLabel="Close Quick Add"
        onClose={closeQuickAddExpense}
      >
        {quickAddOverlayContent}
      </AppOverlay>
      <AppOverlay
        id={moreOverlayId}
        isOpen={activeOverlay === 'more'}
        title="More"
        description="Open the parts of Leftly that do not fit in the main navigation."
        desktopPresentation="drawer"
        initialFocusRef={moreFirstItemRef}
        closeLabel="Close More menu"
        onClose={() => {
          setActiveOverlay(null)
          window.setTimeout(() => {
            overlayTriggerRef.current?.focus()
          }, 0)
        }}
      >
        {moreOverlayContent}
      </AppOverlay>
      <AppOverlay
        id="leftly-history-detail-overlay"
        isOpen={activeOverlay === 'history-detail' && Boolean(selectedHistorySnapshot)}
        title={selectedHistorySnapshot?.label ?? 'Archived pay period'}
        description="Read-only details from this archived pay period."
        desktopPresentation="drawer"
        desktopSize="wide"
        closeLabel="Close history details"
        onClose={() => closeHistorySnapshot()}
      >
        {selectedHistorySnapshot ? (
          <HistorySection
            snapshots={payPeriodHistory}
            selectedSnapshot={selectedHistorySnapshot}
            onSelectSnapshot={openHistorySnapshot}
            onUseAsStartingPoint={useHistorySnapshotAsStartingPoint}
            onExportSnapshotCsv={exportHistorySnapshotCsv}
            onBackToList={() => closeHistorySnapshot()}
            onDeleteSnapshot={deleteHistorySnapshot}
            formatCurrency={formatCurrency}
          />
        ) : null}
      </AppOverlay>
      <input
        ref={landingBackupInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          importBackupFile(event.target.files?.[0] ?? null)
          event.currentTarget.value = ''
        }}
      />
    </main>
  )
}

function sortItems(items: BudgetItem[], sortMode: SortMode) {
  return [...items].sort((a, b) => {
    if (sortMode === 'amount-desc') {
      return b.amount - a.amount || a.name.localeCompare(b.name)
    }

    if (sortMode === 'amount-asc') {
      return a.amount - b.amount || a.name.localeCompare(b.name)
    }

    if (sortMode === 'date') {
      const aDate = a.kind === 'bill' ? a.dueDate ?? '' : a.date ?? ''
      const bDate = b.kind === 'bill' ? b.dueDate ?? '' : b.date ?? ''
      return aDate.localeCompare(bDate) || a.name.localeCompare(b.name)
    }

    return a.name.localeCompare(b.name)
  })
}

function matchesCurrentPeriodFilter(item: BudgetItem, filter: CurrentPeriodItemFilter) {
  if (filter === 'all') {
    return true
  }

  if (filter === 'bills') {
    return item.kind === 'bill'
  }

  if (filter === 'expenses') {
    return item.kind === 'expense' && !item.setAsideForTemplateId
  }

  if (filter === 'set-asides') {
    return item.kind === 'expense' && Boolean(item.setAsideForTemplateId)
  }

  if (filter === 'unpaid-bills') {
    return item.kind === 'bill' && !item.isPaid
  }

  return item.kind === 'bill' && Boolean(item.isPaid)
}

function TargetProgressCard({
  progress,
  formatCurrency,
  compact = false,
}: {
  progress: CategoryTargetProgress
  formatCurrency: (value: number) => string
  compact?: boolean
}) {
  const overAmount = Math.max(0, -progress.remaining)
  const percentLabel = Number.isFinite(progress.percentUsed) ? `${progress.percentUsed.toFixed(0)}% used` : 'Over target'
  const toneClass =
    progress.status === 'Over target'
      ? 'border-rose-500/25 bg-rose-500/10'
      : progress.status === 'At target'
        ? 'border-emerald-400/25 bg-emerald-400/10'
        : progress.status === 'Getting close'
          ? 'border-amber-400/25 bg-amber-400/10'
          : 'border-slate-800/70 bg-slate-950/60'

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{progress.category}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {progress.status} · {percentLabel}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(progress.spent)}</p>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/80"
        role="progressbar"
        aria-label={`${progress.category} target progress: ${progress.status}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.progressValue)}
      >
        <div
          className={`h-full rounded-full ${
            progress.status === 'Over target'
              ? 'bg-rose-400'
              : progress.status === 'Getting close'
                ? 'bg-amber-300'
                : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
          }`}
          style={{ width: `${progress.progressValue}%` }}
        />
      </div>

      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <MiniTargetStat label="Target" value={formatCurrency(progress.target)} />
        <MiniTargetStat label="Spent" value={formatCurrency(progress.spent)} />
        <MiniTargetStat
          label={progress.remaining < 0 ? 'Over' : 'Remaining'}
          value={progress.remaining < 0 ? formatCurrency(overAmount) : formatCurrency(progress.remaining)}
        />
      </div>
    </div>
  )
}

function MiniTargetStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-white">{value}</p>
    </div>
  )
}

function CategoryCard({
  summary,
  targetProgress,
  targetEditing,
  targetDraft,
  rank,
  expanded,
  onToggle,
  onMoveUp,
  onMoveDown,
  onStartEditingTarget,
  onTargetDraftChange,
  onSaveTarget,
  onRemoveTarget,
  onCancelTargetEdit,
  onDeleteBill,
  onDeleteExpense,
  onToggleBillPaid,
  onEditBill,
  onEditExpense,
  formatCurrency,
  canMoveUp,
  canMoveDown,
}: {
  summary: CategorySummary
  targetProgress: CategoryTargetProgress | null
  targetEditing: boolean
  targetDraft: string
  rank: number
  expanded: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onStartEditingTarget: () => void
  onTargetDraftChange: (value: string) => void
  onSaveTarget: () => void
  onRemoveTarget: () => void
  onCancelTargetEdit: () => void
  onDeleteBill: (id: string) => void
  onDeleteExpense: (id: string) => void
  onToggleBillPaid: (id: string) => void
  onEditBill: (bill: Bill) => void
  onEditExpense: (expense: Expense) => void
  formatCurrency: (value: number) => string
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const highlightClass =
    rank === 1
      ? 'border-emerald-400/30 bg-emerald-400/10'
      : rank <= 3
        ? 'border-cyan-400/25 bg-cyan-400/10'
        : 'border-slate-800/80 bg-slate-950/70'

  return (
    <article className={`leftly-shell-soft p-4 shadow-lg shadow-slate-950/20 ${highlightClass}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">{summary.category}</h3>
              {rank <= 3 ? <Badge>{rank === 1 ? 'Highest cost' : `Top ${rank}`}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {summary.total > 0 ? formatCurrency(summary.total) : 'No spending yet'}
            </p>
          </button>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="text-xs uppercase tracking-[0.22em] text-slate-500 transition hover:text-slate-300"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge muted>{summary.billCount} bill{summary.billCount === 1 ? '' : 's'}</Badge>
          <Badge muted>{summary.expenseCount} expense{summary.expenseCount === 1 ? '' : 's'}</Badge>
          {summary.manualExpenseCount > 0 ? <Badge muted>{summary.manualExpenseCount} manual</Badge> : null}
          {targetProgress ? <Badge muted>{targetProgress.status}</Badge> : null}
        </div>

        {targetProgress ? (
          <TargetProgressCard progress={targetProgress} formatCurrency={formatCurrency} />
        ) : null}

        {targetEditing ? (
          <div className="leftly-shell-faint grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Field label="Category target">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={targetDraft}
                onChange={(event) => onTargetDraftChange(event.target.value)}
                placeholder="250.00"
              />
            </Field>
            <button type="button" onClick={onSaveTarget} className="button-primary w-full self-end sm:w-auto">
              Save
            </button>
            <button type="button" onClick={onCancelTargetEdit} className="button-secondary w-full self-end sm:w-auto">
              Cancel
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${summary.category} up`}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200 transition hover:border-cyan-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:w-10"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${summary.category} down`}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200 transition hover:border-cyan-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:w-10"
          >
            ▼
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-lg font-semibold text-white">{formatCurrency(summary.total)}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Current total</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onStartEditingTarget} className="button-secondary w-full sm:w-auto">
            {targetProgress ? 'Edit target' : 'Set target'}
          </button>
          {targetProgress ? (
            <button type="button" onClick={onRemoveTarget} className="button-secondary w-full sm:w-auto">
              Remove target
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-2 border-t border-slate-800/70 pt-4">
          {summary.items.length === 0 ? (
            <EmptyState title="Nothing here yet" text="Add a bill or expense and it will appear in this category." compact />
          ) : (
            summary.items.map((item) => (
              <div
                key={item.id}
                className="leftly-shell-soft flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                    {item.source === 'recurring' ? (
                      <Badge muted={Boolean(item.setAsideForTemplateId)}>
                        {item.setAsideForTemplateId ? 'Set-aside' : item.isPlanned ? 'Planned spending' : 'Bill Plan'}
                      </Badge>
                    ) : null}
                    {item.kind === 'bill' && item.carriedOverFromPayPeriodId ? <Badge muted>Carried over</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <Badge muted>{item.kind}</Badge>
                    {item.kind === 'bill' ? <Badge muted>Due {item.dueDate}</Badge> : <Badge muted>{item.date}</Badge>}
                    {item.kind === 'bill' && item.paidDate ? <Badge success>Paid {item.paidDate}</Badge> : null}
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    {item.kind === 'bill'
                      ? item.isPaid
                        ? 'Marked paid in this pay period.'
                        : 'Open bill for this pay period.'
                      : item.source === 'recurring'
                        ? 'Recurring expense or set-aside.'
                        : 'Manual expense logged this pay period.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {item.kind === 'bill' ? (
                    <label className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(item.isPaid)}
                        onChange={() => onToggleBillPaid(item.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                      />
                      Paid
                    </label>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => (item.kind === 'bill' ? onEditBill(item as Bill) : onEditExpense(item as Expense))}
                    className="button-secondary w-full sm:w-auto"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => (item.kind === 'bill' ? onDeleteBill(item.id) : onDeleteExpense(item.id))}
                    className="button-secondary w-full sm:w-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </article>
  )
}

function SectionShell({
  title,
  description,
  compact = false,
  children,
}: {
  title: string
  description: string
  compact?: boolean
  children: ReactNode
}) {
  if (compact) {
    return <div className="leftly-shell overflow-hidden p-3 sm:p-4">{children}</div>
  }

  return (
    <div className="leftly-shell overflow-hidden">
      <div className="border-b border-slate-800/70 px-4 py-4 sm:px-5 sm:py-5">
        <h2 className="leftly-section-title">{title}</h2>
        <p className="leftly-section-helper">{description}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

function MoreBackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="mb-4 flex">
      <button type="button" onClick={onBack} className="button-secondary w-full sm:w-auto">
        Back to More
      </button>
    </div>
  )
}

function TabButton({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold tracking-[0.01em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
          : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="leftly-field">
      <span>{label}</span>
      <span className="leftly-input-shell">
        {children}
      </span>
    </label>
  )
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

function getSafePercent(part: number, whole: number) {
  if (whole <= 0 || !Number.isFinite(part) || !Number.isFinite(whole)) {
    return 0
  }

  return clampPercent((part / whole) * 100)
}

function FinancialPulseHero({
  payPeriod,
  totals,
  billPaymentSummary,
  formatCurrency,
}: {
  payPeriod: BudgetPeriod | null
  totals: OverviewTotals
  billPaymentSummary: BillPaymentSummary
  formatCurrency: (value: number) => string
}) {
  const leftoverStatus =
    totals.leftover < 0
      ? 'Over budget'
      : totals.leftover === 0
        ? 'Fully allocated'
        : 'Available after bills and spending'
  const leftoverTone = totals.leftover < 0 ? 'warning' : totals.leftover === 0 ? 'neutral' : 'positive'
  const billProgress = getSafePercent(billPaymentSummary.paidAmount, billPaymentSummary.totalAmount)
  const rangeLabel = payPeriod ? `${payPeriod.startDate} to ${payPeriod.endDate}` : 'No active pay period'

  return (
    <section className={`leftly-financial-pulse leftly-financial-pulse-${leftoverTone}`} aria-labelledby="financial-pulse-title">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-stretch">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p id="financial-pulse-title" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
              Current Leftover
            </p>
            <Badge muted>{leftoverStatus}</Badge>
          </div>

          <p className="mt-3 break-words text-[clamp(2.4rem,14vw,4.25rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-white lg:text-[clamp(4rem,7vw,6.5rem)]">
            {formatCurrency(totals.leftover)}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Income minus planned bills, set-asides, and expenses in this pay period.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge muted>{rangeLabel}</Badge>
            {payPeriod ? <Badge muted>{payPeriod.cadence}</Badge> : null}
            {payPeriod?.rolloverAmount && payPeriod.rolloverAmount > 0 ? (
              <Badge success>Rollover {formatCurrency(payPeriod.rolloverAmount)}</Badge>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="leftly-pulse-focus-stat">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Safe to spend</p>
            <p className="mt-2 break-words text-2xl font-semibold tracking-[-0.03em] text-emerald-100">{formatCurrency(totals.safeToSpend)}</p>
          </div>

          <div className="leftly-pulse-focus-stat">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Bills paid by amount</p>
              <p className="text-sm font-semibold text-cyan-100">{billPaymentSummary.totalAmount > 0 ? `${Math.round(billProgress)}%` : 'No bills'}</p>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800/90"
              role="progressbar"
              aria-label="Bill payment progress by amount"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(billProgress)}
            >
              <div className="leftly-progress-fill leftly-progress-emerald" style={{ width: `${billProgress}%` }} />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {billPaymentSummary.paidCount} of {billPaymentSummary.totalCount} paid · {formatCurrency(billPaymentSummary.paidAmount)} of {formatCurrency(billPaymentSummary.totalAmount)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <OverviewStat label="Income" value={formatCurrency(totals.income)} />
        <OverviewStat label="Planned bills" value={formatCurrency(totals.totalPlannedBills)} />
        <OverviewStat label="Paid bills" value={formatCurrency(totals.paidBills)} />
        <OverviewStat label="Unpaid bills" value={formatCurrency(totals.unpaidBills)} />
        <OverviewStat label="Expenses" value={formatCurrency(totals.totalExpenses)} />
        {totals.totalSetAside > 0 ? <OverviewStat label="Set-asides" value={formatCurrency(totals.totalSetAside)} /> : null}
      </div>
    </section>
  )
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="leftly-overview-stat">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1.5 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function PaycheckAllocation({
  totals,
  formatCurrency,
}: {
  totals: OverviewTotals
  formatCurrency: (value: number) => string
}) {
  const otherExpenses = Math.max(0, totals.totalExpenses - totals.totalSetAside)
  const remaining = Math.max(0, totals.leftover)
  const overBudget = Math.max(0, -totals.leftover)
  const buckets = [
    { key: 'bills', label: 'Planned bills', amount: totals.totalPlannedBills, className: 'leftly-allocation-bills' },
    { key: 'set-asides', label: 'Set-asides', amount: totals.totalSetAside, className: 'leftly-allocation-setaside' },
    { key: 'expenses', label: 'Other expenses', amount: otherExpenses, className: 'leftly-allocation-expenses' },
    { key: 'remaining', label: 'Remaining', amount: remaining, className: 'leftly-allocation-remaining' },
  ].filter((bucket) => bucket.amount > 0)
  const allocated = totals.totalPlannedBills + totals.totalSetAside + otherExpenses
  const visualTotal = Math.max(totals.income, allocated + remaining)
  const canShowBar = totals.income > 0 && visualTotal > 0

  return (
    <section className="leftly-overview-section">
      <OverviewSectionHeader
        title="Paycheck allocation"
        description="Planned bills, set-asides, other expenses, and what remains from this pay period."
        aside={overBudget > 0 ? <span className="leftly-chip leftly-chip-warning px-2.5 py-1 text-[10px]">Over by {formatCurrency(overBudget)}</span> : undefined}
      />

      {canShowBar ? (
        <>
          <div className="sr-only">
            Paycheck allocation: {buckets.map((bucket) => `${bucket.label} ${formatCurrency(bucket.amount)}`).join(', ')}
            {overBudget > 0 ? `, over budget by ${formatCurrency(overBudget)}` : ''}
          </div>
          <div className="leftly-allocation-bar mt-4" aria-hidden="true">
            {buckets.map((bucket) => (
              <div
                key={bucket.key}
                className={`leftly-allocation-segment ${bucket.className}`}
                style={{ width: `${getSafePercent(bucket.amount, visualTotal)}%` }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-[1.1rem] border border-dashed border-slate-700/90 bg-slate-950/45 px-3 py-3 text-sm leading-6 text-slate-400">
          Allocation appears after income is set. Exact bill, set-aside, and expense amounts are still listed below.
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ...buckets,
          ...(overBudget > 0 ? [{ key: 'over', label: 'Over budget', amount: overBudget, className: 'leftly-allocation-over' }] : []),
        ].map((bucket) => (
          <div key={bucket.key} className="leftly-allocation-legend-item">
            <span className={`leftly-allocation-dot ${bucket.className}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">{bucket.label}</p>
              <p className="mt-1 break-words text-xs text-slate-400">{formatCurrency(bucket.amount)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BillPaymentProgress({
  summary,
  formatCurrency,
}: {
  summary: BillPaymentSummary
  formatCurrency: (value: number) => string
}) {
  const progress = getSafePercent(summary.paidAmount, summary.totalAmount)
  const progressLabel = summary.totalAmount > 0 ? `${Math.round(progress)}% paid by amount` : 'No bills yet'

  return (
    <section className="leftly-overview-section" aria-labelledby="bill-payment-progress-title">
      <OverviewSectionHeader
        title="Bill-payment progress"
        description="Completion is measured by paid amount divided by total planned bill amount."
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div
          className="leftly-bill-progress-ring"
          style={{ '--leftly-bill-progress': `${progress}%` } as CSSProperties}
          role="progressbar"
          aria-label="Bill payment progress by amount"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <span>{summary.totalAmount > 0 ? `${Math.round(progress)}%` : '0%'}</span>
        </div>

        <div className="min-w-0">
          <p id="bill-payment-progress-title" className="text-base font-semibold text-white">{progressLabel}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {summary.paidCount} of {summary.totalCount} bill{summary.totalCount === 1 ? '' : 's'} paid · {summary.unpaidCount} unpaid
          </p>
          <div className="mt-3 grid gap-2">
            <OverviewStat label="Paid amount" value={`${formatCurrency(summary.paidAmount)} of ${formatCurrency(summary.totalAmount)}`} />
            <OverviewStat label="Unpaid amount" value={formatCurrency(summary.unpaidAmount)} />
          </div>
        </div>
      </div>
    </section>
  )
}

function OverviewSectionHeader({
  title,
  description,
  aside,
}: {
  title: string
  description: string
  aside?: ReactNode
}) {
  return (
    <div className="leftly-card-heading">
      <div className="min-w-0">
        <p className="leftly-card-title">{title}</p>
        <p className="mt-1 leftly-card-helper">{description}</p>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  )
}

function OverviewActionCard({
  eyebrow,
  title,
  helper,
  onClick,
  disabled = false,
  tone = 'default',
  wide = false,
}: {
  eyebrow: string
  title: string
  helper: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'accent'
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`leftly-overview-action-card ${tone === 'accent' ? 'leftly-overview-action-card-accent' : ''} ${wide ? 'sm:col-span-2' : ''} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-white">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">{helper}</p>
      </div>
      <span className="shrink-0 text-sm text-slate-500">›</span>
    </button>
  )
}

function DueSoonStatusBadge({ status, tone }: { status: DueSoonBillRow['status']; tone: DueSoonBillRow['statusTone'] }) {
  const className =
    tone === 'rose'
      ? 'border-rose-500/20 bg-rose-500/10 text-rose-100'
      : tone === 'cyan'
        ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
        : 'border-amber-500/20 bg-amber-500/10 text-amber-100'

  return <span className={`leftly-chip px-2.5 py-1 text-[10px] ${className}`}>{status}</span>
}

function BillPaymentSummaryBlock({
  summary,
  formatCurrency,
  label,
}: {
  summary: BillPaymentSummary
  formatCurrency: (value: number) => string
  label: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {summary.paidCount} of {summary.totalCount} bill{summary.totalCount === 1 ? '' : 's'} paid
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {formatCurrency(summary.paidAmount)} paid · {formatCurrency(summary.unpaidAmount)} remaining
          </p>
        </div>
        <Badge muted>{label}</Badge>
      </div>
    </div>
  )
}

function OverviewListRow({
  title,
  badges,
  meta,
  amount,
  actions,
}: {
  title: string
  badges?: ReactNode
  meta: ReactNode
  amount: string
  actions?: ReactNode
}) {
  return (
    <article className="leftly-overview-list-row">
      <div className="leftly-overview-list-main">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          {badges}
        </div>
        <div className="text-[11px] leading-5 text-slate-400">{meta}</div>
      </div>
      <div className="leftly-overview-list-side">
        <p className="text-sm font-semibold text-white">{amount}</p>
        {actions ? <div className="leftly-overview-inline-actions">{actions}</div> : null}
      </div>
    </article>
  )
}

function FormMessage({ children }: { children: string }) {
  return (
    <p className="leftly-banner-warning" role="alert">
      {children}
    </p>
  )
}

function SuccessMessage({ children }: { children: string }) {
  return (
    <p className="leftly-banner-success" role="status">
      {children}
    </p>
  )
}

function EmptyState({
  title,
  text,
  compact = false,
}: {
  title: string
  text: string
  compact?: boolean
}) {
  return (
    <div className={`leftly-empty ${compact ? 'leftly-empty-compact' : ''}`}>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className={`mt-1 text-sm leading-6 text-slate-400 ${compact ? 'max-w-md' : ''}`}>{text}</p>
    </div>
  )
}

function Badge({
  children,
  muted = false,
  success = false,
}: {
  children: ReactNode
  muted?: boolean
  success?: boolean
}) {
  const className = success ? 'leftly-chip-success' : muted ? 'leftly-chip-muted' : 'leftly-chip-default'

  return <span className={`leftly-chip px-3 py-1 text-xs font-medium ${className}`}>{children}</span>
}

export default App
