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

  if (!draft.name.trim()) return { ok: false, error: 'Enter a bill name.' }
  if (!draft.dueDate) return { ok: false, error: 'Choose a due date.' }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than $0.' }

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

  if (!draft.name.trim()) return { ok: false, error: 'Enter an expense name.' }
  if (!draft.date) return { ok: false, error: 'Choose a date.' }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than $0.' }

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
