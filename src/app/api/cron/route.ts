import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { AUTOMATION_TOKEN } from '@/lib/env'

export async function GET(request: NextRequest) {
  // Verify automation token (from header or query param)
  const token = request.headers.get('x-automation-token') ||
    request.nextUrl.searchParams.get('token')

  if (!AUTOMATION_TOKEN || token !== AUTOMATION_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()

    // 1) Enqueue auto-review job
    await supabase.from('agent_jobs').insert({
      job_type: 'auto_review',
      payload: {},
      scheduled_for: new Date().toISOString(),
    })

    // 2) Find stalled applications (in 'test_sent' for > 72 hours) and enqueue reminders
    const stalledCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    const { data: stalled } = await supabase
      .from('verification_applications')
      .select('id, owner_email, agent_name')
      .eq('status', 'test_sent')
      .lt('test_task_sent_at', stalledCutoff)

    for (const app of stalled || []) {
      await supabase.from('agent_jobs').insert({
        job_type: 'send_reminder',
        payload: { application_id: app.id, email: app.owner_email, agent_name: app.agent_name },
        scheduled_for: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      enqueued: {
        auto_review: 1,
        reminders: stalled?.length || 0,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
