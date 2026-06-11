export type PayCadence = 'weekly' | 'biweekly' | 'monthly'

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
}

export type Expense = {
  id: string
  name: string
  amount: number
  date: string
}
