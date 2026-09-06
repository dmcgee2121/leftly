import { describe, expect, it } from 'vitest'
import { buildForecast, parseForecastIncome } from '../src/lib/forecast'
import { buildPlanningHorizon } from '../src/lib/planningHorizon'
import { bill, period, template } from './fixtures'

describe('Phase 7 forecast', () => {
  it('handles unavailable periods and formatted income without machine-date dependence', () => {
    expect(buildForecast({ period: null, templates: [] }).available).toBe(false)
    expect(buildForecast({ period: { ...period, startDate: 'bad' }, templates: [] }).available).toBe(false)
    expect(parseForecastIncome('$1,234.50')).toBe(1234.5)
    expect(parseForecastIncome('0')).toBe(0)
    expect(parseForecastIncome('$1,23')).toBeNull()
    expect(parseForecastIncome('')).toBeNull()
    expect(buildForecast({ period: { ...period, income: 0 }, templates: [] }).expectedIncome).toBe(0)
  })

  it('projects bills, excludes carryover by default, includes it when requested, and uses cents', () => {
    const templates = [template({ amount: 10.1, frequency: 'every-pay-period' }), template({ id: 'small', amount: 0.1, frequency: 'every-pay-period' })]
    const unpaid = [bill({ id: 'carry', name: 'Carry', amount: 5.05, isPaid: false }), bill({ id: 'carry-2', name: 'Carry 2', amount: 0.05, isPaid: false }), bill({ id: 'paid', amount: 9, isPaid: true })]
    const baseline = buildForecast({ period, templates, unpaidBills: unpaid, expectedIncome: 100 })
    expect(baseline.forecastStart).toBe('2024-01-29')
    expect(baseline.scheduledBillTotal).toBe(10.2)
    expect(baseline.potentialCarryoverTotal).toBe(5.1)
    expect(baseline.projectedLeft).toBe(89.8)
    expect(buildForecast({ period, templates, unpaidBills: unpaid, expectedIncome: 100, includeCarryover: true }).projectedLeft).toBe(84.7)
    expect(baseline.status).toBe('cushion')
    expect(buildForecast({ period, templates, expectedIncome: 10.2 }).status).toBe('allocated')
    expect(buildForecast({ period, templates, expectedIncome: 10 }).status).toBe('shortfall')
    expect(unpaid[0].isPaid).toBe(false)
  })
})

describe('Phase 10 planning horizon', () => {
  it('reports unavailable/empty states and produces chronological periods with plan filtering', () => {
    expect(buildPlanningHorizon({ activePayPeriod: null, templates: [] }).available).toBe(false)
    expect(buildPlanningHorizon({ activePayPeriod: period, templates: [] })).toMatchObject({ available: true, emptyReason: 'no-active-templates', periods: [] })
    const templates = [
      template({ planName: 'Main', amount: 10 }),
      template({ id: 'planned', planName: 'Other', kind: 'planned-expense', frequency: 'every-pay-period', amount: 5 }),
      template({ id: 'aside', planName: 'Main', setAsideEnabled: true, setAsideAmount: 2 }),
      template({ id: 'inactive', isActive: false }),
    ]
    const result = buildPlanningHorizon({ activePayPeriod: period, templates, horizonLength: 3, planFilter: 'Main' })
    expect(result.available).toBe(true)
    expect(result.periods).toHaveLength(3)
    expect(result.periods.map((item) => item.startDate)).toEqual(['2024-01-29', '2024-02-12', '2024-02-26'])
    expect(result.periods.every((item) => item.occurrences.every((occurrence) => occurrence.planName === 'Main'))).toBe(true)
    expect(result.periods[0].setAsidesTotal).toBe(2)
    expect(templates).toHaveLength(4)
    const six = buildPlanningHorizon({ activePayPeriod: period, templates, horizonLength: 6 })
    expect(six.periods).toHaveLength(6)
    expect(six.periods[5].startDate).toBe('2024-04-08')
    const zeroOccurrence = buildPlanningHorizon({ activePayPeriod: period, templates: [template({ dueDay: 31 })], horizonLength: 6 })
    expect(zeroOccurrence.periods.some((item) => item.occurrenceCount === 0)).toBe(true)
  })
})
