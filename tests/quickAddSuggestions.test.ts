import { describe, expect, it } from 'vitest'
import { buildQuickAddSuggestions } from '../src/lib/quickAddSuggestions'
import { expense, snapshot } from './fixtures'

describe('Phase 11 Quick Add suggestions', () => {
  it('prioritizes current expenses, deduplicates normalized identities, and preserves distinct categories', () => {
    const active = [
      expense({ id: 'current', name: '  Walmart  ', amount: 58.1, category: 'Personal', date: '2024-02-01' }),
      expense({ id: 'food', name: 'Walmart', amount: 20, category: 'Food', date: '2024-01-31' }),
      expense({ id: 'recurring', source: 'recurring' }),
      expense({ id: 'planned', isPlanned: true }),
      expense({ id: 'aside', setAsideForTemplateId: 'template-1' }),
      expense({ id: 'blank', name: '   ' }),
      expense({ id: 'nan', amount: Number.NaN }),
    ]
    const history = [snapshot({ expenses: [expense({ id: 'old', name: 'walmart', amount: 42.75, category: 'Personal', date: '2024-01-10' }), expense({ id: 'history', name: 'Bus', amount: 3, category: 'Transportation', date: '2024-01-11' })] })]
    const result = buildQuickAddSuggestions({ activeExpenses: active, payPeriodHistory: history, currentCategories: ['Food', 'Personal', 'Transportation'] })
    expect(result.map((item) => [item.name.trim(), item.category, item.amount])).toEqual([['Walmart', 'Personal', 58.1], ['Walmart', 'Food', 20], ['Bus', 'Transportation', 3]])
    expect(result[0].source).toBe('current-period')
  })

  it('skips removed categories, handles malformed dates, limits to six, and does not mutate inputs', () => {
    const active = Array.from({ length: 7 }, (_, index) => expense({ id: `e-${index}`, name: `Item ${index}`, amount: index + 1, date: index === 0 ? 'not-a-date' : `2024-01-${String(index + 1).padStart(2, '0')}` }))
    const history = [snapshot({ startDate: 'bad', endDate: 'also-bad', expenses: [expense({ name: 'Removed', category: 'Deleted', date: 'bad' })] })]
    const activeCopy = structuredClone(active)
    const historyCopy = structuredClone(history)
    const result = buildQuickAddSuggestions({ activeExpenses: active, payPeriodHistory: history, currentCategories: ['Food'] })
    expect(result).toHaveLength(6)
    expect(result.some((item) => item.name === 'Removed')).toBe(false)
    expect(active).toEqual(activeCopy)
    expect(history).toEqual(historyCopy)
  })

  it('returns archived manual suggestions after rollover and lets the newest eligible history occurrence win', () => {
    const history = [
      snapshot({ id: 'new', label: 'Feb 1 - Feb 14', startDate: '2024-02-01', endDate: '2024-02-14', expenses: [expense({ name: 'Market', amount: 12, date: '2024-02-13' })] }),
      snapshot({ id: 'old', label: 'Jan 15 - Jan 28', startDate: '2024-01-15', endDate: '2024-01-28', expenses: [expense({ name: 'Market', amount: 9, date: '2024-01-20' })] }),
    ]
    const result = buildQuickAddSuggestions({ activeExpenses: [], payPeriodHistory: history, currentCategories: ['Food'] })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ name: 'Market', amount: 12, source: 'history', sourcePeriodLabel: 'Feb 1 - Feb 14' })
  })
})
