import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

async function sendVerificationEmail(email: string, token: string, agentName: string) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://agentkyc.io'}/verify/confirm?token=${token}`;
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'AgentKYC <hello@agentkyc.io>',
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
      `
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to send email: ${error.message}`);
  }
  
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      owner_email,
      owner_name,
      identity_type,
      identity_link,
      agent_name,
      agent_description,
      agent_skills,
      agent_url,
      agent_platform
    } = body;

    // Validate required fields
    if (!owner_email || !owner_name || !identity_type || !identity_link || !agent_name || !agent_description || !agent_platform) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate email verification token
    const email_token = crypto.randomBytes(32).toString('hex');
    const email_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Check if application already exists
    const { data: existing } = await supabase
      .from('verification_applications')
      .select('id, status')
      .eq('owner_email', owner_email)
      .eq('agent_name', agent_name)
      .single();

    if (existing) {
      if (existing.status === 'verified') {
        return NextResponse.json({ error: 'This agent is already verified' }, { status: 400 });
      }
      // Update existing application
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
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Create new application
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
          status: 'pending'
        });

      if (error) throw error;
    }

    // Send verification email
    await sendVerificationEmail(owner_email, email_token, agent_name);

    return NextResponse.json({ 
      success: true, 
      message: 'Verification email sent' 
    });

  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// GET: Check verification status by email
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  const email = request.nextUrl.searchParams.get('email');
  
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('verification_applications')
    .select('agent_name, status, approved_at')
    .eq('owner_email', email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applications: data });
}
