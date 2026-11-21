import { describe, expect, it } from 'vitest'
import { describeLastBackup, shouldShowBackupReminder } from '../src/lib/backupReminder'

const now = new Date('2026-11-20T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * 864e5).toISOString()

describe('backup reminder', () => {
  it('waits until at least one paycheck is finished', () => {
    expect(shouldShowBackupReminder({ archivedPayPeriods: 0, now })).toBe(false)
    expect(shouldShowBackupReminder({ archivedPayPeriods: 1, now })).toBe(true)
  })

  it('shows when the last backup is 30 or more days old', () => {
    expect(shouldShowBackupReminder({ archivedPayPeriods: 3, lastBackupAt: daysAgo(10), now })).toBe(false)
    expect(shouldShowBackupReminder({ archivedPayPeriods: 3, lastBackupAt: daysAgo(30), now })).toBe(true)
  })

  it('respects Later until the snooze ends', () => {
    const later = new Date(now.getTime() + 5 * 864e5).toISOString()
    expect(shouldShowBackupReminder({ archivedPayPeriods: 3, snoozedUntil: later, now })).toBe(false)
    expect(shouldShowBackupReminder({ archivedPayPeriods: 3, snoozedUntil: daysAgo(1), now })).toBe(true)
  })

  it('describes the last backup in plain words', () => {
    expect(describeLastBackup(null, now)).toBe('You haven’t saved a backup yet.')
    expect(describeLastBackup(daysAgo(1), now)).toBe('Your last backup was 1 day ago.')
    expect(describeLastBackup(daysAgo(45), now)).toBe('Your last backup was 45 days ago.')
  })
})
