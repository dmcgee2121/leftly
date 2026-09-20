import { describe, expect, it } from 'vitest'
import { buildRecentActivity } from '../src/lib/recentActivity'
import { bill, expense } from './fixtures'

describe('Phase 19 recent activity', () => {
  it('combines bills and expenses by recorded creation time', () => {
    const result = buildRecentActivity(
      [bill({ id: 'bill-new', name: 'Phone', createdAt: '2026-09-20T15:00:00.000Z' })],
      [
        expense({ id: 'expense-old', name: 'Lunch', createdAt: '2026-09-19T15:00:00.000Z' }),
        expense({ id: 'expense-new', name: 'Gas', createdAt: '2026-09-20T16:00:00.000Z' }),
      ],
    )

    expect(result.map((activity) => [activity.kind, activity.item.id])).toEqual([
      ['expense', 'expense-new'],
      ['bill', 'bill-new'],
      ['expense', 'expense-old'],
    ])
  })

  it('uses due/date semantics as a safe fallback, limits results, and does not mutate inputs', () => {
    const bills = [bill({ id: 'bill', name: 'Rent', createdAt: undefined, dueDate: '2026-09-22' })]
    const expenses = [expense({ id: 'expense', name: 'Market', createdAt: undefined, date: '2026-09-21' })]
    const billsCopy = structuredClone(bills)
    const expensesCopy = structuredClone(expenses)

    expect(buildRecentActivity(bills, expenses, 1).map((activity) => activity.item.id)).toEqual(['bill'])
    expect(bills).toEqual(billsCopy)
    expect(expenses).toEqual(expensesCopy)
  })
})
