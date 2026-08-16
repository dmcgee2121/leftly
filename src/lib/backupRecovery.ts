import type { LeftlyBackup, LeftlyBackupSummary } from './storage'
import { DATA_SAFETY_META_KEY } from './storage'

export type RestoreSource = 'json' | 'cloud'

export type RestorePreview = {
  source: RestoreSource
  sourceLabel: string
  backupFormat: string
  exportedAt: string | null
  activePayPeriod: { present: boolean; range: string | null }
  incoming: LeftlyBackupSummary
  current: LeftlyBackupSummary
  comparison: Array<{ label: string; current: string; incoming: string }>
  replacementScope: string[]
  warnings: string[]
}

export function validTimestamp(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function formatRecoveryTimestamp(value: unknown) {
  if (!validTimestamp(value)) return 'Time unavailable'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value as string))
}

export function buildRestorePreview(params: {
  source: RestoreSource
  backup: LeftlyBackup
  current: LeftlyBackupSummary
  sourceLabel?: string
}): RestorePreview {
  const incoming = isUsableSummary(params.backup.summary) ? params.backup.summary : deriveBackupSummary(params.backup)
  const active = params.backup.activeBudgetPeriod
  const hasValidActiveRange = Boolean(active && validTimestamp(`${active.startDate}T00:00:00`) && validTimestamp(`${active.endDate}T00:00:00`))
  const rows = [
    ['Bills', params.current.billCount, incoming.billCount],
    ['Expenses', params.current.expenseCount, incoming.expenseCount],
    ['Bill Plan items', params.current.recurringTemplateCount, incoming.recurringTemplateCount],
    ['History periods', params.current.historySnapshotCount, incoming.historySnapshotCount],
    ['Categories', params.current.categoryCount, incoming.categoryCount],
    ['Active pay period', params.current.hasActivePayPeriod ? 'Present' : 'None', incoming.hasActivePayPeriod ? 'Present' : 'None'],
    ['Preferences', params.current.preferencesIncluded ? 'Included' : 'Unavailable', incoming.preferencesIncluded ? 'Included' : 'Unavailable'],
    ['Display settings', params.current.displaySettingsIncluded ? 'Included' : 'Unavailable', incoming.displaySettingsIncluded ? 'Included' : 'Unavailable'],
  ] as const
  return {
    source: params.source,
    sourceLabel: params.sourceLabel ?? (params.source === 'json' ? 'JSON backup' : 'Cloud snapshot'),
    backupFormat: `v${params.backup.version}`,
    exportedAt: validTimestamp(params.backup.exportedAt) ? params.backup.exportedAt : null,
    activePayPeriod: { present: Boolean(active), range: hasValidActiveRange ? `${active?.startDate} to ${active?.endDate}` : null },
    incoming,
    current: params.current,
    comparison: rows.map(([label, current, incomingValue]) => ({ label, current: String(current), incoming: String(incomingValue) })),
    replacementScope: ['Active pay period', 'Bills and expenses', 'Bill Plan items', 'History', 'Categories, preferences, and display settings'],
    warnings: [
      ...(validTimestamp(params.backup.exportedAt) ? [] : ['Backup timestamp is unavailable.']),
      ...(active && !hasValidActiveRange ? ['Active pay-period date range is unavailable.'] : []),
    ],
  }
}

function deriveBackupSummary(backup: LeftlyBackup): LeftlyBackupSummary {
  return {
    hasActivePayPeriod: backup.activeBudgetPeriod !== null,
    billCount: backup.bills.length,
    expenseCount: backup.expenses.length,
    recurringTemplateCount: backup.recurringTemplates.length,
    historySnapshotCount: backup.payPeriodHistory.length,
    categoryCount: backup.categoryOrder?.length ?? 0,
    displaySettingsIncluded: backup.categoryOrderMode !== undefined && backup.sortMode !== undefined,
    preferencesIncluded: backup.preferences !== undefined,
  }
}

function isUsableSummary(summary: unknown): summary is LeftlyBackupSummary {
  if (!summary || typeof summary !== 'object') return false
  const value = summary as Record<string, unknown>
  const counts = ['billCount', 'expenseCount', 'recurringTemplateCount', 'historySnapshotCount', 'categoryCount']
  return (
    typeof value.hasActivePayPeriod === 'boolean' &&
    counts.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && Number.isInteger(value[key]) && (value[key] as number) >= 0) &&
    typeof value.displaySettingsIncluded === 'boolean' &&
    typeof value.preferencesIncluded === 'boolean'
  )
}

export type StorageDiagnostics = {
  readable: boolean
  writable: boolean
  expectedKeys: { present: number; total: number; readable: boolean }
  usage: { usage?: number; quota?: number }
  persistent: 'persistent' | 'not-persistent' | 'unsupported'
}

const expectedKeys = ['leftly.activeBudgetPeriod', 'leftly.bills', 'leftly.expenses', 'leftly.payPeriodHistory', DATA_SAFETY_META_KEY]
const probeKey = 'leftly.storageProbe'

export async function runStorageDiagnostics(): Promise<StorageDiagnostics> {
  let readable = false
  let writable = false
  let present = 0
  try {
    window.localStorage.getItem(expectedKeys[0])
    readable = true
    present = expectedKeys.filter((key) => window.localStorage.getItem(key) !== null).length
    const probe = `${Date.now()}`
    window.localStorage.setItem(probeKey, probe)
    writable = window.localStorage.getItem(probeKey) === probe
    window.localStorage.removeItem(probeKey)
  } catch {
    try { window.localStorage.removeItem(probeKey) } catch { /* best effort cleanup */ }
  }
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  const estimate: { usage?: number; quota?: number } = storage?.estimate
    ? await storage.estimate().catch(() => ({} as { usage?: number; quota?: number }))
    : {}
  let persistent: StorageDiagnostics['persistent'] = 'unsupported'
  if (storage?.persisted) persistent = await storage.persisted().then((value) => value ? 'persistent' : 'not-persistent').catch(() => 'unsupported')
  return { readable, writable, expectedKeys: { present, total: expectedKeys.length, readable }, usage: { usage: estimate.usage, quota: estimate.quota }, persistent }
}
