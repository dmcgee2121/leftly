import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  clearAllAppData,
  addPayPeriodSnapshot,
  deletePayPeriodSnapshot,
  loadActiveBudgetPeriod,
  loadBills,
  loadCategoryOrder,
  loadCategoryOrderMode,
  loadExpenses,
  loadPayPeriodHistory,
  loadSortMode,
  loadRecurringTemplates,
  saveActiveBudgetPeriod,
  saveBills,
  saveCategoryOrder,
  saveCategoryOrderMode,
  saveExpenses,
  savePayPeriodHistory,
  saveRecurringTemplates,
  saveSortMode,
} from './lib/storage'
import { generateRecurringItems, getRecurringPeriodKey } from './lib/recurring'
import {
  DEFAULT_CATEGORIES,
  type Bill,
  type BudgetCategory,
  type BudgetPeriod,
  type CategoryOrderMode,
  type Expense,
  type PayPeriodSnapshot,
  type PayPeriodTotals,
  type PayCadence,
  type RecurringItemTemplate,
  type SortMode,
} from './types/budget'
import type { EditTarget } from './components/EditItemPanel'
import { EditItemPanel } from './components/EditItemPanel'
import { RecurringSection } from './components/RecurringSection'
import { StartFromHistoryPanel } from './components/StartFromHistoryPanel'
import { StartNewPayPeriodPanel } from './components/StartNewPayPeriodPanel'

type TabKey = 'overview' | 'income' | 'bill' | 'expense' | 'categories' | 'recurring'
  | 'history'
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
}

type CategorySummary = {
  category: BudgetCategory
  items: BudgetItem[]
  total: number
}

const demoBillSeed: Array<{
  name: string
  amount: number
  dueDate: string
  category: BudgetCategory
  isPaid: boolean
}> = [
  { name: 'Rent', amount: 1150, dueDate: '2026-06-15', category: 'Housing', isPaid: true },
  { name: 'Electric', amount: 92.4, dueDate: '2026-06-18', category: 'Utilities', isPaid: false },
  { name: 'Internet', amount: 74.99, dueDate: '2026-06-20', category: 'Utilities', isPaid: true },
  { name: 'Spotify', amount: 11.99, dueDate: '2026-06-22', category: 'Subscriptions', isPaid: true },
  { name: 'Car payment', amount: 285, dueDate: '2026-06-21', category: 'Transportation', isPaid: false },
  { name: 'Student loan', amount: 180, dueDate: '2026-06-24', category: 'Debt', isPaid: false },
  { name: 'Renter insurance', amount: 27, dueDate: '2026-06-25', category: 'Insurance', isPaid: true },
]

const demoExpenseSeed: Array<{
  name: string
  amount: number
  date: string
  category: BudgetCategory
}> = [
  { name: 'Groceries', amount: 86.12, date: '2026-06-11', category: 'Food' },
  { name: 'Gas', amount: 41.38, date: '2026-06-12', category: 'Transportation' },
  { name: 'Lunch', amount: 15.79, date: '2026-06-13', category: 'Food' },
]

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

const categoryOrderOptions: Array<{ value: CategoryOrderMode; label: string }> = [
  { value: 'total-desc', label: 'Total high to low' },
  { value: 'custom', label: 'Custom order' },
]

const tabLabels: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'income', label: 'Income' },
  { key: 'bill', label: 'Add Bill' },
  { key: 'expense', label: 'Add Expense' },
  { key: 'categories', label: 'Categories' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'history', label: 'History' },
]

const initialPayPeriod = loadActiveBudgetPeriod()
const initialBills = loadBills()
const initialExpenses = loadExpenses()
const initialRecurringTemplates = loadRecurringTemplates()
const initialPayPeriodHistory = loadPayPeriodHistory()
const initialSortMode = loadSortMode()
const initialCategoryOrder = loadCategoryOrder()
const initialCategoryOrderMode = loadCategoryOrderMode()

function getDraftFromPeriod(period: BudgetPeriod | null): PayPeriodDraft {
  return {
    cadence: period?.cadence ?? 'biweekly',
    income: period ? String(period.income) : '',
    startDate: period?.startDate ?? '',
    endDate: period?.endDate ?? '',
  }
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

function createPayPeriodSnapshot(period: BudgetPeriod, bills: Bill[], expenses: Expense[]): PayPeriodSnapshot {
  const archivedAt = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    label: formatHistoryPeriodLabel(period.startDate, period.endDate),
    cadence: period.cadence,
    startDate: period.startDate,
    endDate: period.endDate,
    income: period.income,
    bills: bills.map((bill) => ({ ...bill })),
    expenses: expenses.map((expense) => ({ ...expense })),
    totals: calculatePayPeriodTotals(period, bills, expenses),
    createdAt: archivedAt,
    archivedAt,
  }
}

function formatArchivedDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : historyDateFormatter.format(date)
}

function HistorySection({
  snapshots,
  selectedSnapshot,
  onSelectSnapshot,
  onUseAsStartingPoint,
  onBackToList,
  onDeleteSnapshot,
  formatCurrency,
}: {
  snapshots: PayPeriodSnapshot[]
  selectedSnapshot: PayPeriodSnapshot | null
  onSelectSnapshot: (id: string) => void
  onUseAsStartingPoint: (snapshot: PayPeriodSnapshot) => void
  onBackToList: () => void
  onDeleteSnapshot: (id: string) => void
  formatCurrency: (value: number) => string
}) {
  if (selectedSnapshot) {
    const billItems = selectedSnapshot.bills
    const expenseItems = selectedSnapshot.expenses
    const categoryTotals = DEFAULT_CATEGORIES.map((category) => {
      const categoryTotal = [...billItems, ...expenseItems]
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + item.amount, 0)
      return {
        category,
        total: categoryTotal,
      }
    }).filter((summary) => summary.total > 0)

    return (
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Archived pay period</p>
            <h3 className="mt-1 text-xl font-semibold text-white">{selectedSnapshot.label}</h3>
            <p className="mt-1 text-sm text-slate-400">
              Archived {formatArchivedDate(selectedSnapshot.archivedAt)} · {selectedSnapshot.cadence}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onUseAsStartingPoint(selectedSnapshot)} className="button-primary">
              Use as starting point
            </button>
            <button type="button" onClick={onBackToList} className="button-secondary">
              Back
            </button>
            <button
              type="button"
              onClick={() => onDeleteSnapshot(selectedSnapshot.id)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 shadow-sm transition hover:bg-rose-500/15 focus:outline-none focus:ring-4 focus:ring-rose-400/10 active:translate-y-px"
            >
              Delete snapshot
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Income" value={formatCurrency(selectedSnapshot.income)} />
          <MetricCard label="Total bills" value={formatCurrency(selectedSnapshot.totals.totalBills)} />
          <MetricCard label="Expenses" value={formatCurrency(selectedSnapshot.totals.totalExpenses)} />
          <MetricCard label="Set-asides" value={formatCurrency(selectedSnapshot.totals.totalSetAsides)} />
          <MetricCard label="Paid bills" value={formatCurrency(selectedSnapshot.totals.paidBills)} />
          <MetricCard label="Unpaid bills" value={formatCurrency(selectedSnapshot.totals.unpaidBills)} />
          <MetricCard label="Safe to spend" value={formatCurrency(selectedSnapshot.totals.safeToSpend)} tone="highlight" />
          <MetricCard label="Leftover" value={formatCurrency(selectedSnapshot.totals.leftover)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">Bills</p>
            <div className="mt-3 grid gap-2">
              {billItems.length > 0 ? (
                billItems.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-white">{bill.name}</p>
                        {bill.source === 'recurring' ? <Badge muted>Recurring</Badge> : null}
                        <Badge muted>{bill.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {bill.category} · Due {bill.dueDate}
                        {bill.source === 'recurring' ? ' · generated from recurring template' : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white">{formatCurrency(bill.amount)}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No bills in this period" text="This archived pay period did not include any bills." compact />
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/70 p-4">
            <p className="text-sm font-semibold text-white">Expenses</p>
            <div className="mt-3 grid gap-2">
              {expenseItems.length > 0 ? (
                expenseItems.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-white">{expense.name}</p>
                        {expense.source === 'recurring' ? (
                          <Badge muted>{expense.setAsideForTemplateId ? 'Set-aside' : expense.isPlanned ? 'Planned' : 'Recurring'}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {expense.category} · {expense.date}
                        {expense.setAsideForTemplateId ? ' · reserves money before the bill is due' : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white">{formatCurrency(expense.amount)}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No expenses in this period" text="This archived pay period did not include any expenses." compact />
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/70 p-4">
          <p className="text-sm font-semibold text-white">Category totals</p>
          {categoryTotals.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {categoryTotals.map((summary) => (
                <div key={summary.category} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3">
                  <p className="text-sm font-medium text-white">{summary.category}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatCurrency(summary.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-400">No category totals for this archived pay period.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
        <p className="text-sm leading-6 text-slate-400">
          Archived pay periods are saved snapshots of each budget cycle. They stay local in this browser until you delete them.
        </p>
      </div>

      {snapshots.length > 0 ? (
        <div className="grid gap-3">
          {snapshots.map((snapshot) => (
            <article key={snapshot.id} className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/70 p-4 shadow-lg shadow-slate-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button type="button" onClick={() => onSelectSnapshot(snapshot.id)} className="flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{snapshot.label}</h3>
                    <Badge muted>{snapshot.cadence}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">Archived {formatArchivedDate(snapshot.archivedAt)}</p>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteSnapshot(snapshot.id)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 shadow-sm transition hover:bg-rose-500/15 focus:outline-none focus:ring-4 focus:ring-rose-400/10 active:translate-y-px"
                >
                  Delete
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <MiniStat label="Income" value={formatCurrency(snapshot.income)} />
                <MiniStat label="Total bills" value={formatCurrency(snapshot.totals.totalBills)} />
                <MiniStat label="Expenses" value={formatCurrency(snapshot.totals.totalExpenses)} />
                <MiniStat label="Set-asides" value={formatCurrency(snapshot.totals.totalSetAsides)} />
                <MiniStat label="Leftover" value={formatCurrency(snapshot.totals.leftover)} />
                <MiniStat label="Safe to spend" value={formatCurrency(snapshot.totals.safeToSpend)} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No archived pay periods yet"
          text="Start a new pay period to archive the current one here for later review."
        />
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [payPeriod, setPayPeriod] = useState<BudgetPeriod | null>(initialPayPeriod)
  const [bills, setBills] = useState<Bill[]>(initialBills)
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringItemTemplate[]>(initialRecurringTemplates)
  const [payPeriodHistory, setPayPeriodHistory] = useState<PayPeriodSnapshot[]>(initialPayPeriodHistory)
  const [historyStartSnapshot, setHistoryStartSnapshot] = useState<PayPeriodSnapshot | null>(null)
  const [editingItem, setEditingItem] = useState<EditTarget | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>(initialSortMode)
  const [categoryOrderMode, setCategoryOrderMode] = useState<CategoryOrderMode>(initialCategoryOrderMode)
  const [categoryOrder, setCategoryOrder] = useState<BudgetCategory[]>(initialCategoryOrder)
  const [expandedCategories, setExpandedCategories] = useState<Set<BudgetCategory>>(() => {
    const seeded = new Set<BudgetCategory>()
    for (const category of DEFAULT_CATEGORIES) {
      if (initialBills.some((bill) => bill.category === category) || initialExpenses.some((expense) => expense.category === category)) {
        seeded.add(category)
      }
    }

    if (seeded.size === 0) {
      seeded.add('Housing')
    }

    return seeded
  })
  const [payPeriodDraft, setPayPeriodDraft] = useState<PayPeriodDraft>(() => getDraftFromPeriod(initialPayPeriod))
  const [billDraft, setBillDraft] = useState<BillDraft>({
    name: '',
    amount: '',
    dueDate: '',
    category: 'Other / Misc',
  })
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>({
    name: '',
    amount: '',
    date: '',
    category: 'Other / Misc',
  })
  const [payPeriodError, setPayPeriodError] = useState('')
  const [billError, setBillError] = useState('')
  const [expenseError, setExpenseError] = useState('')
  const [incomeSuccess, setIncomeSuccess] = useState('')
  const [billSuccess, setBillSuccess] = useState('')
  const [expenseSuccess, setExpenseSuccess] = useState('')
  const [billStatus, setBillStatus] = useState('')
  const [isStartNewPayPeriodOpen, setIsStartNewPayPeriodOpen] = useState(false)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)

  useEffect(() => {
    saveActiveBudgetPeriod(payPeriod)
  }, [payPeriod])

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
    saveCategoryOrder(categoryOrder)
  }, [categoryOrder])

  useEffect(() => {
    saveCategoryOrderMode(categoryOrderMode)
  }, [categoryOrderMode])

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

    for (const category of DEFAULT_CATEGORIES) {
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

    const summaries = DEFAULT_CATEGORIES.map((category) => {
      const items = sortItems(itemsByCategory.get(category) ?? [], sortMode)
      const total = items.reduce((sum, item) => sum + item.amount, 0)
      return { category, items, total }
    })

    if (categoryOrderMode === 'custom') {
      const indexByCategory = new Map(categoryOrder.map((category, index) => [category, index]))
      return [...summaries].sort(
        (a, b) => (indexByCategory.get(a.category) ?? 0) - (indexByCategory.get(b.category) ?? 0),
      )
    }

    return [...summaries].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
  }, [bills, categoryOrder, categoryOrderMode, expenses, sortMode])

  const topCategories = useMemo(() => {
    return [...categorySummaries]
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
      .slice(0, 3)
  }, [categorySummaries])

  const recentBills = useMemo(() => bills.slice(0, 3), [bills])
  const recentExpenses = useMemo(() => expenses.slice(0, 3), [expenses])
  const selectedHistorySnapshot = useMemo(
    () => payPeriodHistory.find((snapshot) => snapshot.id === selectedHistoryId) ?? null,
    [payPeriodHistory, selectedHistoryId],
  )

  const categoryRank = useMemo(() => {
    return new Map(
      [...categorySummaries]
        .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
        .map((summary, index) => [summary.category, index + 1]),
    )
  }, [categorySummaries])

  function formatCurrency(value: number) {
    return currencyFormatter.format(value)
  }

  function resetDrafts() {
    setPayPeriodDraft(getDraftFromPeriod(null))
    setBillDraft({
      name: '',
      amount: '',
      dueDate: '',
      category: 'Other / Misc',
    })
    setExpenseDraft({
      name: '',
      amount: '',
      date: '',
      category: 'Other / Misc',
    })
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

    const nextPeriod: BudgetPeriod = {
      cadence: payPeriodDraft.cadence,
      income,
      startDate: payPeriodDraft.startDate,
      endDate: payPeriodDraft.endDate,
    }

    setPayPeriod(nextPeriod)
    setPayPeriodDraft(getDraftFromPeriod(nextPeriod))
    setIncomeSuccess('Income saved.')
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

  function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setExpenseError('')
    setExpenseSuccess('')

    const amount = Number(expenseDraft.amount)

    if (!expenseDraft.name.trim()) {
      setExpenseError('Expense name is required.')
      return
    }

    if (!expenseDraft.date) {
      setExpenseError('Date is required.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('Amount must be greater than 0.')
      return
    }

    setExpenses((current) => [
      {
        id: crypto.randomUUID(),
        name: expenseDraft.name.trim(),
        amount,
        date: expenseDraft.date,
        category: expenseDraft.category,
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ])

    setExpenseDraft({
      name: '',
      amount: '',
      date: '',
      category: expenseDraft.category,
    })
    setExpenseSuccess('Expense added.')
    setActiveTab('expense')
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

    const snapshot = createPayPeriodSnapshot(payPeriod, bills, expenses)
    addPayPeriodSnapshot(snapshot)
    setPayPeriodHistory((current) => [snapshot, ...current])
    return true
  }

  function openStartNewPayPeriod() {
    setActiveTab('income')
    setIsStartNewPayPeriodOpen(true)
  }

  function handleStartNewPayPeriod(period: BudgetPeriod, options: { generateRecurring: boolean }) {
    if (!archiveActivePayPeriod()) {
      return
    }

    const periodKey = getRecurringPeriodKey(period)
    const manualBills = bills.filter((bill) => bill.source !== 'recurring')
    const nextExpenses: Expense[] = []

    if (options.generateRecurring) {
      const generated = generateRecurringItems({
        templates: recurringTemplates,
        period,
        existingBills: manualBills.filter((bill) => bill.source !== 'recurring' || bill.generatedForPeriodId !== periodKey),
        existingExpenses: nextExpenses,
      })

      setBills(generated.bills)
      setExpenses(generated.expenses)
      setRecurringTemplates(generated.templates)
    } else {
      setBills(manualBills)
      setExpenses(nextExpenses)
    }

    setPayPeriod(period)
    setIsStartNewPayPeriodOpen(false)
    setSelectedHistoryId(null)
    setEditingItem(null)
    setActiveTab('overview')
  }

  function handleStartFromHistory(result: {
    period: BudgetPeriod
    bills: Bill[]
    expenses: Expense[]
    copyManualExpenses: boolean
  }) {
    if (!archiveActivePayPeriod()) {
      return
    }

    setPayPeriod(result.period)
    setPayPeriodDraft(getDraftFromPeriod(result.period))
    setBills(result.bills)
    setExpenses(result.expenses)
    setHistoryStartSnapshot(null)
    setSelectedHistoryId(null)
    setIsStartNewPayPeriodOpen(false)
    setEditingItem(null)
    setActiveTab('overview')
  }

  function loadDemoData() {
    const nextPayPeriod: BudgetPeriod = {
      cadence: 'biweekly',
      income: 3200,
      startDate: '2026-06-10',
      endDate: '2026-06-23',
    }

    const nextBills: Bill[] = demoBillSeed.map((bill) => ({
      id: crypto.randomUUID(),
      name: bill.name,
      amount: bill.amount,
      dueDate: bill.dueDate,
      isPaid: bill.isPaid,
      paidDate: bill.isPaid ? '2026-06-11' : null,
      category: bill.category,
      source: 'manual',
      createdAt: new Date().toISOString(),
    }))

    const nextExpenses: Expense[] = demoExpenseSeed.map((expense) => ({
      id: crypto.randomUUID(),
      name: expense.name,
      amount: expense.amount,
      date: expense.date,
      category: expense.category,
      source: 'manual',
      createdAt: new Date().toISOString(),
    }))

    setPayPeriod(nextPayPeriod)
    setPayPeriodDraft(getDraftFromPeriod(nextPayPeriod))
    setBills(nextBills)
    setExpenses(nextExpenses)
    setExpandedCategories(new Set(DEFAULT_CATEGORIES))
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
    if (!window.confirm('Delete this archived pay period? This cannot be undone.')) {
      return
    }

    deletePayPeriodSnapshot(id)
    setPayPeriodHistory((current) => current.filter((snapshot) => snapshot.id !== id))
    if (selectedHistoryId === id) {
      setSelectedHistoryId(null)
    }
  }

  function handleReset() {
    if (!window.confirm('This will clear the current Leftly data from this browser. Continue?')) {
      return
    }

    clearAllAppData()
    setPayPeriod(null)
    setBills([])
    setExpenses([])
    setRecurringTemplates([])
    setPayPeriodHistory([])
    setSortMode('amount-desc')
    setCategoryOrderMode('total-desc')
    setCategoryOrder([...DEFAULT_CATEGORIES])
    setExpandedCategories(new Set(['Housing']))
    setActiveTab('overview')
    setIsStartNewPayPeriodOpen(false)
    setHistoryStartSnapshot(null)
    setSelectedHistoryId(null)
    setEditingItem(null)
    resetDrafts()
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

  const hasAnyData = payPeriod || bills.length > 0 || expenses.length > 0

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050914] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-950/80 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 pb-6 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        <header className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/82 px-4 py-4 shadow-2xl shadow-slate-950/40 backdrop-blur sm:rounded-[2rem] sm:px-5 sm:py-6 xl:px-8">
          <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200 sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.24em]">
              Manual budget tracker
            </p>
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">Leftly</h1>
              <p className="text-lg text-slate-300 sm:text-2xl">Know what&apos;s left.</p>
            </div>
            <p className="max-w-2xl text-center text-xs leading-5 text-slate-400 sm:text-sm sm:leading-6">
              Track a single pay period, your bills, and your spending without connecting a bank.
            </p>
          </div>
        </header>

        <section className="mt-4 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/75 p-4 shadow-2xl shadow-slate-950/30 sm:mt-5 sm:rounded-[2rem] sm:p-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400 sm:text-sm sm:tracking-[0.24em]">Leftover</p>
            <p className="text-5xl font-semibold tracking-tight text-white sm:text-7xl lg:text-8xl">
              {formatCurrency(totals.leftover)}
            </p>
            <p className="max-w-2xl text-xs leading-5 text-slate-400 sm:text-sm sm:leading-6">
              Income minus paid bills, unpaid bills, set-asides, and expenses.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
            <MetricCard label="Income" value={formatCurrency(totals.income)} />
            <MetricCard label="Total planned bills" value={formatCurrency(totals.totalPlannedBills)} />
            <MetricCard label="Paid bills" value={formatCurrency(totals.paidBills)} />
            <MetricCard label="Unpaid bills" value={formatCurrency(totals.unpaidBills)} />
            <MetricCard label="Manual expenses" value={formatCurrency(totals.totalExpenses)} />
            {totals.totalSetAside > 0 ? <MetricCard label="Total set aside this period" value={formatCurrency(totals.totalSetAside)} /> : null}
            <MetricCard label="Safe to spend" value={formatCurrency(totals.safeToSpend)} tone="highlight" />
          </div>
        </section>

        <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:gap-3">
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
            <div className="flex min-w-max flex-nowrap gap-2 sm:min-w-0 sm:flex-wrap">
            {tabLabels.map((tab) => (
              <TabButton
                key={tab.key}
                label={tab.label}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              />
            ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button type="button" onClick={loadDemoData} className="button-secondary w-full sm:w-auto">
              Load demo data
            </button>
            <button type="button" onClick={handleReset} className="button-secondary w-full sm:w-auto">
              Reset data
            </button>
          </div>
        </div>

        <section className="mx-auto mt-5 w-full max-w-5xl">
          {activeTab === 'overview' ? (
            <SectionShell title="Overview" description="A snapshot of the current pay period and recent activity.">
              {hasAnyData ? (
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="grid gap-4">
                    <div className="rounded-[1.25rem] border border-slate-800/80 bg-slate-950/70 p-4 sm:rounded-[1.5rem] sm:p-5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:text-sm sm:tracking-[0.2em]">Current pay period</p>
                      {payPeriod ? (
                        <>
                          <p className="mt-3 text-xl font-semibold text-white sm:text-2xl">{formatCurrency(payPeriod.income)}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] sm:text-xs">
                            <Badge>{payPeriod.cadence}</Badge>
                            <Badge muted>{payPeriod.startDate}</Badge>
                            <Badge muted>{payPeriod.endDate}</Badge>
                          </div>
                          <div className="mt-4">
                            <button type="button" onClick={openStartNewPayPeriod} className="button-secondary w-full sm:w-auto">
                              Start new pay period
                            </button>
                          </div>
                        </>
                      ) : (
                        <EmptyState
                          title="No income yet"
                          text="Add or load a pay period in the Income tab to turn the overview into a live budget snapshot."
                          compact
                        />
                      )}
                    </div>

                    <div className="rounded-[1.25rem] border border-slate-800/80 bg-slate-950/70 p-4 sm:rounded-[1.5rem] sm:p-5">
                      <p className="text-sm font-medium text-white">Top categories</p>
                      <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                        {topCategories.length > 0 ? (
                          topCategories.map((summary, index) => (
                            <div
                              key={summary.category}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3 sm:items-center sm:px-4"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-white">{summary.category}</p>
                                  {index === 0 ? <Badge>Highest cost</Badge> : null}
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                                  {summary.items.length} item{summary.items.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-white sm:text-base">{formatCurrency(summary.total)}</p>
                            </div>
                          ))
                        ) : (
                          <EmptyState
                            title="No category items yet"
                            text="Add bills and expenses to see your top categories here."
                            compact
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[1.25rem] border border-slate-800/80 bg-slate-950/70 p-4 sm:rounded-[1.5rem] sm:p-5">
                      <p className="text-sm font-medium text-white">Recent bills</p>
                      <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                        {recentBills.length > 0 ? (
                          recentBills.map((bill) => (
                            <div
                              key={bill.id}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3 sm:items-center sm:px-4"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-medium text-white">{bill.name}</p>
                                  {bill.source === 'recurring' ? <Badge muted>Recurring</Badge> : null}
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                                  {bill.category} · due {bill.dueDate}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Badge muted>{bill.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                                <button type="button" onClick={() => startEditBill(bill)} className="button-secondary">
                                  Edit
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState title="No bills yet" text="Add a bill in the Add Bill tab to see it here." compact />
                        )}
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-slate-800/80 bg-slate-950/70 p-4 sm:rounded-[1.5rem] sm:p-5">
                      <p className="text-sm font-medium text-white">Recent expenses</p>
                      <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                        {recentExpenses.length > 0 ? (
                          recentExpenses.map((expense) => (
                            <div
                              key={expense.id}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3 sm:items-center sm:px-4"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-medium text-white">{expense.name}</p>
                                  {expense.source === 'recurring' ? (
                                    <Badge muted={Boolean(expense.setAsideForTemplateId)}>
                                      {expense.setAsideForTemplateId ? 'Set-aside' : expense.isPlanned ? 'Planned' : 'Recurring'}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                                  {expense.category} · {expense.date}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <p className="text-sm font-semibold text-white sm:text-base">{formatCurrency(expense.amount)}</p>
                                <button type="button" onClick={() => startEditExpense(expense)} className="button-secondary">
                                  Edit
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <EmptyState title="No expenses yet" text="Add an expense in the Add Expense tab to see it here." compact />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No budget data yet"
                  text="Add income, bills, or expenses to turn the overview into a working budget snapshot."
                />
              )}
            </SectionShell>
          ) : null}

          {activeTab === 'income' ? (
            <SectionShell title="Income" description="Edit the active pay period and keep the current period visible.">
              <div className="mb-4 flex justify-end">
                <button type="button" onClick={openStartNewPayPeriod} className="button-secondary w-full sm:w-auto">
                  Start new pay period
                </button>
              </div>

              <StartNewPayPeriodPanel
                currentPayPeriod={payPeriod}
                templates={recurringTemplates}
                isOpen={isStartNewPayPeriodOpen}
                onClose={() => setIsStartNewPayPeriodOpen(false)}
                onSubmit={handleStartNewPayPeriod}
              />

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.5rem] border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(7,19,14,0.96),rgba(6,11,18,0.92))] p-5">
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-200/80">Current income</p>
                  {payPeriod ? (
                    <>
                      <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
                        {formatCurrency(payPeriod.income)}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <Badge>{payPeriod.cadence}</Badge>
                        <Badge muted>{payPeriod.startDate}</Badge>
                        <Badge muted>{payPeriod.endDate}</Badge>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-400">
                        This pay period drives the leftover and safe-to-spend calculations.
                      </p>
                    </>
                  ) : (
                    <EmptyState
                      title="No income yet"
                      text="Set up a pay period on the form to unlock the budget calculations."
                      compact
                    />
                  )}
                </div>

                <form className="grid gap-4 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/70 p-4 sm:p-5" onSubmit={handleSavePayPeriod}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Cadence">
                      <select
                        value={payPeriodDraft.cadence}
                        onChange={(event) =>
                          setPayPeriodDraft((current) => ({
                            ...current,
                            cadence: event.target.value as PayCadence,
                          }))
                        }
                      >
                        {cadenceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Income">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payPeriodDraft.income}
                        onChange={(event) =>
                          setPayPeriodDraft((current) => ({
                            ...current,
                            income: event.target.value,
                          }))
                        }
                        placeholder="3200"
                      />
                    </Field>
                    <Field label="Start date">
                      <input
                        type="date"
                        value={payPeriodDraft.startDate}
                        onChange={(event) =>
                          setPayPeriodDraft((current) => ({
                            ...current,
                            startDate: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="End date">
                      <input
                        type="date"
                        value={payPeriodDraft.endDate}
                        onChange={(event) =>
                          setPayPeriodDraft((current) => ({
                            ...current,
                            endDate: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  {payPeriodError ? <FormMessage>{payPeriodError}</FormMessage> : null}
                {incomeSuccess ? <SuccessMessage>{incomeSuccess}</SuccessMessage> : null}

                <div className="flex items-stretch gap-3">
                  <button type="submit" className="button-primary w-full sm:w-auto">
                    Save pay period
                  </button>
                </div>
              </form>
              </div>
            </SectionShell>
          ) : null}

          {activeTab === 'bill' ? (
            <SectionShell title="Add Bill" description="Add a bill and keep working in the same tab.">
              {bills.length === 0 ? (
                <div className="mb-4">
                  <EmptyState title="No bills yet" text="Add your first bill below or load demo data to test the flow." compact />
                </div>
              ) : null}
              <form className="grid gap-4 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/70 p-4 sm:p-5" onSubmit={handleAddBill}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input
                      value={billDraft.name}
                      onChange={(event) => setBillDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Rent"
                    />
                  </Field>
                  <Field label="Amount">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
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
                      {DEFAULT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {billError ? <FormMessage>{billError}</FormMessage> : null}
                {billSuccess ? <SuccessMessage>{billSuccess}</SuccessMessage> : null}

                <div className="flex items-stretch gap-3">
                  <button type="submit" className="button-primary w-full sm:w-auto">
                    Add bill
                  </button>
                </div>
              </form>
            </SectionShell>
          ) : null}

          {activeTab === 'expense' ? (
            <SectionShell title="Add Expense" description="Add an expense and keep working in the same tab.">
              {expenses.length === 0 ? (
                <div className="mb-4">
                  <EmptyState title="No expenses yet" text="Add your first expense below or load demo data to test the flow." compact />
                </div>
              ) : null}
              <form className="grid gap-4 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/70 p-4 sm:p-5" onSubmit={handleAddExpense}>
                <div className="grid gap-3 sm:grid-cols-2">
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
                      {DEFAULT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {expenseError ? <FormMessage>{expenseError}</FormMessage> : null}
                {expenseSuccess ? <SuccessMessage>{expenseSuccess}</SuccessMessage> : null}

                <div className="flex items-stretch gap-3">
                  <button type="submit" className="button-primary w-full sm:w-auto">
                    Add expense
                  </button>
                </div>
              </form>
            </SectionShell>
          ) : null}

          {activeTab === 'categories' ? (
            <SectionShell title="Categories" description="Group, sort, and reorder all categories from one place.">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                <div className="flex justify-end">
                  <button type="button" onClick={handleReset} className="button-secondary w-full sm:w-auto">
                    Reset data
                  </button>
                </div>
              </div>

              {bills.length === 0 && expenses.length === 0 ? (
                <div className="mb-4">
                  <EmptyState
                    title="No category items yet"
                    text="Add bills or expenses to build category totals, sorting, and custom ordering."
                    compact
                  />
                </div>
              ) : null}

              {billStatus ? <SuccessMessage>{billStatus}</SuccessMessage> : null}

              <div className="grid gap-3">
                {categorySummaries.map((summary) => (
                  <CategoryCard
                    key={summary.category}
                    summary={summary}
                    rank={categoryRank.get(summary.category) ?? 0}
                    expanded={expandedCategories.has(summary.category)}
                    onToggle={() => toggleCategory(summary.category)}
                    onMoveUp={() => moveCategory(summary.category, -1)}
                    onMoveDown={() => moveCategory(summary.category, 1)}
                    onDeleteBill={deleteBill}
                    onDeleteExpense={deleteExpense}
                    onToggleBillPaid={toggleBillPaid}
                    onEditBill={startEditBill}
                    onEditExpense={startEditExpense}
                    formatCurrency={formatCurrency}
                    canMoveUp={categoryOrder.indexOf(summary.category) > 0}
                    canMoveDown={categoryOrder.indexOf(summary.category) < categoryOrder.length - 1}
                  />
                ))}
              </div>
            </SectionShell>
          ) : null}

          {activeTab === 'recurring' ? (
            <SectionShell title="Recurring" description="Save recurring bill and planned expense templates for later use.">
              <RecurringSection
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
                    snapshot={historyStartSnapshot}
                    isOpen={Boolean(historyStartSnapshot)}
                    onClose={() => setHistoryStartSnapshot(null)}
                    onSubmit={handleStartFromHistory}
                  />
                </div>
              ) : null}
              <HistorySection
                snapshots={payPeriodHistory}
                selectedSnapshot={selectedHistorySnapshot}
                onSelectSnapshot={setSelectedHistoryId}
                onUseAsStartingPoint={setHistoryStartSnapshot}
                onBackToList={() => setSelectedHistoryId(null)}
                onDeleteSnapshot={deleteHistorySnapshot}
                formatCurrency={formatCurrency}
              />
            </SectionShell>
          ) : null}

          <EditItemPanel
            target={editingItem}
            isOpen={Boolean(editingItem)}
            onClose={() => setEditingItem(null)}
            onSaveBill={saveEditedBill}
            onSaveExpense={saveEditedExpense}
          />
        </section>
      </div>
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

function CategoryCard({
  summary,
  rank,
  expanded,
  onToggle,
  onMoveUp,
  onMoveDown,
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
  rank: number
  expanded: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
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
      ? 'border-emerald-400/30 bg-emerald-400/8'
      : rank <= 3
        ? 'border-cyan-400/25 bg-cyan-400/8'
        : 'border-slate-800/80 bg-slate-950/70'

  return (
    <article className={`rounded-[1.5rem] border p-4 shadow-lg shadow-slate-950/20 ${highlightClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button type="button" onClick={onToggle} className="flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">{summary.category}</h3>
            {rank <= 3 ? <Badge>{rank === 1 ? 'Highest cost' : `Top ${rank}`}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {summary.items.length} item{summary.items.length === 1 ? '' : 's'}
          </p>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${summary.category} up`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200 transition hover:border-cyan-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${summary.category} down`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200 transition hover:border-cyan-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▼
          </button>
          <div className="text-right">
            <p className="text-lg font-semibold text-white">{formatCurrency(summary.total)}</p>
            <button
              type="button"
              onClick={onToggle}
              className="text-xs uppercase tracking-[0.22em] text-slate-500 transition hover:text-slate-300"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-2 border-t border-slate-800/70 pt-4">
          {summary.items.length === 0 ? (
            <EmptyState title="No items in this category" text="Add a bill or expense to see it grouped here." compact />
          ) : (
            summary.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                    {item.source === 'recurring' ? (
                      <Badge muted={Boolean(item.setAsideForTemplateId)}>
                        {item.setAsideForTemplateId ? 'Set-aside' : item.isPlanned ? 'Planned' : 'Recurring'}
                      </Badge>
                    ) : null}
                    <Badge muted>{item.kind}</Badge>
                    <Badge>{formatCurrency(item.amount)}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {item.kind === 'bill' ? <Badge muted>Due {item.dueDate}</Badge> : <Badge muted>{item.date}</Badge>}
                    {item.kind === 'bill' && item.paidDate ? <Badge success>Paid {item.paidDate}</Badge> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {item.kind === 'bill' ? (
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
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
                    className="button-secondary"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => (item.kind === 'bill' ? onDeleteBill(item.id) : onDeleteExpense(item.id))}
                    className="button-secondary"
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
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/75 p-4 shadow-2xl shadow-slate-950/30 sm:rounded-[2rem] sm:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-400 sm:leading-6">{description}</p>
      </div>
      {children}
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
        active
          ? 'border-cyan-400/30 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-300">
      <span>{label}</span>
      <span className="[&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-800 [&_input]:bg-slate-950 [&_input]:px-3 [&_input]:text-sm [&_input]:text-white [&_input]:outline-none [&_input]:transition [&_input]:placeholder:text-slate-500 [&_input]:focus:border-cyan-400/50 [&_input]:focus:ring-4 [&_input]:focus:ring-cyan-400/10 [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-800 [&_select]:bg-slate-950 [&_select]:px-3 [&_select]:text-sm [&_select]:text-white [&_select]:outline-none [&_select]:transition [&_select]:focus:border-cyan-400/50 [&_select]:focus:ring-4 [&_select]:focus:ring-cyan-400/10">
        {children}
      </span>
    </label>
  )
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'highlight'
}) {
  const valueClass = tone === 'highlight' ? 'text-emerald-200' : 'text-white'

  return (
    <div className="rounded-[1.25rem] border border-slate-800/80 bg-slate-950/65 p-3 sm:rounded-[1.5rem] sm:p-4">
      <p className="text-[11px] leading-4 text-slate-400 sm:text-sm">{label}</p>
      <p className={`mt-2 text-lg font-semibold tracking-tight sm:mt-3 sm:text-2xl sm:leading-none ${valueClass}`}>{value}</p>
    </div>
  )
}

function FormMessage({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" role="alert">
      {children}
    </p>
  )
}

function SuccessMessage({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200" role="status">
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
    <div className={`rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 ${compact ? 'p-3' : 'p-4'}`}>
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
  const className = success
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
    : muted
      ? 'border-slate-700 bg-slate-900/70 text-slate-300'
      : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>{children}</span>
}

export default App
