import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }
  
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  return supabaseInstance
}

// For backwards compat - lazy initialization
export const supabase = {
  from: (table: string) => getSupabase().from(table),
}

export interface Agent {
  id: string
  wallet_address: string
  name: string
  description: string | null
  capabilities: string[]
  price_per_task: number
  currency: string
  status: 'available' | 'busy' | 'offline'
  api_endpoint: string | null
  api_key: string
  reputation_score: number
  tasks_completed: number
  total_earned: number
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  poster_wallet: string
  title: string
  description: string
  requirements: string[]
  budget: number
  currency: string
  status: 'pending' | 'matched' | 'in_progress' | 'completed' | 'failed' | 'disputed' | 'cancelled'
  assigned_agent_id: string | null
  result: string | null
  result_metadata: Record<string, unknown> | null
  payment_tx: string | null
  platform_fee: number | null
  created_at: string
  updated_at: string
  completed_at: string | null
}
