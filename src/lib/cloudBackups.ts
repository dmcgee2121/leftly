import {
  buildLeftlyBackup,
  getLeftlyBackupSummary,
  parseLeftlyBackupValue,
  loadActiveBudgetPeriod,
  loadBills,
  loadCategoryOrder,
  loadCategoryOrderMode,
  loadExpenses,
  loadPreferences,
  loadPayPeriodHistory,
  loadRecurringTemplates,
  loadSortMode,
  type LeftlyBackup,
  type LeftlyBackupSummary,
} from './storage'
import { getLeftlySupabaseClient } from './supabaseClient'

export type CloudBackupRow = {
  id: string
  user_id: string
  backup_version: string
  backup_json: unknown
  summary_json: unknown | null
  content_hash: string | null
  created_at: string
  updated_at: string
}

export type CloudBackupSnapshot = {
  row: CloudBackupRow
  backup: LeftlyBackup
  summary: LeftlyBackupSummary
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return fallback
}

function normalizeSummary(value: unknown, backup: LeftlyBackup): LeftlyBackupSummary {
  const summary = value as Partial<LeftlyBackupSummary> | null | undefined

  if (
    summary &&
    typeof summary.hasActivePayPeriod === 'boolean' &&
    typeof summary.billCount === 'number' &&
    typeof summary.expenseCount === 'number' &&
    typeof summary.recurringTemplateCount === 'number' &&
    typeof summary.historySnapshotCount === 'number' &&
    typeof summary.categoryCount === 'number' &&
    typeof summary.displaySettingsIncluded === 'boolean' &&
    typeof summary.preferencesIncluded === 'boolean'
  ) {
    return {
      hasActivePayPeriod: summary.hasActivePayPeriod,
      billCount: summary.billCount,
      expenseCount: summary.expenseCount,
      recurringTemplateCount: summary.recurringTemplateCount,
      historySnapshotCount: summary.historySnapshotCount,
      categoryCount: summary.categoryCount,
      displaySettingsIncluded: summary.displaySettingsIncluded,
      preferencesIncluded: summary.preferencesIncluded,
    }
  }

  return backup.summary ?? getLeftlyBackupSummary(backup)
}

async function getCurrentSupabaseUserId() {
  const supabase = getLeftlySupabaseClient()
  if (!supabase) {
    throw new Error('Cloud backup is unavailable because Supabase is not configured.')
  }

  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw new Error(getErrorMessage(error, 'Unable to read the signed-in cloud user.'))
  }

  if (!data.user) {
    throw new Error('Sign in before using cloud backup.')
  }

  return { supabase, userId: data.user.id }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function buildLocalBackupSnapshot() {
  return buildLeftlyBackup({
    activeBudgetPeriod: loadActiveBudgetPeriod(),
    bills: loadBills(),
    expenses: loadExpenses(),
    recurringTemplates: loadRecurringTemplates(),
    payPeriodHistory: loadPayPeriodHistory(),
    categoryOrder: loadCategoryOrder(),
    categoryOrderMode: loadCategoryOrderMode(),
    sortMode: loadSortMode(),
    preferences: loadPreferences(),
  })
}

export async function uploadCurrentLocalBackup() {
  const { supabase, userId } = await getCurrentSupabaseUserId()
  const backup = buildLocalBackupSnapshot()
  const contentHash = await sha256Hex(JSON.stringify(backup))
  const row = {
    user_id: userId,
    backup_version: String(backup.backupVersion ?? backup.version),
    backup_json: backup,
    summary_json: backup.summary ?? getLeftlyBackupSummary(backup),
    content_hash: contentHash,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('cloud_backups').upsert(row, { onConflict: 'user_id' }).select().single()
  if (error) {
    throw new Error(getErrorMessage(error, 'Unable to upload the cloud backup.'))
  }

  return {
    row: data as CloudBackupRow,
    backup,
    summary: normalizeSummary(row.summary_json, backup),
  }
}

export async function fetchLatestCloudBackup() {
  const { supabase, userId } = await getCurrentSupabaseUserId()
  const { data, error } = await supabase
    .from('cloud_backups')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(getErrorMessage(error, 'Unable to load the cloud backup.'))
  }

  if (!data) {
    return null
  }

  const row = data as CloudBackupRow
  const parsed = parseLeftlyBackupValue(row.backup_json)
  if (!parsed.ok) {
    throw new Error(
      'The saved cloud snapshot is invalid and cannot be restored. Local data was not changed. Export JSON or upload a fresh snapshot after fixing the cloud row.',
    )
  }

  return {
    row,
    backup: parsed.backup,
    summary: normalizeSummary(row.summary_json, parsed.backup),
  } satisfies CloudBackupSnapshot
}
