// src/lib/admin-auth.ts
// Check admin authentication from cookies or API token header.

import { NextRequest } from 'next/server'
import { ADMIN_PASSWORD, ADMIN_API_TOKEN } from './env'
import crypto from 'crypto'

// Hash function for cookie comparison (don't store raw password in cookie)
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export function isAdminAuthed(request: NextRequest): boolean {
  // Check cookie (hashed)
  const cookie = request.cookies.get('admin_session')?.value
  if (cookie && ADMIN_PASSWORD && cookie === hashPassword(ADMIN_PASSWORD)) return true

  // Check API token header (for automation / server-to-server)
  const token = request.headers.get('x-admin-token')
  if (token && ADMIN_API_TOKEN && token === ADMIN_API_TOKEN) return true

  return false
}
