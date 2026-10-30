import { createClient } from '@supabase/supabase-js'

const configuredUrl = (import.meta.env.VITE_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '')
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
const hasUrl = configuredUrl.length > 0
const hasKey = publishableKey.length > 0

let validUrl = false

if (hasUrl) {
  try {
    const url = new URL(configuredUrl)
    validUrl = url.protocol === 'https:' || url.hostname === 'localhost'
  } catch {
    validUrl = false
  }
}

export const supabaseConfigError =
  hasUrl !== hasKey
    ? 'Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to connect the rate board.'
    : hasUrl && !validUrl
      ? 'VITE_SUPABASE_URL must be a valid HTTPS project URL.'
      : null

export const isSupabaseConfigured = hasUrl && hasKey && validUrl

export const supabase = isSupabaseConfigured
  ? createClient(configuredUrl, publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null
