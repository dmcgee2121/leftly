import { beforeEach, describe, expect, it } from 'vitest'
import { buildRestorePreview, validTimestamp } from '../src/lib/backupRecovery'
import { buildLeftlyBackup, clearAllAppData, getLeftlyBackupSummary, loadDataSafetyMeta, parseLeftlyBackupJson, restoreLeftlyBackup, updateDataSafetyMeta, DATA_SAFETY_META_KEY } from '../src/lib/storage'
import { period, snapshot } from './fixtures'

class FakeStorage {
  values = new Map<string, string>()
  corruptKey: string | null = null
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, this.corruptKey === key ? `${value} corrupted` : value) }
  removeItem(key: string) { this.values.delete(key) }
}

const backupInput = () => ({ activeBudgetPeriod: period, bills: [], expenses: [], recurringTemplates: [], payPeriodHistory: [snapshot()], categoryOrder: ['Housing', 'Food'] as string[], categoryOrderMode: 'custom' as const, sortMode: 'date' as const })

describe('Phase 9 backup and recovery', () => {
  beforeEach(() => {
    const storage = new FakeStorage()
    Object.assign(globalThis, { window: { localStorage: storage } })
  })

  it('accepts v1 backups, rejects invalid/non-Leftly JSON, and derives/compares summaries', () => {
    const backup = buildLeftlyBackup(backupInput())
    const parsed = parseLeftlyBackupJson(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    expect((parsed.ok ? parsed.backup : null)?.version).toBe(1)
    expect(parseLeftlyBackupJson('{bad')).toMatchObject({ ok: false })
    expect(parseLeftlyBackupJson(JSON.stringify({ app: 'other' }))).toMatchObject({ ok: false })
    const older = { ...backup, summary: undefined, backupVersion: undefined }
    expect(parseLeftlyBackupJson(JSON.stringify(older))).toMatchObject({ ok: true })
    expect(JSON.stringify(backup)).not.toContain(DATA_SAFETY_META_KEY)
    expect(validTimestamp(backup.exportedAt)).toBe(true)
    expect(validTimestamp('not-a-timestamp')).toBe(false)
    updateDataSafetyMeta({ lastJsonExportInitiatedAt: '2024-01-01T00:00:00.000Z', lastRestoreSource: 'json' })
    expect(loadDataSafetyMeta()).toMatchObject({ version: 1, lastRestoreSource: 'json' })
    const current = getLeftlyBackupSummary({ ...backupInput(), payPeriodHistory: [] })
    const preview = buildRestorePreview({ source: 'json', backup, current, sourceLabel: 'test backup' })
    expect(preview).toMatchObject({ backupFormat: 'v1', sourceLabel: 'test backup', incoming: { historySnapshotCount: 1 }, current: { historySnapshotCount: 0 } })
  })

  it('verifies successful writes and reports mismatches while attempting rollback', () => {
    const storage = (window.localStorage as unknown as FakeStorage)
    const backup = buildLeftlyBackup(backupInput())
    expect(restoreLeftlyBackup(backup)).toEqual({ ok: true })
    storage.corruptKey = 'leftly.bills'
    const result = restoreLeftlyBackup(backup)
    expect(result.ok).toBe(false)
    expect(result).toHaveProperty('failedKeys')
    storage.corruptKey = null
    clearAllAppData()
    expect(storage.getItem(DATA_SAFETY_META_KEY)).toBeNull()
  })
})
