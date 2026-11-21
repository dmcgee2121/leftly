import { App as CapacitorApp } from '@capacitor/app'
import { Preferences } from '@capacitor/preferences'
import { isNativePlatform } from './native'

// Leftly keeps working data in localStorage (fast and synchronous). In the Android app the OS may
// clear a WebView's localStorage when the phone runs low on space, so we also keep one snapshot of
// every Leftly key in Capacitor Preferences (native app storage that is not cleared that way).
// On launch, if localStorage has lost the budget but the snapshot still has it, the snapshot is
// copied back before the app reads any data.

export const DURABLE_SNAPSHOT_KEY = 'leftly.durableSnapshot.v1'
const KEY_PREFIX = 'leftly.'
const SAVE_DELAY_MS = 400

// Keys whose presence means "this person has a budget". If none of these are in localStorage but the
// snapshot has one, localStorage was wiped and we restore it.
export const CORE_DATA_KEYS = [
  'leftly.activeBudgetPeriod',
  'leftly.bills',
  'leftly.expenses',
  'leftly.recurringTemplates',
  'leftly.payPeriodHistory',
]

// Screen position and one-time notices are not worth restoring.
const EXCLUDED_KEYS = new Set(['leftly.activeTab', 'leftly.offlineReadyNoticeSeen', 'leftly.storageProbe'])

export type DurableSnapshot = {
  version: 1
  savedAt: string
  entries: Record<string, string>
}

type KeyValueStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'>

export function collectLeftlyEntries(storage: KeyValueStorage): Record<string, string> {
  const entries: Record<string, string> = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || !key.startsWith(KEY_PREFIX) || EXCLUDED_KEYS.has(key)) continue
    const value = storage.getItem(key)
    if (value !== null) entries[key] = value
  }
  return entries
}

export function hasCoreData(entries: Record<string, string>) {
  return CORE_DATA_KEYS.some((key) => key in entries)
}

export function parseSnapshot(raw: string | null): DurableSnapshot | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<DurableSnapshot>
    if (value.version !== 1 || typeof value.savedAt !== 'string' || !value.entries || typeof value.entries !== 'object') return null
    const entries: Record<string, string> = {}
    for (const [key, entry] of Object.entries(value.entries)) {
      if (key.startsWith(KEY_PREFIX) && typeof entry === 'string') entries[key] = entry
    }
    return { version: 1, savedAt: value.savedAt, entries }
  } catch {
    return null
  }
}

// Restore only when localStorage has no budget at all and the snapshot does. When both have data,
// localStorage is newer (it is written first), so it wins.
export function shouldRestoreFromSnapshot(localEntries: Record<string, string>, snapshot: DurableSnapshot | null) {
  return Boolean(snapshot) && !hasCoreData(localEntries) && hasCoreData(snapshot!.entries)
}

export function applySnapshot(storage: KeyValueStorage, snapshot: DurableSnapshot) {
  let restored = 0
  for (const [key, value] of Object.entries(snapshot.entries)) {
    storage.setItem(key, value)
    restored += 1
  }
  return restored
}

export function buildSnapshot(storage: KeyValueStorage, now = new Date()): DurableSnapshot {
  return { version: 1, savedAt: now.toISOString(), entries: collectLeftlyEntries(storage) }
}

export type DurableStartupResult = 'web' | 'restored' | 'saved' | 'failed'

let lastStartupResult: DurableStartupResult = 'web'

export function getDurableStartupResult() {
  return lastStartupResult
}

// Run once before the app reads any data.
export async function prepareDurableStorage(): Promise<DurableStartupResult> {
  if (!isNativePlatform()) {
    lastStartupResult = 'web'
    return lastStartupResult
  }
  try {
    const { value } = await Preferences.get({ key: DURABLE_SNAPSHOT_KEY })
    const snapshot = parseSnapshot(value)
    const localEntries = collectLeftlyEntries(window.localStorage)
    if (snapshot && shouldRestoreFromSnapshot(localEntries, snapshot)) {
      applySnapshot(window.localStorage, snapshot)
      lastStartupResult = 'restored'
    } else {
      await saveSnapshotNow()
      lastStartupResult = 'saved'
    }
  } catch (error) {
    console.warn('Leftly durable storage could not start; continuing with local storage only.', error)
    lastStartupResult = 'failed'
  }
  return lastStartupResult
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function saveSnapshotNow() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await Preferences.set({ key: DURABLE_SNAPSHOT_KEY, value: JSON.stringify(buildSnapshot(window.localStorage)) })
}

// Called after every Leftly write. Coalesces bursts of writes into one save. Deletions (reset,
// clearing a draft) save immediately so a quick app close can't bring old data back.
export function scheduleDurableSave(options: { immediate?: boolean } = {}) {
  if (!isNativePlatform()) return
  if (options.immediate) {
    void saveSnapshotNow().catch((error) => console.warn('Leftly durable save failed.', error))
    return
  }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveSnapshotNow().catch((error) => console.warn('Leftly durable save failed.', error))
  }, SAVE_DELAY_MS)
}

// Safety net: save whenever the app goes to the background. On the website, ask the browser to keep
// Leftly's storage (installed web apps are usually granted this).
export function startDurableStorageSync() {
  if (isNativePlatform()) {
    void CapacitorApp.addListener('pause', () => {
      void saveSnapshotNow().catch((error) => console.warn('Leftly durable save failed.', error))
    })
    return
  }
  try {
    if (navigator.storage?.persist && navigator.storage.persisted) {
      void navigator.storage.persisted().then((persisted) => (persisted ? true : navigator.storage.persist())).catch(() => false)
    }
  } catch {
    // Not supported in this browser; nothing to do.
  }
}
