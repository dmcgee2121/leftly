// Decides when Overview gently suggests saving a backup file.
// Shown only after at least one finished paycheck, when there is no backup from the last 30 days,
// and not while the person has chosen "Later" (30 days).

export const BACKUP_REMINDER_SNOOZE_KEY = 'leftly.backupReminderSnoozedUntil'
export const BACKUP_REMINDER_INTERVAL_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export function shouldShowBackupReminder(params: {
  archivedPayPeriods: number
  lastBackupAt?: string | null
  snoozedUntil?: string | null
  now?: Date
}) {
  const now = (params.now ?? new Date()).getTime()
  if (params.archivedPayPeriods < 1) return false

  const snoozedUntil = params.snoozedUntil ? Date.parse(params.snoozedUntil) : NaN
  if (Number.isFinite(snoozedUntil) && snoozedUntil > now) return false

  const lastBackup = params.lastBackupAt ? Date.parse(params.lastBackupAt) : NaN
  if (!Number.isFinite(lastBackup)) return true
  return now - lastBackup >= BACKUP_REMINDER_INTERVAL_DAYS * DAY_MS
}

export function describeLastBackup(lastBackupAt?: string | null, now = new Date()) {
  const lastBackup = lastBackupAt ? Date.parse(lastBackupAt) : NaN
  if (!Number.isFinite(lastBackup)) return 'You haven’t saved a backup yet.'
  const days = Math.max(0, Math.floor((now.getTime() - lastBackup) / DAY_MS))
  return `Your last backup was ${days} day${days === 1 ? '' : 's'} ago.`
}

export function loadBackupReminderSnooze(): string | null {
  try {
    return window.localStorage.getItem(BACKUP_REMINDER_SNOOZE_KEY)
  } catch {
    return null
  }
}

export function snoozeBackupReminder(now = new Date()) {
  const until = new Date(now.getTime() + BACKUP_REMINDER_INTERVAL_DAYS * DAY_MS).toISOString()
  try {
    window.localStorage.setItem(BACKUP_REMINDER_SNOOZE_KEY, until)
  } catch {
    // If storage is unavailable the reminder simply shows again next launch.
  }
  return until
}
