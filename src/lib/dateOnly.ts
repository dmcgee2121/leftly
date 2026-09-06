export type DateOnlyParts = { year: number; month: number; day: number }

export type DateOnlyRange = {
  startDate: string
  endDate: string
  duration: number
}

export function parseDateOnly(value: string): DateOnlyParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day }
}

function toUtcDate(parts: DateOnlyParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

export function formatDateOnly(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function addDateOnlyDays(value: string, days: number) {
  const parts = parseDateOnly(value)
  if (!parts || !Number.isInteger(days)) return null
  const date = toUtcDate(parts)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDateOnly(date)
}

export function getInclusiveDateDuration(startDate: string, endDate: string) {
  const start = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)
  if (!start || !end) return null

  const duration = Math.round((Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000) + 1
  return duration > 0 ? duration : null
}

export function deriveNextDateOnlyRange(startDate: string, endDate: string): DateOnlyRange | null {
  const duration = getInclusiveDateDuration(startDate, endDate)
  const nextStart = addDateOnlyDays(endDate, 1)
  if (!duration || !nextStart) return null
  const nextEnd = addDateOnlyDays(nextStart, duration - 1)
  if (!nextEnd) return null
  return { startDate: nextStart, endDate: nextEnd, duration }
}

export function deriveFollowingDateOnlyRange(previous: Pick<DateOnlyRange, 'endDate'>, duration: number): DateOnlyRange | null {
  if (!Number.isInteger(duration) || duration <= 0) return null
  const startDate = addDateOnlyDays(previous.endDate, 1)
  if (!startDate) return null
  const endDate = addDateOnlyDays(startDate, duration - 1)
  if (!endDate) return null
  return { startDate, endDate, duration }
}
