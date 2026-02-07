// src/lib/env.ts
// Centralized environment variable access. Import from here, never read process.env directly.

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback
}

// Database
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || ''
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Email (Postmark)
export const POSTMARK_API_KEY = process.env.POSTMARK_API_KEY || ''

// App
export const BASE_URL = optional('NEXT_PUBLIC_BASE_URL', 'https://agentkyc.io')
export const FROM_EMAIL = optional('FROM_EMAIL', 'AgentKYC <hello@agentkyc.io>')

// Admin
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
export const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || ''

// Automation
export const AUTOMATION_TOKEN = process.env.AUTOMATION_TOKEN || ''
export const AUTO_APPROVAL_ENABLED = process.env.AUTO_APPROVAL_ENABLED === 'true'
export const MAX_AUTO_APPROVALS_PER_DAY = parseInt(process.env.MAX_AUTO_APPROVALS_PER_DAY || '10', 10)

// Validation helper for server-side routes
export function requireServerEnv() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not set')
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
}
