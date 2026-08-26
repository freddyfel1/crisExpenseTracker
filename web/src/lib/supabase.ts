import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Falls back to placeholder values so createClient doesn't throw before setup —
// isSupabaseConfigured gates whether the app actually tries to use it.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder')
