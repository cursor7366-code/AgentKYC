// src/lib/audit.ts
// All state changes MUST write an audit log entry through this function.

import { getSupabase } from './supabase'

export async function writeAuditLog(params: {
  application_id?: string | null
  actor: string
  action: string
  before_state?: string | null
  after_state?: string | null
  reason?: string | null
  metadata?: Record<string, unknown> | null
}) {
  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('audit_logs').insert({
      application_id: params.application_id ?? null,
      actor: params.actor,
      action: params.action,
      before_state: params.before_state ?? null,
      after_state: params.after_state ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
    })
    if (error) console.error('[audit] Failed to write audit log:', error)
  } catch (err) {
    // Never let audit logging crash the caller
    console.error('[audit] Exception writing audit log:', err)
  }
}
