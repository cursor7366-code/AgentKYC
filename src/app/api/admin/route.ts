import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { isAdminAuthed } from '@/lib/admin-auth'
import { transitionStatus } from '@/lib/state-machine'
import { POSTMARK_API_KEY } from '@/lib/env'
import { sendEmail } from '@/lib/email'
import { VerificationStatus, generateHandle } from '@/lib/types'
import crypto from 'crypto'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// GET: list, get, audit, stats
export async function GET(request: NextRequest) {
  if (!isAdminAuthed(request)) return unauthorized()

  try {
    const supabase = getSupabase()
    const action = request.nextUrl.searchParams.get('action') || 'list'

    if (action === 'list') {
      const statusFilter = request.nextUrl.searchParams.get('status')
      let query = supabase
        .from('verification_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ applications: data })
    }

    if (action === 'get') {
      const id = request.nextUrl.searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

      const { data, error } = await supabase
        .from('verification_applications')
        .select('*')
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ application: data })
    }

    if (action === 'audit') {
      const appId = request.nextUrl.searchParams.get('application_id')
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (appId) query = query.eq('application_id', appId)

      const { data, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ logs: data })
    }

    if (action === 'stats') {
      const { data, error } = await supabase
        .from('verification_applications')
        .select('status')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const counts: Record<string, number> = {}
      for (const row of data || []) {
        counts[row.status] = (counts[row.status] || 0) + 1
      }
      return NextResponse.json({ stats: counts, total: data?.length || 0 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: approve, reject, send_test
export async function POST(request: NextRequest) {
  if (!isAdminAuthed(request)) return unauthorized()

  try {
    const body = await request.json()
    const { action, application_id, reason } = body

    if (!application_id) {
      return NextResponse.json({ error: 'application_id required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Fetch current application
    const { data: app, error: fetchErr } = await supabase
      .from('verification_applications')
      .select('*')
      .eq('id', application_id)
      .single()

    if (fetchErr || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (action === 'approve') {
      if (!['reviewing', 'test_sent'].includes(app.status)) {
        return NextResponse.json({ error: 'Invalid status for approval' }, { status: 400 })
      }

      // Generate unique handle
      const baseHandle = generateHandle(app.agent_name)
      if (!baseHandle) {
        return NextResponse.json({ error: 'Invalid agent name for handle generation' }, { status: 400 })
      }

      let handle = baseHandle
      let suffix = 1
      while (true) {
        const { data: existing } = await supabase
          .from('verification_applications')
          .select('id')
          .eq('handle', handle)
          .limit(1)

        if (!existing || existing.length === 0 || existing[0].id === app.id) {
          break
        }

        handle = `${baseHandle}-${suffix}`
        suffix += 1

        if (suffix > 20) {
          return NextResponse.json({ error: 'Unable to generate unique handle' }, { status: 500 })
        }
      }

      const badge_token = crypto.randomBytes(16).toString('hex')

      const result = await transitionStatus({
        applicationId: app.id,
        currentStatus: app.status as VerificationStatus,
        newStatus: 'verified',
        actor: 'admin',
        reason: reason || 'Approved by admin',
        extraFields: {
          handle,
          badge_token,
          identity_verified: true,
          test_task_completed: app.status === 'test_sent' ? true : app.test_task_completed,
        },
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ success: true, handle })
    }

    if (action === 'reject') {
      if (!reason) {
        return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
      }

      const result = await transitionStatus({
        applicationId: app.id,
        currentStatus: app.status as VerificationStatus,
        newStatus: 'rejected',
        actor: 'admin',
        reason,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'send_test') {
      if (app.status !== 'reviewing') {
        return NextResponse.json({ error: 'Invalid status for test task' }, { status: 400 })
      }

      if (!POSTMARK_API_KEY) {
        return NextResponse.json({ error: 'POSTMARK_API_KEY not configured' }, { status: 500 })
      }

      const testTask = body.test_task || 'Please complete the following test task and reply to this email with your result.'

      try {
        await sendEmail({
          to: app.owner_email,
          subject: `AgentKYC Test Task for ${app.agent_name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>Test Task for ${app.agent_name}</h1>
              <p>Hi ${app.owner_name || 'there'},</p>
              <p>As part of the AgentKYC verification process, please have your agent complete this task:</p>
              <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p><strong>${testTask}</strong></p>
              </div>
              <p>Reply to this email with the result within 72 hours.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">AgentKYC - The Trust Layer for the Agent Economy</p>
            </div>
          `,
        })
      } catch (emailError) {
        return NextResponse.json({ error: `Failed to send test task email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}` }, { status: 500 })
      }

      const result = await transitionStatus({
        applicationId: app.id,
        currentStatus: app.status as VerificationStatus,
        newStatus: 'test_sent',
        actor: 'admin',
        reason: 'Test task sent',
        extraFields: {
          test_task_sent_at: new Date().toISOString(),
          test_task_notes: testTask,
        },
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
