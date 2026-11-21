import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeState = { isNative: true }
const preferences = new Map<string, string>()

vi.mock('../src/lib/native', () => ({ isNativePlatform: () => nativeState.isNative }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: preferences.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      preferences.set(key, value)
    }),
  },
}))

import {
  DURABLE_SNAPSHOT_KEY,
  buildSnapshot,
  collectLeftlyEntries,
  parseSnapshot,
  prepareDurableStorage,
  scheduleDurableSave,
  shouldRestoreFromSnapshot,
} from '../src/lib/durableStore'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    map,
  }
}

const budget = {
  'leftly.activeBudgetPeriod': '{"income":1850}',
  'leftly.bills': '[{"name":"Rent"}]',
  'leftly.preferences': '{"defaultPayCadence":"biweekly"}',
}

let storage = memoryStorage()

beforeEach(() => {
  preferences.clear()
  nativeState.isNative = true
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { localStorage: storage })
})

describe('snapshot rules', () => {
  it('collects only Leftly keys and skips screen position and one-time notices', () => {
    const entries = collectLeftlyEntries(memoryStorage({ ...budget, 'leftly.activeTab': 'history', 'leftly.offlineReadyNoticeSeen': '1', other: 'x' }))
    expect(Object.keys(entries).sort()).toEqual(Object.keys(budget).sort())
  })

  it('restores only when the phone lost its budget and the snapshot has one', () => {
    const snapshot = buildSnapshot(memoryStorage(budget))
    expect(shouldRestoreFromSnapshot({}, snapshot)).toBe(true)
    expect(shouldRestoreFromSnapshot({ 'leftly.preferences': '{}' }, snapshot)).toBe(true)
    expect(shouldRestoreFromSnapshot(budget, snapshot)).toBe(false)
    expect(shouldRestoreFromSnapshot({}, buildSnapshot(memoryStorage({ 'leftly.preferences': '{}' })))).toBe(false)
    expect(shouldRestoreFromSnapshot({}, null)).toBe(false)
  })

  it('ignores damaged snapshots', () => {
    expect(parseSnapshot('not json')).toBeNull()
    expect(parseSnapshot('{"version":2,"savedAt":"x","entries":{}}')).toBeNull()
    expect(parseSnapshot(null)).toBeNull()
  })
})

describe('app startup', () => {
  it('brings back a budget after the WebView storage was wiped', async () => {
    preferences.set(DURABLE_SNAPSHOT_KEY, JSON.stringify(buildSnapshot(memoryStorage(budget))))
    expect(await prepareDurableStorage()).toBe('restored')
    expect(storage.getItem('leftly.bills')).toBe(budget['leftly.bills'])
    expect(storage.getItem('leftly.activeBudgetPeriod')).toBe(budget['leftly.activeBudgetPeriod'])
  })

  it('keeps newer local data and refreshes the snapshot for existing users', async () => {
    storage.map.set('leftly.bills', '[{"name":"Phone"}]')
    storage.map.set('leftly.activeBudgetPeriod', '{"income":2000}')
    preferences.set(DURABLE_SNAPSHOT_KEY, JSON.stringify(buildSnapshot(memoryStorage(budget))))
    expect(await prepareDurableStorage()).toBe('saved')
    expect(storage.getItem('leftly.bills')).toBe('[{"name":"Phone"}]')
    expect(parseSnapshot(preferences.get(DURABLE_SNAPSHOT_KEY) ?? null)?.entries['leftly.bills']).toBe('[{"name":"Phone"}]')
  })

  it('does not bring data back after the person resets Leftly', async () => {
    preferences.set(DURABLE_SNAPSHOT_KEY, JSON.stringify(buildSnapshot(memoryStorage(budget))))
    // Reset clears local storage and saves an empty snapshot right away.
    scheduleDurableSave({ immediate: true })
    await vi.waitFor(() => expect(parseSnapshot(preferences.get(DURABLE_SNAPSHOT_KEY) ?? null)?.entries).toEqual({}))
    expect(await prepareDurableStorage()).toBe('saved')
    expect(storage.getItem('leftly.bills')).toBeNull()
  })

  it('does nothing on the website', async () => {
    nativeState.isNative = false
    preferences.set(DURABLE_SNAPSHOT_KEY, JSON.stringify(buildSnapshot(memoryStorage(budget))))
    expect(await prepareDurableStorage()).toBe('web')
    expect(storage.getItem('leftly.bills')).toBeNull()
  })
})

describe('failed restore (Codex review on PR #77)', () => {
  it('rolls back a half-finished restore and never overwrites the saved copy', async () => {
    const saved = JSON.stringify(buildSnapshot(memoryStorage(budget)))
    preferences.set(DURABLE_SNAPSHOT_KEY, saved)
    // Phone is out of space: the second write fails.
    let writes = 0
    const realSet = storage.setItem
    storage.setItem = (key: string, value: string) => {
      writes += 1
      if (writes === 2) throw new Error('QuotaExceededError')
      realSet(key, value)
    }

    expect(await prepareDurableStorage()).toBe('restore-failed')
    expect(collectLeftlyEntries(storage)).toEqual({})

    storage.setItem = realSet
    storage.setItem('leftly.activeBudgetPeriod', '{"income":1}')
    scheduleDurableSave({ immediate: true })
    scheduleDurableSave()
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(preferences.get(DURABLE_SNAPSHOT_KEY)).toBe(saved)
  })

  it('leaves the saved copy alone when it cannot be read', async () => {
    const { Preferences } = await import('@capacitor/preferences')
    vi.mocked(Preferences.get).mockRejectedValueOnce(new Error('unavailable'))
    preferences.set(DURABLE_SNAPSHOT_KEY, 'original')
    expect(await prepareDurableStorage()).toBe('failed')
    scheduleDurableSave({ immediate: true })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(preferences.get(DURABLE_SNAPSHOT_KEY)).toBe('original')
  })

  it('a later successful launch works normally again', async () => {
    preferences.set(DURABLE_SNAPSHOT_KEY, JSON.stringify(buildSnapshot(memoryStorage(budget))))
    expect(await prepareDurableStorage()).toBe('restored')
    expect(storage.getItem('leftly.bills')).toBe(budget['leftly.bills'])
  })
})
