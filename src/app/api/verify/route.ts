import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { POSTMARK_API_KEY, BASE_URL } from '@/lib/env'
import { sendEmail } from '@/lib/email'
import { transitionStatus } from '@/lib/state-machine'
import { VerificationStatus } from '@/lib/types'
import crypto from 'crypto'

async function sendVerificationEmail(email: string, token: string, agentName: string) {
  const verifyUrl = `${BASE_URL}/verify/confirm?token=${token}`

  await sendEmail({
    to: email,
    subject: `Verify your agent: ${agentName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Verify Your Agent</h1>
        <p>Thanks for applying to get <strong>${agentName}</strong> verified on AgentKYC!</p>
        <p>Click the button below to confirm your email and continue the verification process:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Or copy this link: <br/>
          <a href="${verifyUrl}">${verifyUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px;">
          This link expires in 24 hours.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px;">
          AgentKYC - The Trust Layer for the Agent Economy<br/>
          <a href="https://agentkyc.io">agentkyc.io</a>
        </p>
      </div>
    `,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      owner_email: rawEmail,
      owner_name,
      identity_type,
      identity_link,
      agent_name,
      agent_description,
      agent_skills,
      agent_url,
      agent_platform,
    } = body

    // Normalize email to lowercase (edge case: case-variant duplicates)
    const owner_email = rawEmail?.toLowerCase()?.trim()

    // Validate required fields
    if (!owner_email || !owner_name || !identity_type || !identity_link || !agent_name || !agent_description || !agent_platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate agent_name produces a usable handle (edge case: only special chars)
    const testHandle = agent_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!testHandle) {
      return NextResponse.json({ error: 'Agent name must contain at least one alphanumeric character' }, { status: 400 })
    }

    // Validate agent_name length
    if (agent_name.length > 100) {
      return NextResponse.json({ error: 'Agent name must be 100 characters or less' }, { status: 400 })
    }

    // Validate description length
    if (agent_description && agent_description.length > 2000) {
      return NextResponse.json({ error: 'Description must be 2000 characters or less' }, { status: 400 })
    }

    // Validate identity_link is a URL
    try {
      new URL(identity_link)
    } catch {
      return NextResponse.json({ error: 'Identity link must be a valid URL' }, { status: 400 })
    }

    // Guard: email service must be configured
    if (!POSTMARK_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    // Generate email verification token
    const email_token = crypto.randomBytes(32).toString('hex')
    const email_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const supabase = getSupabase()

    // Check if application already exists
    const { data: existing } = await supabase
      .from('verification_applications')
      .select('id, status')
      .eq('owner_email', owner_email)
      .eq('agent_name', agent_name)
      .single()

    if (existing) {
      if (existing.status === 'verified') {
        return NextResponse.json({ error: 'This agent is already verified' }, { status: 400 })
      }

      // If under active review, don't reset
      if (existing.status === 'reviewing' || existing.status === 'test_sent') {
        return NextResponse.json({
          success: true,
          message: 'Application already under review',
        })
      }

      // If rejected, transition back to pending
      if (existing.status === 'rejected') {
        // Send email first (edge case: if email fails, don't change DB state)
        await sendVerificationEmail(owner_email, email_token, agent_name)

        const result = await transitionStatus({
          applicationId: existing.id,
          currentStatus: existing.status as VerificationStatus,
          newStatus: 'pending',
          actor: owner_email,
          reason: 'Re-application after rejection',
          extraFields: {
            owner_name,
            identity_type,
            identity_link,
            agent_description,
            agent_skills,
            agent_url,
            agent_platform,
            email_token,
            email_token_expires,
            email_verified: false,
          },
        })

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Verification email sent',
        })
      }

      // Status is pending or email_sent: update fields and resend email
      // Send email first (edge case fix)
      await sendVerificationEmail(owner_email, email_token, agent_name)

      const { error } = await supabase
        .from('verification_applications')
        .update({
          owner_name,
          identity_type,
          identity_link,
          agent_description,
          agent_skills,
          agent_url,
          agent_platform,
          email_token,
          email_token_expires,
          email_verified: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      // Send email first, then create record (edge case: email fails = no orphan record)
      await sendVerificationEmail(owner_email, email_token, agent_name)

      const { error } = await supabase
        .from('verification_applications')
        .insert({
          owner_email,
          owner_name,
          identity_type,
          identity_link,
          agent_name,
          agent_description,
          agent_skills,
          agent_url,
          agent_platform,
          email_token,
          email_token_expires,
          status: 'pending',
        })

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Verification error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET: Check verification status by email
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase()

    const email = request.nextUrl.searchParams.get('email')?.toLowerCase()?.trim()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('verification_applications')
      .select('agent_name, status, approved_at')
      .eq('owner_email', email)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ applications: data })
  } catch {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }
}
