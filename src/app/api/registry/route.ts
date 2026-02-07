import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()

    const skill = request.nextUrl.searchParams.get('skill')
    const platform = request.nextUrl.searchParams.get('platform')

    let query = supabase
      .from('verification_applications')
      .select('id, agent_name, agent_description, agent_skills, agent_url, agent_platform, identity_link, identity_type, approved_at, handle')
      .eq('status', 'verified')
      .order('approved_at', { ascending: false })

    if (platform) {
      query = query.eq('agent_platform', platform)
    }

    if (skill) {
      query = query.contains('agent_skills', [skill])
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      agents: data || [],
      count: data?.length || 0,
    })
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }
}
