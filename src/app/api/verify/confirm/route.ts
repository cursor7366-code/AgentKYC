import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { transitionStatus } from '@/lib/state-machine'
import { VerificationStatus } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()

    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Find application with this token
    const { data: application, error: findError } = await supabase
      .from('verification_applications')
      .select('*')
      .eq('email_token', token)
      .single()

    if (findError || !application) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    // Check if token expired
    if (new Date(application.email_token_expires) < new Date()) {
      return NextResponse.json({ error: 'Token expired. Please apply again.' }, { status: 400 })
    }

    // Use state machine for transition
    const result = await transitionStatus({
      applicationId: application.id,
      currentStatus: application.status as VerificationStatus,
      newStatus: 'reviewing',
      actor: 'system',
      extraFields: {
        email_verified: true,
        email_token: null,
        email_token_expires: null,
      },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      agent_name: application.agent_name,
      message: 'Email verified! Your application is now under review.',
    })
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }
}
