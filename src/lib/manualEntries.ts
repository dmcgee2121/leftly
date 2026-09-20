import type { Bill, BudgetCategory, Expense } from '../types/budget'

export type ManualBillDraft = {
  name: string
  amount: string
  dueDate: string
  category: BudgetCategory
}

export type ManualExpenseDraft = {
  name: string
  amount: string
  date: string
  category: BudgetCategory
}

type EntryResult<T> = { ok: true; item: T } | { ok: false; error: string }

export function createManualBill(
  draft: ManualBillDraft,
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): EntryResult<Bill> {
  const amount = Number(draft.amount)

  if (!draft.name.trim()) return { ok: false, error: 'Bill name is required.' }
  if (!draft.dueDate) return { ok: false, error: 'Due date is required.' }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Amount must be greater than 0.' }

  return {
    ok: true,
    item: {
      id,
      name: draft.name.trim(),
      amount,
      dueDate: draft.dueDate,
      isPaid: false,
      paidDate: null,
      category: draft.category,
      source: 'manual',
      createdAt,
    },
  }
}

export function createManualExpense(
  draft: ManualExpenseDraft,
  id = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
): EntryResult<Expense> {
  const amount = Number(draft.amount)

  if (!draft.name.trim()) return { ok: false, error: 'Expense name is required.' }
  if (!draft.date) return { ok: false, error: 'Date is required.' }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Amount must be greater than 0.' }

  return {
    ok: true,
    item: {
      id,
      name: draft.name.trim(),
      amount,
      date: draft.date,
      category: draft.category,
      source: 'manual',
      createdAt,
    },
  }
}
