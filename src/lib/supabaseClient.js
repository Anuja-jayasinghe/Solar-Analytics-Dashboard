import { createClient } from '@supabase/supabase-js'

// You'll find these in your Supabase Project → Settings → API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Warn if credentials are missing
if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not configured:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
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
