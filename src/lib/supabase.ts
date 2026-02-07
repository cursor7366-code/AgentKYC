// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './env'

let instance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (instance) return instance

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not configured')
  }

  instance = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  return instance
}
