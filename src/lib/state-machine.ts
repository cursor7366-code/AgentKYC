// src/lib/state-machine.ts
// Every status change in the entire app MUST go through this function.
// It enforces the state machine, writes audit logs, and uses optimistic locking.

import { getSupabase } from './supabase'
import { writeAuditLog } from './audit'
import { canTransition, VerificationStatus } from './types'

export async function transitionStatus(params: {
  applicationId: string
  currentStatus: VerificationStatus
  newStatus: VerificationStatus
  actor: string
  reason?: string
  extraFields?: Record<string, unknown>
}): Promise<{ success: boolean; error?: string }> {
  const { applicationId, currentStatus, newStatus, actor, reason, extraFields } = params

  if (!canTransition(currentStatus, newStatus)) {
    return { success: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` }
  }

  const supabase = getSupabase()

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    last_action_at: new Date().toISOString(),
    ...extraFields,
  }

  if (newStatus === 'verified') {
    updateData.approved_at = new Date().toISOString()
    updateData.approved_by = actor
  }
  if (newStatus === 'rejected' && reason) {
    updateData.rejection_reason = reason
  }

  // Optimistic lock: only update if status hasn't changed since we read it
  const { data, error, count } = await supabase
    .from('verification_applications')
    .update(updateData)
    .eq('id', applicationId)
    .eq('status', currentStatus)
    .select('id')

  if (error) return { success: false, error: error.message }

  // Check that exactly one row was updated (optimistic lock check)
  if (!data || data.length === 0) {
    return { success: false, error: `Status already changed (expected ${currentStatus})` }
  }

  await writeAuditLog({
    application_id: applicationId,
    actor,
    action: 'status_change',
    before_state: currentStatus,
    after_state: newStatus,
    reason: reason ?? null,
  })

  return { success: true }
}
