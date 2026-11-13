import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://wfrmidfhcnacndvcgndj.supabase.co').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NhMZ6S2KsqVXLm0E3FgrjA_m9KtVdnU').trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
