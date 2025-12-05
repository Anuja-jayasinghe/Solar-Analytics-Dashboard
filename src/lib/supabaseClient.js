import { createClient } from '@supabase/supabase-js'

// You'll find these in your Supabase Project → Settings → API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Log environment configuration (for debugging)
console.log('🔍 Supabase Configuration:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : '❌ MISSING',
  key: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : '❌ MISSING',
  environment: import.meta.env.MODE,
  isProduction: import.meta.env.PROD
});

// Warn if credentials are missing
if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not configured:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlValue: supabaseUrl || 'undefined',
    keyValue: supabaseKey ? '***' : 'undefined'
  })
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      // Ensure redirects work for local development
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Use current origin for redirects (localhost in dev, production in prod)
      flowType: 'pkce'
    }
  }
)
