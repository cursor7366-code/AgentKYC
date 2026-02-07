// scripts/seed.ts
// Seed the database with initial verified agents for demonstration.
// Usage: npx tsx scripts/seed.ts
//
// Requires env vars: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const SEED_AGENTS = [
  {
    owner_email: 'openclaw@agentkyc.io',
    owner_name: 'AgentKYC Team',
    agent_name: 'OpenClaw',
    agent_description: 'General-purpose research and writing agent. Can analyze documents, summarize content, and draft responses.',
    agent_skills: ['Research', 'Writing', 'Summarization', 'Analysis'],
    agent_url: 'https://agentkyc.io',
    agent_platform: 'standalone',
    identity_link: 'https://github.com/agentkyc',
    identity_type: 'github',
    identity_verified: true,
    email_verified: true,
    status: 'verified',
    handle: 'openclaw',
    badge_token: 'seed-token-openclaw',
    approved_at: new Date().toISOString(),
    approved_by: 'seed-script',
    test_task_completed: true,
  },
  {
    owner_email: 'databot@agentkyc.io',
    owner_name: 'AgentKYC Team',
    agent_name: 'DataBot',
    agent_description: 'Specialized data analysis agent. Processes CSV, JSON, and spreadsheet data with statistical analysis.',
    agent_skills: ['Data Analysis', 'Statistics', 'Visualization', 'CSV Processing'],
    agent_url: null,
    agent_platform: 'standalone',
    identity_link: 'https://github.com/agentkyc',
    identity_type: 'github',
    identity_verified: true,
    email_verified: true,
    status: 'verified',
    handle: 'databot',
    badge_token: 'seed-token-databot',
    approved_at: new Date().toISOString(),
    approved_by: 'seed-script',
    test_task_completed: true,
  },
]

async function seed() {
  console.log('Seeding database...')

  for (const agent of SEED_AGENTS) {
    // Check if agent already exists
    const { data: existing } = await supabase
      .from('verification_applications')
      .select('id')
      .eq('handle', agent.handle)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('verification_applications')
        .update(agent)
        .eq('id', existing.id)

      if (error) {
        console.error(`Failed to update ${agent.agent_name}:`, error.message)
      } else {
        console.log(`Updated: ${agent.agent_name} (handle: ${agent.handle})`)
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('verification_applications')
        .insert(agent)

      if (error) {
        console.error(`Failed to seed ${agent.agent_name}:`, error.message)
      } else {
        console.log(`Seeded: ${agent.agent_name} (handle: ${agent.handle})`)
      }
    }
  }

  console.log('Done!')
}

seed()
