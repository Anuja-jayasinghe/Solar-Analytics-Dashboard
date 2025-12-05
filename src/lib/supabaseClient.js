import { createClient } from '@supabase/supabase-js'

// You'll find these in your Supabase Project → Settings → API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Ensure redirects work for local development
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Use current origin for redirects (localhost in dev, production in prod)
    flowType: 'pkce'
  }
})
