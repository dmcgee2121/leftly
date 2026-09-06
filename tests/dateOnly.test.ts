import { describe, expect, it } from 'vitest'
import { addDateOnlyDays, deriveFollowingDateOnlyRange, deriveNextDateOnlyRange, getInclusiveDateDuration, parseDateOnly } from '../src/lib/dateOnly'

describe('date-only pay-period math', () => {
  it('parses valid dates and rejects malformed, impossible, and non-date values', () => {
    expect(parseDateOnly('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(parseDateOnly('2023-02-29')).toBeNull()
    expect(parseDateOnly('2024-13-01')).toBeNull()
    expect(parseDateOnly('2024-1-01')).toBeNull()
  })

  it('handles leap, month, year, and DST-adjacent boundaries as UTC date-only values', () => {
    expect(addDateOnlyDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDateOnlyDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDateOnlyDays('2024-12-31', 1)).toBe('2025-01-01')
    expect(addDateOnlyDays('2024-03-10', -1)).toBe('2024-03-09')
    expect(addDateOnlyDays('2024-11-03', 1)).toBe('2024-11-04')
  })

  it('uses inclusive durations and derives repeated future periods from the prior end', () => {
    expect(getInclusiveDateDuration('2024-01-15', '2024-01-28')).toBe(14)
    expect(getInclusiveDateDuration('2024-01-31', '2024-02-01')).toBe(2)
    const next = deriveNextDateOnlyRange('2024-01-15', '2024-01-28')
    expect(next).toEqual({ startDate: '2024-01-29', endDate: '2024-02-11', duration: 14 })
    expect(deriveFollowingDateOnlyRange(next!, 14)).toEqual({ startDate: '2024-02-12', endDate: '2024-02-25', duration: 14 })
    expect(deriveNextDateOnlyRange('bad', '2024-01-01')).toBeNull()
  })
})
