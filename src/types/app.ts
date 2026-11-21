// Shared view-model types used by App and its screen components.
import {
  type Bill,
  type BudgetCategory,
} from '../types/budget'

export type BudgetItem = {
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

export type CategorySummary = {
  category: BudgetCategory
  items: BudgetItem[]
  total: number
  billCount: number
  expenseCount: number
  manualExpenseCount: number
}

export type CategoryTargetProgress = {
  category: BudgetCategory
  target: number
  spent: number
  remaining: number
  percentUsed: number
  status: 'On track' | 'Getting close' | 'At target' | 'Over target'
  progressValue: number
}

export type BillPaymentSummary = {
  totalCount: number
  paidCount: number
  unpaidCount: number
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
}

export type DueSoonBillRow = {
  bill: Bill
  status: 'Overdue' | 'Due today' | 'Due in next 7 days'
  statusTone: 'rose' | 'cyan' | 'amber'
  dueDateLabel: string
  scheduleLabel?: string
  planName?: string
}

export type OverviewTotals = {
  income: number
  totalPlannedBills: number
  paidBills: number
  unpaidBills: number
  totalExpenses: number
  totalSetAside: number
  leftover: number
  safeToSpend: number
}

export type HistorySort = 'newest' | 'oldest' | 'highest-leftly' | 'lowest-leftly'

export type SnapshotCategorySummary = {
  category: BudgetCategory
  total: number
  count: number
}
