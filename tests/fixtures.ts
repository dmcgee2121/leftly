import type { Bill, BudgetPeriod, Expense, PayPeriodSnapshot, RecurringItemTemplate } from '../src/types/budget'

export const period: BudgetPeriod = { cadence: 'biweekly', startDate: '2024-01-15', endDate: '2024-01-28', income: 2000 }

export function bill(overrides: Partial<Bill> = {}): Bill {
  return { id: 'bill-1', name: 'Rent', amount: 500, dueDate: '2024-01-20', isPaid: false, paidDate: null, category: 'Housing', ...overrides }
}

export function expense(overrides: Partial<Expense> = {}): Expense {
  return { id: 'expense-1', name: 'Coffee', amount: 4.5, date: '2024-01-20', category: 'Food', source: 'manual', ...overrides }
}

export function template(overrides: Partial<RecurringItemTemplate> = {}): RecurringItemTemplate {
  return { id: 'template-1', name: 'Internet', amount: 80, category: 'Utilities', kind: 'bill', frequency: 'monthly', dueDay: 15, isActive: true, createdAt: '2024-01-01T00:00:00.000Z', ...overrides }
}

export function snapshot(overrides: Partial<PayPeriodSnapshot> = {}): PayPeriodSnapshot {
  return {
    id: 'snapshot-1', label: 'Jan 1 - Jan 14', cadence: 'biweekly', startDate: '2024-01-01', endDate: '2024-01-14', income: 2000,
    bills: [], expenses: [], categoryTargets: {}, totals: { totalBills: 0, paidBills: 0, unpaidBills: 0, totalExpenses: 0, totalSetAsides: 0, safeToSpend: 2000, leftover: 2000 },
    createdAt: '2024-01-15T00:00:00.000Z', archivedAt: '2024-01-15T00:00:00.000Z', ...overrides,
  }
}
