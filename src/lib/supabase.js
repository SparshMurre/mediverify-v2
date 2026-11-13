import { createClient } from '@supabase/supabase-js'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/['"]/g, '').trim()
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').replace(/['"]/g, '').trim()

const supabaseUrl = rawUrl.startsWith('http') ? rawUrl : 'https://wfrmidfhcnacndvcgndj.supabase.co'
const supabaseAnonKey = rawKey.length > 20 ? rawKey : 'sb_publishable_NhMZ6S2KsqVXLm0E3FgrjA_m9KtVdnU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
