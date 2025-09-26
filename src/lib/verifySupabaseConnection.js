import { supabase } from './supabaseClient'

export async function verifySupabaseConnection() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    const missing = []
    if (!url) missing.push('VITE_SUPABASE_URL')
    if (!key) missing.push('VITE_SUPABASE_ANON_KEY')
    return {
      ok: false,
      message: `Missing env vars: ${missing.join(', ')}`,
    }
  }

  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      return { ok: false, message: `Auth session error: ${error.message}` }
    }
    return { ok: true, message: 'Supabase reachable', details: !!data?.session }
  } catch (err) {
    return { ok: false, message: `Connection failed: ${err.message}` }
  }
}


