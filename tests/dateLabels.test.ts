import { describe, expect, it } from 'vitest'
import { formatDateLabel, formatDateRangeLabel } from '../src/lib/dateLabels'

const now = new Date(2026, 10, 15) // Nov 15, 2026 (local time)

describe('friendly date labels', () => {
  it('drops the year for the current year and keeps it otherwise', () => {
    expect(formatDateLabel('2026-11-16', now)).toBe('Nov 16')
    expect(formatDateLabel('2025-03-01', now)).toBe('Mar 1, 2025')
    expect(formatDateLabel('2027-01-09', now)).toBe('Jan 9, 2027')
  })

  it('accepts timestamps and leaves bad or empty values alone', () => {
    expect(formatDateLabel('2026-11-16T12:00:00', now)).toBe('Nov 16')
    expect(formatDateLabel('not a date', now)).toBe('not a date')
    expect(formatDateLabel('2026-02-30', now)).toBe('2026-02-30')
    expect(formatDateLabel('', now)).toBe('')
    expect(formatDateLabel(null, now)).toBe('')
  })

  it('formats pay-period ranges', () => {
    expect(formatDateRangeLabel('2026-11-16', '2026-11-29', now)).toBe('Nov 16 – Nov 29')
    expect(formatDateRangeLabel('2026-11-30', '2026-12-13', now)).toBe('Nov 30 – Dec 13')
    expect(formatDateRangeLabel('2025-11-16', '2025-11-29', now)).toBe('Nov 16 – Nov 29, 2025')
    expect(formatDateRangeLabel('2026-12-28', '2027-01-10', now)).toBe('Dec 28, 2026 – Jan 10, 2027')
  })

  it('falls back to the raw values when a range cannot be parsed', () => {
    expect(formatDateRangeLabel('bad', '2026-11-29', now)).toBe('bad to 2026-11-29')
  })
})
