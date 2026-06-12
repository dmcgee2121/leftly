export const DEFAULT_CATEGORIES = [
  'Housing',
  'Utilities',
  'Subscriptions',
  'Transportation',
  'Food',
  'Debt',
  'Insurance',
  'Personal',
  'Other / Misc',
] as const

export type BudgetCategory = (typeof DEFAULT_CATEGORIES)[number]

export type PayCadence = 'weekly' | 'biweekly' | 'monthly'
export type RecurringFrequency = 'every-pay-period' | 'weekly' | 'biweekly' | 'monthly' | 'one-time'

export type SortMode = 'amount-desc' | 'amount-asc' | 'date' | 'name'

export type CategoryOrderMode = 'total-desc' | 'custom'

export type BudgetPeriod = {
  cadence: PayCadence
  startDate: string
  endDate: string
  income: number
}

export type PayPeriodTotals = {
  totalBills: number
  paidBills: number
  unpaidBills: number
  totalExpenses: number
  totalSetAsides: number
  safeToSpend: number
  leftover: number
}

export type Bill = {
  id: string
  name: string
  amount: number
  dueDate: string
  isPaid: boolean
  paidDate: string | null
  category: BudgetCategory
  source?: 'manual' | 'recurring'
  templateId?: string
  generatedForPeriodId?: string
  createdAt?: string
}

export type Expense = {
  id: string
  name: string
  amount: number
  date: string
  category: BudgetCategory
  isPlanned?: boolean
  source?: 'manual' | 'recurring'
  templateId?: string
  generatedForPeriodId?: string
  setAsideForTemplateId?: string
  createdAt?: string
}

export type RecurringItemTemplate = {
  id: string
  name: string
  amount: number
  category: BudgetCategory
  kind: 'bill' | 'planned-expense'
  frequency: RecurringFrequency
  dueDay?: number
  anchorDate?: string
  setAsideEnabled?: boolean
  setAsideAmount?: number
  isActive: boolean
  createdAt: string
}

export type PayPeriodSnapshot = {
  id: string
  label: string
  cadence: PayCadence
  startDate: string
  endDate: string
  income: number
  bills: Bill[]
  expenses: Expense[]
  totals: PayPeriodTotals
  createdAt: string
  archivedAt: string
}
