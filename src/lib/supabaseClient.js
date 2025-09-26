import { createClient } from '@supabase/supabase-js'

// You’ll find these in your Supabase Project → Settings → API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
