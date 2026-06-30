import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getLeftlyCloudConfig } from './cloudConfig'

let cachedClient: SupabaseClient | null = null

export function getLeftlySupabaseClient() {
  const cloudConfig = getLeftlyCloudConfig()
  if (cloudConfig.mode !== 'ready') {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(cloudConfig.supabaseUrl, cloudConfig.supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  }

  return cachedClient
}
