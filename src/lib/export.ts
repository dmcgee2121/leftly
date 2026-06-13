import type { Bill, BudgetCategory, BudgetPeriod, Expense, PayPeriodSnapshot } from '../types/budget'

type CsvCell = string | number | boolean | null | undefined

function toCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function buildCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(value: string) {
  return value || ''
}

function getPeriodLabel(period: BudgetPeriod | null, snapshotLabel?: string) {
  if (snapshotLabel) {
    return snapshotLabel
  }

  if (!period) {
    return 'Current period'
  }

  return `${period.startDate} - ${period.endDate}`
}

function getRecurringLabelForBill(bill: Bill) {
  return bill.source === 'recurring' ? 'Recurring' : ''
}

function getRecurringLabelForExpense(expense: Expense) {
  if (expense.setAsideForTemplateId) {
    return 'Set-aside'
  }

  if (expense.isPlanned) {
    return 'Planned'
  }

  return expense.source === 'recurring' ? 'Recurring' : ''
}

function getBillRows(bills: Bill[]) {
  return bills.map((bill) => [
    'Bill',
    bill.name,
    formatCurrency(bill.amount),
    bill.category,
    bill.dueDate,
    bill.isPaid ? 'Paid' : 'Unpaid',
    bill.paidDate ?? '',
    bill.source ?? 'manual',
    getRecurringLabelForBill(bill),
  ])
}

function getExpenseRows(expenses: Expense[]) {
  return expenses.map((expense) => [
    'Expense',
    expense.name,
    formatCurrency(expense.amount),
    expense.category,
    formatDate(expense.date),
    expense.isPlanned ? 'Planned' : 'Manual',
    expense.setAsideForTemplateId ? 'Set-aside' : '',
    expense.source ?? 'manual',
    getRecurringLabelForExpense(expense),
  ])
}

function getCategoryRows(bills: Bill[], expenses: Expense[]) {
  const categoryTotals = new Map<BudgetCategory, number>()

  for (const bill of bills) {
    categoryTotals.set(bill.category, (categoryTotals.get(bill.category) ?? 0) + bill.amount)
  }

  for (const expense of expenses) {
    categoryTotals.set(expense.category, (categoryTotals.get(expense.category) ?? 0) + expense.amount)
  }

  return [...categoryTotals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, total]) => ['Category total', category, formatCurrency(total)])
}

export function escapeCsvValue(value: CsvCell) {
  return toCsvCell(value)
}

export function createCurrentPeriodCsv(params: {
  payPeriod: BudgetPeriod | null
  bills: Bill[]
  expenses: Expense[]
  categoryTotals: Array<{ category: BudgetCategory; total: number }>
  totals: {
    totalPlannedBills: number
    paidBills: number
    unpaidBills: number
    totalExpenses: number
    totalSetAside: number
    safeToSpend: number
    leftover: number
  }
}) {
  const { payPeriod, bills, expenses, categoryTotals, totals } = params
  const rows: CsvCell[][] = [
    ['Section', 'Field', 'Value', 'Details'],
    ['Summary', 'Pay period label', getPeriodLabel(payPeriod), ''],
    ['Summary', 'Start date', payPeriod?.startDate ?? '', ''],
    ['Summary', 'End date', payPeriod?.endDate ?? '', ''],
    ['Summary', 'Cadence', payPeriod?.cadence ?? '', ''],
    ['Summary', 'Income', formatCurrency(payPeriod?.income ?? 0), ''],
    ['Summary', 'Total bills', formatCurrency(totals.totalPlannedBills), ''],
    ['Summary', 'Paid bills', formatCurrency(totals.paidBills), ''],
    ['Summary', 'Unpaid bills', formatCurrency(totals.unpaidBills), ''],
    ['Summary', 'Expenses', formatCurrency(totals.totalExpenses), ''],
    ['Summary', 'Set-asides', formatCurrency(totals.totalSetAside), ''],
    ['Summary', 'Safe to spend', formatCurrency(totals.safeToSpend), ''],
    ['Summary', 'Leftover', formatCurrency(totals.leftover), ''],
    [],
    ['Bills', 'Name', 'Amount', 'Category', 'Due date', 'Paid status', 'Paid date', 'Source', 'Recurring label'],
    ...getBillRows(bills),
    [],
    ['Expenses', 'Name', 'Amount', 'Category', 'Date', 'Planned status', 'Set-aside status', 'Source', 'Recurring label'],
    ...getExpenseRows(expenses),
    [],
    ['Category totals', 'Category', 'Total', '', '', '', '', '', ''],
    ...categoryTotals
      .sort((a, b) => a.category.localeCompare(b.category))
      .map((item) => ['Category totals', item.category, formatCurrency(item.total)]),
  ]

  return buildCsv(rows)
}

export function createHistorySnapshotCsv(snapshot: PayPeriodSnapshot) {
  const categoryRows = getCategoryRows(snapshot.bills, snapshot.expenses)
  const rows: CsvCell[][] = [
    ['Section', 'Field', 'Value', 'Details'],
    ['Summary', 'Pay period label', snapshot.label, ''],
    ['Summary', 'Start date', snapshot.startDate, ''],
    ['Summary', 'End date', snapshot.endDate, ''],
    ['Summary', 'Cadence', snapshot.cadence, ''],
    ['Summary', 'Income', formatCurrency(snapshot.income), ''],
    ['Summary', 'Total bills', formatCurrency(snapshot.totals.totalBills), ''],
    ['Summary', 'Paid bills', formatCurrency(snapshot.totals.paidBills), ''],
    ['Summary', 'Unpaid bills', formatCurrency(snapshot.totals.unpaidBills), ''],
    ['Summary', 'Expenses', formatCurrency(snapshot.totals.totalExpenses), ''],
    ['Summary', 'Set-asides', formatCurrency(snapshot.totals.totalSetAsides), ''],
    ['Summary', 'Safe to spend', formatCurrency(snapshot.totals.safeToSpend), ''],
    ['Summary', 'Leftover', formatCurrency(snapshot.totals.leftover), ''],
    ['Summary', 'Archived at', snapshot.archivedAt, ''],
    [],
    ['Bills', 'Name', 'Amount', 'Category', 'Due date', 'Paid status', 'Paid date', 'Source', 'Recurring label'],
    ...getBillRows(snapshot.bills),
    [],
    ['Expenses', 'Name', 'Amount', 'Category', 'Date', 'Planned status', 'Set-aside status', 'Source', 'Recurring label'],
    ...getExpenseRows(snapshot.expenses),
    [],
    ['Category totals', 'Category', 'Total', '', '', '', '', '', ''],
    ...categoryRows,
  ]

  return buildCsv(rows)
}

export function createAllHistoryCsv(history: PayPeriodSnapshot[]) {
  const rows: CsvCell[][] = [
    ['Section', 'Snapshot', 'Label', 'Field', 'Value', 'Details'],
  ]

  for (const snapshot of history) {
    rows.push(
      ['Summary', snapshot.id, snapshot.label, 'Start date', snapshot.startDate, ''],
      ['Summary', snapshot.id, snapshot.label, 'End date', snapshot.endDate, ''],
      ['Summary', snapshot.id, snapshot.label, 'Cadence', snapshot.cadence, ''],
      ['Summary', snapshot.id, snapshot.label, 'Income', formatCurrency(snapshot.income), ''],
      ['Summary', snapshot.id, snapshot.label, 'Total bills', formatCurrency(snapshot.totals.totalBills), ''],
      ['Summary', snapshot.id, snapshot.label, 'Paid bills', formatCurrency(snapshot.totals.paidBills), ''],
      ['Summary', snapshot.id, snapshot.label, 'Unpaid bills', formatCurrency(snapshot.totals.unpaidBills), ''],
      ['Summary', snapshot.id, snapshot.label, 'Expenses', formatCurrency(snapshot.totals.totalExpenses), ''],
      ['Summary', snapshot.id, snapshot.label, 'Set-asides', formatCurrency(snapshot.totals.totalSetAsides), ''],
      ['Summary', snapshot.id, snapshot.label, 'Safe to spend', formatCurrency(snapshot.totals.safeToSpend), ''],
      ['Summary', snapshot.id, snapshot.label, 'Leftover', formatCurrency(snapshot.totals.leftover), ''],
      ['Summary', snapshot.id, snapshot.label, 'Archived at', snapshot.archivedAt, ''],
      [],
      ['Bills', snapshot.id, snapshot.label, 'Name', 'Amount', 'Category'],
      ...snapshot.bills.map((bill) => [
        'Bills',
        snapshot.id,
        snapshot.label,
        bill.name,
        formatCurrency(bill.amount),
        `${bill.category} | ${bill.dueDate} | ${bill.isPaid ? 'Paid' : 'Unpaid'} | ${bill.source ?? 'manual'}${bill.source === 'recurring' ? ' | Recurring' : ''}`,
      ]),
      [],
      ['Expenses', snapshot.id, snapshot.label, 'Name', 'Amount', 'Category'],
      ...snapshot.expenses.map((expense) => [
        'Expenses',
        snapshot.id,
        snapshot.label,
        expense.name,
        formatCurrency(expense.amount),
        `${expense.category} | ${expense.date} | ${expense.isPlanned ? 'Planned' : 'Manual'}${expense.setAsideForTemplateId ? ' | Set-aside' : ''} | ${expense.source ?? 'manual'}${expense.source === 'recurring' ? ' | Recurring' : ''}`,
      ]),
      [],
    )
  }

  return buildCsv(rows)
}

export function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}
