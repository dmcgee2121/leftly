import { describe, expect, it } from 'vitest'
import { HISTORY_ACTIVITY_RESULT_LIMIT, normalizeHistorySearchQuery, searchHistoryActivity } from '../src/lib/historySearch'
import { bill, expense, snapshot } from './fixtures'

describe('History activity search', () => {
  it('keeps blank searches inactive and normalizes whitespace', () => {
    expect(normalizeHistorySearchQuery('  Whole   Foods  ')).toBe('whole foods')
    expect(searchHistoryActivity([snapshot({ bills: [bill({ name: 'Whole Foods' })] })], '   ').results).toEqual([])
    expect(searchHistoryActivity([snapshot({ bills: [bill({ name: 'Whole   Foods' })] })], 'whole foods').results).toHaveLength(1)
  })

  it('matches bill names and categories without case sensitivity', () => {
    const result = searchHistoryActivity([snapshot({ label: 'May period', bills: [bill({ name: 'ENTERGY', category: 'Utilities', isPaid: true, source: 'recurring', carriedOverFromPayPeriodId: 'old' })] })], 'utilities')
    expect(result.results[0]).toMatchObject({ kind: 'bill', name: 'ENTERGY', snapshotLabel: 'May period', context: ['Paid', 'Recurring', 'Carried over'] })
  })

  it('includes useful expense context', () => {
    const result = searchHistoryActivity([snapshot({ expenses: [expense({ name: 'Groceries', category: 'Food', source: 'recurring', isPlanned: true, setAsideForTemplateId: 'plan-1' })] })], 'groceries')
    expect(result.results[0]).toMatchObject({ kind: 'expense', category: 'Food', context: ['Recurring', 'Planned expense', 'Set-aside'] })
  })

  it('orders newer snapshots first, then later valid item dates', () => {
    const older = snapshot({ id: 'old', archivedAt: '2024-01-15T00:00:00.000Z', expenses: [expense({ id: 'old-expense', name: 'Food', date: '2024-01-14' })] })
    const newer = snapshot({ id: 'new', archivedAt: '2024-02-15T00:00:00.000Z', expenses: [expense({ id: 'early', name: 'Food', date: '2024-02-02' }), expense({ id: 'late', name: 'Food', date: '2024-02-10' })] })
    expect(searchHistoryActivity([older, newer], 'food').results.map((item) => item.itemId)).toEqual(['late', 'early', 'old-expense'])
  })

  it('handles malformed archived data safely and does not mutate inputs', () => {
    const malformed = snapshot({ id: 'bad', archivedAt: 'not-a-date', endDate: 'also-bad', bills: [bill({ id: 'blank', name: '  ' }), bill({ id: 'infinite', name: 'Food', amount: Number.POSITIVE_INFINITY }), bill({ id: 'usable', name: 'Food', dueDate: 'invalid-date', category: '' })] })
    const before = structuredClone(malformed)
    const results = searchHistoryActivity([malformed], 'food')
    expect(results.results).toHaveLength(1)
    expect(results.results[0]).toMatchObject({ itemId: 'usable', category: 'Uncategorized', date: null })
    expect(malformed).toEqual(before)
  })

  it('keeps duplicate item IDs in separate snapshots distinct', () => {
    const results = searchHistoryActivity([
      snapshot({ id: 'one', expenses: [expense({ id: 'duplicate', name: 'Coffee' })] }),
      snapshot({ id: 'two', expenses: [expense({ id: 'duplicate', name: 'Coffee' })] }),
    ], 'coffee').results
    expect(results).toHaveLength(2)
    expect(new Set(results.map((result) => result.key)).size).toBe(2)
  })

  it('limits matching results to 50', () => {
    const expenses = Array.from({ length: HISTORY_ACTIVITY_RESULT_LIMIT + 1 }, (_, index) => expense({ id: `expense-${index}`, name: 'Food', date: '2024-01-20' }))
    const result = searchHistoryActivity([snapshot({ expenses })], 'food')
    expect(result.results).toHaveLength(HISTORY_ACTIVITY_RESULT_LIMIT)
    expect(result.isLimited).toBe(true)
  })
})
