import type { Bill, BudgetPeriod, Expense, PayPeriodTotals } from '../types/budget'

export function calculatePayPeriodTotals(period: BudgetPeriod, bills: readonly Bill[], expenses: readonly Expense[]): PayPeriodTotals {
  const totalBills = bills.reduce((sum, bill) => sum + bill.amount, 0)
  const paidBills = bills.filter((bill) => bill.isPaid).reduce((sum, bill) => sum + bill.amount, 0)
  const unpaidBills = totalBills - paidBills
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalSetAsides = expenses.filter((expense) => expense.setAsideForTemplateId).reduce((sum, expense) => sum + expense.amount, 0)
  const safeToSpend = period.income - totalBills - totalExpenses
  const leftover = period.income - unpaidBills - paidBills - totalExpenses

  return { totalBills, paidBills, unpaidBills, totalExpenses, totalSetAsides, safeToSpend, leftover }
}
