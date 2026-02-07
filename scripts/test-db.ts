// Quick test to check database state
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data, error } = await supabase
    .from('verification_applications')
    .select('agent_name, status, handle, approved_at')
    .order('created_at', { ascending: false })

  console.log('All applications:', JSON.stringify(data, null, 2))
  console.log('Error:', error)

  const { data: verified } = await supabase
    .from('verification_applications')
    .select('agent_name, status, handle')
    .eq('status', 'verified')

  console.log('\nVerified agents:', JSON.stringify(verified, null, 2))
}

test()
