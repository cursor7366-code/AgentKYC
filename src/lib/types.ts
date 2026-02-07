// src/lib/types.ts
// Shared types for the entire application. All API routes and components import from here.

export type VerificationStatus =
  | 'pending'
  | 'email_sent'
  | 'reviewing'
  | 'test_sent'
  | 'verified'
  | 'rejected'

export type IdentityType = 'github' | 'twitter' | 'linkedin' | 'website' | 'moltbook'

export interface VerificationApplication {
  id: string
  created_at: string
  updated_at: string
  status: VerificationStatus

  // Owner
  owner_email: string
  owner_name: string | null
  email_verified: boolean
  email_token: string | null
  email_token_expires: string | null
  identity_link: string
  identity_type: IdentityType
  identity_verified: boolean

  // Agent
  agent_name: string
  agent_description: string | null
  agent_skills: string[]
  agent_url: string | null
  agent_platform: string | null
  handle: string | null

  // Verification
  test_task_sent_at: string | null
  test_task_completed: boolean
  test_task_result: string | null
  test_task_notes: string | null

  // Review
  reviewer_notes: string | null
  approved_at: string | null
  approved_by: string | null
  rejection_reason: string | null

  // Badge
  badge_token: string | null

  // Automation
  requires_human_override: boolean
  auto_review_score: number | null
  last_action_at: string | null
}

export interface AuditLog {
  id: string
  created_at: string
  application_id: string | null
  actor: string
  action: string
  before_state: string | null
  after_state: string | null
  reason: string | null
  metadata: Record<string, unknown> | null
}

export interface AgentJob {
  id: string
  created_at: string
  job_type: string
  payload: Record<string, unknown>
  status: 'queued' | 'processing' | 'completed' | 'failed'
  scheduled_for: string
  locked_by: string | null
  attempts: number
  max_attempts: number
  last_error: string | null
  completed_at: string | null
}

// State machine: allowed transitions
export const ALLOWED_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  pending:    ['email_sent', 'reviewing', 'rejected'],
  email_sent: ['reviewing', 'rejected'],
  reviewing:  ['test_sent', 'verified', 'rejected'],
  test_sent:  ['verified', 'rejected', 'reviewing'],
  verified:   ['rejected'],
  rejected:   ['pending'],
}

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

// Handle generation helper -- validates that agent_name produces a usable handle
export function generateHandle(agentName: string): string | null {
  const handle = agentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)

  if (!handle) return null
  return handle
}
