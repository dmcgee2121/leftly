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

type WritableStorage = KeyValueStorage & Pick<Storage, 'removeItem'>

// Copies the snapshot into storage and checks every value landed. If anything fails (for example the
// phone is out of space), it puts storage back exactly as it was and throws, so nothing half-restored
// is left behind and the next launch can try again.
export function applySnapshot(storage: WritableStorage, snapshot: DurableSnapshot) {
  const keys = Object.keys(snapshot.entries)
  const previous = new Map(keys.map((key) => [key, storage.getItem(key)]))
  try {
    for (const key of keys) storage.setItem(key, snapshot.entries[key])
    const missing = keys.filter((key) => storage.getItem(key) !== snapshot.entries[key])
    if (missing.length > 0) throw new Error(`Restore could not be verified for ${missing.join(', ')}`)
  } catch (error) {
    for (const key of keys) {
      try {
        const before = previous.get(key) ?? null
        if (before === null) storage.removeItem(key)
        else storage.setItem(key, before)
      } catch {
        // Best effort; the snapshot itself stays untouched either way.
      }
    }
    throw error
  }
  return keys.length
}

export function buildSnapshot(storage: KeyValueStorage, now = new Date()): DurableSnapshot {
  return { version: 1, savedAt: now.toISOString(), entries: collectLeftlyEntries(storage) }
}

// 'restore-failed': the phone lost its budget, the saved copy exists, but copying it back failed.
// 'failed': the saved copy could not be read at all.
export type DurableStartupResult = 'web' | 'restored' | 'saved' | 'restore-failed' | 'failed'

let lastStartupResult: DurableStartupResult = 'web'

// When startup could not read or restore the saved copy, it must never be overwritten this session:
// it may be the only complete copy of the budget.
let durableWritesLocked = false

export function areDurableWritesLocked() {
  return durableWritesLocked
}

export function getDurableStartupResult() {
  return lastStartupResult
}

// Run once before the app reads any data.
export async function prepareDurableStorage(): Promise<DurableStartupResult> {
  if (!isNativePlatform()) {
    lastStartupResult = 'web'
    return lastStartupResult
  }
  durableWritesLocked = false
  let snapshot: DurableSnapshot | null
  try {
    const { value } = await Preferences.get({ key: DURABLE_SNAPSHOT_KEY })
    snapshot = parseSnapshot(value)
  } catch (error) {
    console.warn('Leftly could not read its saved copy; it will not be changed this session.', error)
    durableWritesLocked = true
    lastStartupResult = 'failed'
    return lastStartupResult
  }

  const localEntries = collectLeftlyEntries(window.localStorage)
  if (snapshot && shouldRestoreFromSnapshot(localEntries, snapshot)) {
    try {
      applySnapshot(window.localStorage, snapshot)
      lastStartupResult = 'restored'
    } catch (error) {
      console.warn('Leftly could not restore its saved copy; it is kept unchanged for the next launch.', error)
      durableWritesLocked = true
      lastStartupResult = 'restore-failed'
    }
    return lastStartupResult
  }

  try {
    await saveSnapshotNow()
  } catch (error) {
    console.warn('Leftly durable save failed at startup.', error)
  }
  lastStartupResult = 'saved'
  return lastStartupResult
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function saveSnapshotNow() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (durableWritesLocked) return
  await Preferences.set({ key: DURABLE_SNAPSHOT_KEY, value: JSON.stringify(buildSnapshot(window.localStorage)) })
}

// Called after every Leftly write. Coalesces bursts of writes into one save. Deletions (reset,
// clearing a draft) save immediately so a quick app close can't bring old data back.
export function scheduleDurableSave(options: { immediate?: boolean } = {}) {
  if (!isNativePlatform() || durableWritesLocked) return
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
