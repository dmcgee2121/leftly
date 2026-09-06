import { describe, expect, it } from 'vitest'
import { calculatePayPeriodTotals } from '../src/lib/budgetMath'
import { buildRecurringPreview, generateRecurringItems, getRecurringPeriodKey } from '../src/lib/recurring'
import { bill, expense, period, template } from './fixtures'

describe('active-period budget totals', () => {
  it('preserves bills, expenses, set-asides, safe-to-spend, leftover, zero, negative, and large values', () => {
    const result = calculatePayPeriodTotals({ ...period, income: 1000 }, [bill({ amount: 200, isPaid: true }), bill({ id: 'b2', amount: 300 })], [expense({ amount: 100 }), expense({ id: 'e2', amount: 50, setAsideForTemplateId: 't1' })])
    expect(result).toEqual({ totalBills: 500, paidBills: 200, unpaidBills: 300, totalExpenses: 150, totalSetAsides: 50, safeToSpend: 350, leftover: 350 })
    expect(calculatePayPeriodTotals({ ...period, income: 0 }, [], [])).toEqual({ totalBills: 0, paidBills: 0, unpaidBills: 0, totalExpenses: 0, totalSetAsides: 0, safeToSpend: 0, leftover: 0 })
    expect(calculatePayPeriodTotals({ ...period, income: 1 }, [bill({ amount: 100 })], []).leftover).toBe(-99)
    expect(calculatePayPeriodTotals({ ...period, income: 1_000_000 }, [bill({ amount: 1 })], [expense({ amount: 2 })]).safeToSpend).toBe(999997)
  })
})

describe('recurring and Bill Plan rules', () => {
  it('excludes inactive templates and separates planned expenses and set-asides', () => {
    const result = buildRecurringPreview({
      period,
      templates: [template(), template({ id: 'inactive', isActive: false }), template({ id: 'planned', kind: 'planned-expense', frequency: 'every-pay-period' }), template({ id: 'aside', setAsideEnabled: true, setAsideAmount: 25 })],
    })
    expect(result.bills.map((item) => item.templateId)).toEqual(['template-1', 'aside'])
    expect(result.plannedExpenses.map((item) => item.templateId)).toEqual(['planned'])
    expect(result.setAsides.map((item) => item.templateId)).toEqual(['aside'])
  })

  it('supports monthly clamping, weekly, biweekly, every-period, and one-time range rules', () => {
    const clamped = [
      ['2024-02-01', '2024-02-29', 29, '2024-02-29'],
      ['2024-04-01', '2024-04-30', 31, '2024-04-30'],
      ['2024-06-01', '2024-06-30', 30, '2024-06-30'],
    ] as const
    for (const [startDate, endDate, dueDay, expected] of clamped) {
      expect(buildRecurringPreview({ period: { ...period, startDate, endDate }, templates: [template({ dueDay })] }).bills[0].dateLabel).toBe(expected)
    }
    const weekly = buildRecurringPreview({ period: { ...period, startDate: '2024-01-15', endDate: '2024-01-28' }, templates: [template({ frequency: 'weekly', scheduleType: 'weekly', dayOfWeek: 1 })] })
    expect(weekly.bills.map((item) => item.dateLabel)).toEqual(['2024-01-15', '2024-01-22'])
    const biweekly = buildRecurringPreview({ period: { ...period, startDate: '2024-01-22', endDate: '2024-02-04' }, templates: [template({ frequency: 'biweekly', scheduleType: 'biweekly', anchorDate: '2024-01-08' })] })
    expect(biweekly.bills.map((item) => item.dateLabel)).toEqual(['2024-01-22'])
    expect(buildRecurringPreview({ period, templates: [template({ frequency: 'every-pay-period' })] }).bills[0].dateLabel).toBe(period.startDate)
    expect(buildRecurringPreview({ period, templates: [template({ frequency: 'one-time', anchorDate: '2024-01-20' })] }).bills).toHaveLength(1)
    expect(buildRecurringPreview({ period, templates: [template({ frequency: 'one-time', anchorDate: '2024-02-20' })] }).bills).toHaveLength(0)
  })

  it('deduplicates generated items and does not mutate inputs', () => {
    const templates = [template({ frequency: 'every-pay-period' })]
    const existing = [bill({ source: 'recurring', templateId: 'template-1', generatedForPeriodId: getRecurringPeriodKey(period), dueDate: period.startDate })]
    const result = generateRecurringItems({ templates, period, existingBills: existing })
    expect(result.bills).toHaveLength(1)
    expect(result.templates).not.toBe(templates)
    expect(templates[0].isActive).toBe(true)
  })
})
