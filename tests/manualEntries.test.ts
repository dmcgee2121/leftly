import { describe, expect, it } from 'vitest'
import { createManualBill, createManualExpense } from '../src/lib/manualEntries'

describe('manual entry creators', () => {
  it('creates the unchanged manual bill shape used by quick and management entry', () => {
    const result = createManualBill(
      { name: '  Car repair  ', amount: '125.50', dueDate: '2026-09-22', category: 'Transportation' },
      'bill-id',
      '2026-09-20T12:00:00.000Z',
    )

    expect(result).toEqual({
      ok: true,
      item: {
        id: 'bill-id',
        name: 'Car repair',
        amount: 125.5,
        dueDate: '2026-09-22',
        isPaid: false,
        paidDate: null,
        category: 'Transportation',
        source: 'manual',
        createdAt: '2026-09-20T12:00:00.000Z',
      },
    })
  })

  it('preserves untouched default details in expense storage', () => {
    const result = createManualExpense(
      { name: 'Lunch', amount: '14', date: '2026-09-20', category: 'Food' },
      'expense-id',
      '2026-09-20T12:00:00.000Z',
    )

    expect(result).toEqual({
      ok: true,
      item: {
        id: 'expense-id',
        name: 'Lunch',
        amount: 14,
        date: '2026-09-20',
        category: 'Food',
        source: 'manual',
        createdAt: '2026-09-20T12:00:00.000Z',
      },
    })
  })

  it('rejects invalid drafts before an item can be submitted', () => {
    expect(createManualBill({ name: '', amount: '10', dueDate: '2026-09-22', category: 'Other' })).toEqual({ ok: false, error: 'Bill name is required.' })
    expect(createManualExpense({ name: 'Lunch', amount: '0', date: '2026-09-20', category: 'Food' })).toEqual({ ok: false, error: 'Amount must be greater than 0.' })
  })
})
