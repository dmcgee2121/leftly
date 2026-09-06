import { describe, expect, it } from 'vitest'
import { buildPayPeriodInsights } from '../src/lib/insights'
import { bill, expense, snapshot } from './fixtures'

function periodSnapshot(index: number) {
  const start = `2024-0${index + 1}-01`
  const end = `2024-0${index + 1}-14`
  return snapshot({
    id: `s-${index}`, label: `${start} - ${end}`, startDate: start, endDate: end, income: 1000 + index * 100,
    bills: [bill({ id: `b-${index}`, amount: 100, isPaid: index !== 2, paidDate: index === 1 ? `${start.slice(0, 7)}-20` : null, dueDate: `${start.slice(0, 7)}-10`, carriedOverFromPayPeriodId: index === 3 ? 'prior' : undefined })],
    expenses: [expense({ id: `e-${index}`, amount: 50, category: 'Food' }), expense({ id: `a-${index}`, amount: 10, category: 'Housing', setAsideForTemplateId: 't' })],
    totals: { totalBills: 100, paidBills: index !== 2 ? 100 : 0, unpaidBills: index === 2 ? 100 : 0, totalExpenses: 60, totalSetAsides: 10, safeToSpend: 840 + index * 100, leftover: 840 + index * 100 },
  })
}

describe('Phase 8 archived pay-period insights', () => {
  it('handles empty, single, comparison, and range selections with set-aside exclusion', () => {
    expect(buildPayPeriodInsights([], 'all')).toMatchObject({ state: 'empty', selectedCount: 0 })
    expect(buildPayPeriodInsights([periodSnapshot(0)], 'all')).toMatchObject({ state: 'single', selectedCount: 1, averages: { spendingExcludingSetAsides: 50, setAsides: 10 } })
    expect(buildPayPeriodInsights([periodSnapshot(0), periodSnapshot(1)], 'all')).toMatchObject({ state: 'comparison', selectedCount: 2, comparison: { metrics: { income: { latest: 1100, previous: 1000, direction: 'up' } } } })
    expect(buildPayPeriodInsights([periodSnapshot(0), periodSnapshot(1), periodSnapshot(2), periodSnapshot(3)], 3)).toMatchObject({ state: 'range', selectedCount: 3, selectedSnapshots: [{ id: 's-1' }, { id: 's-2' }, { id: 's-3' }] })
  })

  it('aggregates categories, classifies bill timing/carryover, and excludes malformed snapshots', () => {
    const valid = periodSnapshot(0)
    valid.bills.push(bill({ id: 'late', name: 'Late bill', isPaid: true, dueDate: '2024-01-05', paidDate: '2024-01-20' }))
    valid.bills.push(bill({ id: 'unknown', name: 'Unknown date', isPaid: true, dueDate: 'bad', paidDate: 'bad' }))
    const result = buildPayPeriodInsights([valid, snapshot({ id: 'bad', startDate: 'bad', endDate: '2024-01-02' })], 'all')
    expect(result.excludedSnapshotCount).toBe(1)
    expect(result.categories[0]).toMatchObject({ category: 'Food', total: 50, count: 1 })
    expect(result.billFollowThrough.paidAfterDue.count).toBe(1)
    expect(result.billFollowThrough.timingDateUnavailable.count).toBe(1)
  })

  it('supports Last 3/6/12/All range selection and previous-zero comparisons', () => {
    const snapshots = Array.from({ length: 12 }, (_, index) => periodSnapshot(index % 4))
      .map((item, index) => ({ ...item, id: `range-${index}`, startDate: `2023-${String((index % 12) + 1).padStart(2, '0')}-01`, endDate: `2023-${String((index % 12) + 1).padStart(2, '0')}-14` }))
    expect(buildPayPeriodInsights(snapshots, 3).selectedCount).toBe(3)
    expect(buildPayPeriodInsights(snapshots, 6).selectedCount).toBe(6)
    expect(buildPayPeriodInsights(snapshots, 12).selectedCount).toBe(12)
    expect(buildPayPeriodInsights(snapshots, 'all').selectedCount).toBe(12)
    const previousZero = periodSnapshot(0)
    previousZero.totals.leftover = 0
    const comparison = buildPayPeriodInsights([previousZero, periodSnapshot(1)], 'all')
    expect(comparison.comparison?.metrics.leftover.previous).toBe(0)
  })
})
