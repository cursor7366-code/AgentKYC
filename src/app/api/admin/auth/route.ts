import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_PASSWORD } from '@/lib/env'
import { writeAuditLog } from '@/lib/audit'
import { hashPassword } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Admin not configured' }, { status: 500 })
    }

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    await writeAuditLog({ actor: 'admin', action: 'admin_login' })

    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_session', hashPassword(ADMIN_PASSWORD), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })
    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
