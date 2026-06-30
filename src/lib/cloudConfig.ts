type CloudMode = 'disabled' | 'missing-config' | 'ready'

export type LeftlyCloudConfig = {
  enabled: boolean
  mode: CloudMode
  supabaseUrl: string
  supabasePublishableKey: string
}

function isTruthyEnv(value: string | undefined) {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'on'
}

export function getLeftlyCloudConfig(): LeftlyCloudConfig {
  const enabled = isTruthyEnv(import.meta.env.VITE_LEFTLY_CLOUD_ENABLED)
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

  if (!enabled) {
    return {
      enabled: false,
      mode: 'disabled',
      supabaseUrl,
      supabasePublishableKey,
    }
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    return {
      enabled: true,
      mode: 'missing-config',
      supabaseUrl,
      supabasePublishableKey,
    }
  }

  return {
    enabled: true,
    mode: 'ready',
    supabaseUrl,
    supabasePublishableKey,
  }
}
