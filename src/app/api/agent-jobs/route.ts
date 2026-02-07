import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { AUTOMATION_TOKEN, AUTO_APPROVAL_ENABLED, MAX_AUTO_APPROVALS_PER_DAY } from '@/lib/env'
import { transitionStatus } from '@/lib/state-machine'
import { writeAuditLog } from '@/lib/audit'
import { VerificationStatus, generateHandle } from '@/lib/types'
import crypto from 'crypto'

function checkToken(request: NextRequest): boolean {
  if (!AUTOMATION_TOKEN) return false
  const token = request.headers.get('x-automation-token')
  return token === AUTOMATION_TOKEN
}

// GET: poll for next queued job
export async function GET(request: NextRequest) {
  if (!checkToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()
    const workerId = request.headers.get('x-worker-id') || 'worker'

    // Find oldest queued job that is due
    const { data: job, error } = await supabase
      .from('agent_jobs')
      .select('*')
      .eq('status', 'queued')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(1)
      .single()

    if (error || !job) {
      return NextResponse.json({ job: null })
    }

    // Lock it (optimistic)
    await supabase
      .from('agent_jobs')
      .update({ status: 'processing', locked_by: workerId, attempts: job.attempts + 1 })
      .eq('id', job.id)
      .eq('status', 'queued')

    return NextResponse.json({ job })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: enqueue, complete, run_auto_review
export async function POST(request: NextRequest) {
  if (!checkToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action } = body
    const supabase = getSupabase()

    if (action === 'enqueue') {
      const { job_type, payload, scheduled_for } = body
      if (!job_type) {
        return NextResponse.json({ error: 'job_type required' }, { status: 400 })
      }
      const { error } = await supabase.from('agent_jobs').insert({
        job_type,
        payload: payload || {},
        scheduled_for: scheduled_for || new Date().toISOString(),
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (action === 'complete') {
      const { job_id, success, error: jobError } = body
      await supabase.from('agent_jobs').update({
        status: success ? 'completed' : 'failed',
        last_error: jobError || null,
        completed_at: new Date().toISOString(),
        locked_by: null,
      }).eq('id', job_id)
      return NextResponse.json({ success: true })
    }

    if (action === 'run_auto_review') {
      // Process applications in 'reviewing' status using deterministic rules
      if (!AUTO_APPROVAL_ENABLED) {
        return NextResponse.json({ error: 'Auto-approval is disabled', skipped: true })
      }

      // Check daily cap (default to blocking if query fails)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count: todayApprovals, error: countError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('actor', 'automation')
        .eq('action', 'status_change')
        .eq('after_state', 'verified')
        .gte('created_at', todayStart.toISOString())

      if (countError) {
        return NextResponse.json({ error: 'Failed to check daily cap, blocking auto-approvals', skipped: true })
      }

      if ((todayApprovals || 0) >= MAX_AUTO_APPROVALS_PER_DAY) {
        return NextResponse.json({ error: 'Daily auto-approval cap reached', skipped: true })
      }

      // Get reviewing applications that haven't been flagged
      const { data: apps } = await supabase
        .from('verification_applications')
        .select('*')
        .eq('status', 'reviewing')
        .eq('requires_human_override', false)
        .order('created_at', { ascending: true })
        .limit(MAX_AUTO_APPROVALS_PER_DAY - (todayApprovals || 0))

      const results: Array<{ id: string; action: string; reason: string }> = []

      for (const app of apps || []) {
        // === DETERMINISTIC RULES ===
        const checks = {
          email_verified: app.email_verified === true,
          has_identity_link: !!app.identity_link && app.identity_link.startsWith('http'),
          has_description: !!app.agent_description && app.agent_description.length >= 20,
          has_skills: Array.isArray(app.agent_skills) && app.agent_skills.length > 0,
          has_platform: !!app.agent_platform,
        }

        const allPassed = Object.values(checks).every(Boolean)
        const score = Object.values(checks).filter(Boolean).length / Object.values(checks).length

        // Update score
        await supabase
          .from('verification_applications')
          .update({ auto_review_score: score })
          .eq('id', app.id)

        if (allPassed && score === 1) {
          // Auto-approve: generate unique handle
          const baseHandle = generateHandle(app.agent_name)

          if (!baseHandle) {
            await supabase
              .from('verification_applications')
              .update({ requires_human_override: true, last_action_at: new Date().toISOString() })
              .eq('id', app.id)

            await writeAuditLog({
              application_id: app.id,
              actor: 'automation',
              action: 'flagged_for_human',
              reason: 'Invalid agent name for handle',
            })

            results.push({ id: app.id, action: 'flagged', reason: 'Invalid agent name for handle' })
            continue
          }

          let handle = baseHandle
          let suffix = 1
          let handleOk = false
          let handleErrorReason: string | null = null

          while (true) {
            const { data: existingHandles, error: handleError } = await supabase
              .from('verification_applications')
              .select('id')
              .eq('handle', handle)
              .limit(1)

            if (handleError) {
              handleErrorReason = handleError.message
              break
            }

            if (!existingHandles || existingHandles.length === 0 || existingHandles[0].id === app.id) {
              handleOk = true
              break
            }

            handle = `${baseHandle}-${suffix}`
            suffix += 1

            if (suffix > 20) {
              handleErrorReason = 'Unable to generate unique handle'
              break
            }
          }

          if (!handleOk) {
            await supabase
              .from('verification_applications')
              .update({ requires_human_override: true, last_action_at: new Date().toISOString() })
              .eq('id', app.id)

            await writeAuditLog({
              application_id: app.id,
              actor: 'automation',
              action: 'flagged_for_human',
              reason: handleErrorReason || 'Handle generation failed',
            })

            results.push({ id: app.id, action: 'flagged', reason: handleErrorReason || 'Handle generation failed' })
            continue
          }

          const badge_token = crypto.randomBytes(16).toString('hex')

          const result = await transitionStatus({
            applicationId: app.id,
            currentStatus: app.status as VerificationStatus,
            newStatus: 'verified',
            actor: 'automation',
            reason: `Auto-approved: all checks passed (score=${score})`,
            extraFields: { handle, badge_token, identity_verified: true, auto_review_score: score },
          })

          results.push({ id: app.id, action: result.success ? 'approved' : 'failed', reason: result.error || 'ok' })
        } else {
          // Flag for human review
          await supabase
            .from('verification_applications')
            .update({ requires_human_override: true, last_action_at: new Date().toISOString() })
            .eq('id', app.id)

          await writeAuditLog({
            application_id: app.id,
            actor: 'automation',
            action: 'flagged_for_human',
            reason: `Failed checks: ${JSON.stringify(checks)}`,
          })

          results.push({ id: app.id, action: 'flagged', reason: JSON.stringify(checks) })
        }
      }

      return NextResponse.json({ processed: results.length, results })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
