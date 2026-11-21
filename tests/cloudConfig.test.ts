import { afterEach, describe, expect, it, vi } from 'vitest'

const nativeState = { isNative: false }
vi.mock('../src/lib/native', () => ({ isNativePlatform: () => nativeState.isNative }))

import { getLeftlyCloudConfig } from '../src/lib/cloudConfig'

function setCloudEnv(values: Record<string, string>) {
  vi.stubEnv('VITE_LEFTLY_CLOUD_ENABLED', values.enabled ?? '')
  vi.stubEnv('VITE_LEFTLY_CLOUD_NATIVE_ENABLED', values.native ?? '')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
}

afterEach(() => {
  vi.unstubAllEnvs()
  nativeState.isNative = false
})

describe('cloud backup launch switch', () => {
  it('stays available on the website when the flag is on', () => {
    setCloudEnv({ enabled: 'true' })
    expect(getLeftlyCloudConfig()).toMatchObject({ enabled: true, mode: 'ready' })
  })

  it('is hidden in the Android app even when the website flag is on', () => {
    nativeState.isNative = true
    setCloudEnv({ enabled: 'true' })
    expect(getLeftlyCloudConfig()).toMatchObject({ enabled: false, mode: 'disabled' })
  })

  it('can be turned back on for the Android app with the native flag', () => {
    nativeState.isNative = true
    setCloudEnv({ enabled: 'true', native: 'true' })
    expect(getLeftlyCloudConfig()).toMatchObject({ enabled: true, mode: 'ready' })
  })

  it('is off everywhere when the main flag is off', () => {
    setCloudEnv({ enabled: '' })
    expect(getLeftlyCloudConfig().enabled).toBe(false)
  })
})
