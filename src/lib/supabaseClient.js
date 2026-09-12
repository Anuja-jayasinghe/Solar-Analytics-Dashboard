import { createClient } from '@supabase/supabase-js'

// You'll find these in your Supabase Project → Settings → API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Configuration is no longer logged on every page load. It printed the Supabase URL and a
// key prefix to the console of every visitor — harmless, since the anon key is public, but
// noise that signalled more than it needed to. Missing-credential warnings below remain.


// Warn if credentials are missing
if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not configured:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlValue: supabaseUrl || 'undefined',
    keyValue: supabaseKey ? '***' : 'undefined'
  })
}

let supabaseInstance = null;

try {
  supabaseInstance = createClient(
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
      },
      realtime: {
        // Completely disable WebSocket connections by using a dummy transport
        transport: class {
          constructor() {}
          send() {}
          close() {}
          set onopen(cb) {}
          set onmessage(cb) {}
          set onerror(cb) {}
          set onclose(cb) {}
          addEventListener() {}
          removeEventListener() {}
        },
        params: {
          eventsPerSecond: 0
        }
      }
    }
  );
} catch (err) {
  console.error('❌ Failed to initialize Supabase client:', err.message);
  // Create a dummy client to prevent crashes
  supabaseInstance = {
    from: () => ({ select: () => Promise.reject(new Error('Supabase not initialized')) }),
    rpc: () => Promise.reject(new Error('Supabase not initialized')),
    functions: { invoke: () => Promise.reject(new Error('Supabase not initialized')) },
    auth: { getSession: () => Promise.reject(new Error('Supabase not initialized')) }
  };
}

export const supabase = supabaseInstance;
