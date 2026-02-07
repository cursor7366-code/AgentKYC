import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params

  try {
    const supabase = getSupabase()

    const { data: agent, error } = await supabase
      .from('verification_applications')
      .select('agent_name, agent_platform, agent_skills, approved_at, badge_token, handle, identity_verified, test_task_completed')
      .eq('handle', handle)
      .eq('status', 'verified')
      .single()

    if (error || !agent) {
      return NextResponse.json({ verified: false, handle }, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=60' },
      })
    }

    const badges: string[] = ['identity']
    if (agent.identity_verified) badges.push('identity_verified')
    if (agent.test_task_completed) badges.push('behavioral_test')

    return NextResponse.json(
      {
        verified: true,
        handle: agent.handle,
        agent_name: agent.agent_name,
        platform: agent.agent_platform,
        skills: agent.agent_skills,
        badges,
        verified_at: agent.approved_at,
      },
      {
        headers: { 'Cache-Control': 'public, max-age=300' },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
