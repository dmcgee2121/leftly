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

export type Bill = {
  id: string
  name: string
  amount: number
  dueDate: string
  isPaid: boolean
  paidDate: string | null
  category: BudgetCategory
}

export type Expense = {
  id: string
  name: string
  amount: number
  date: string
  category: BudgetCategory
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
  isActive: boolean
  createdAt: string
}
