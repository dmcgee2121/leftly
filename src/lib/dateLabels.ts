import { parseDateOnly } from './dateOnly'

// Display-only date labels. Stored data stays in YYYY-MM-DD; these helpers only change what people read.
// The year is shown only when it differs from the current year (or when a range spans two years).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const RANGE_SEPARATOR = ' – '

function currentYear(now: Date) {
  return now.getFullYear()
}

// Full timestamps (for example createdAt) are shown as the local calendar day they happened on.
function parseTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

function monthDay(month: number, day: number) {
  return `${MONTHS[month - 1]} ${day}`
}

/** "Nov 16" this year, "Nov 16, 2025" in other years. Unparseable values are returned unchanged. */
export function formatDateLabel(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return ''
  const parts = value.length > 10 ? parseTimestamp(value) : parseDateOnly(value)
  if (!parts) return value
  const label = monthDay(parts.month, parts.day)
  return parts.year === currentYear(now) ? label : `${label}, ${parts.year}`
}

/** "Nov 16 – Nov 29" this year, "Nov 16 – Nov 29, 2025" in another year, "Dec 28, 2026 – Jan 10, 2027" across years. */
export function formatDateRangeLabel(startDate: string, endDate: string, now: Date = new Date()): string {
  const start = parseDateOnly(startDate.slice(0, 10))
  const end = parseDateOnly(endDate.slice(0, 10))
  if (!start || !end) return `${startDate} to ${endDate}`

  if (start.year !== end.year) {
    return `${monthDay(start.month, start.day)}, ${start.year}${RANGE_SEPARATOR}${monthDay(end.month, end.day)}, ${end.year}`
  }

  const range = `${monthDay(start.month, start.day)}${RANGE_SEPARATOR}${monthDay(end.month, end.day)}`
  return start.year === currentYear(now) ? range : `${range}, ${start.year}`
}
