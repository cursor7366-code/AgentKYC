// src/lib/email.ts
// Email sending via Postmark API

import { POSTMARK_API_KEY, FROM_EMAIL } from './env'

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text?: string
}) {
  if (!POSTMARK_API_KEY) {
    throw new Error('POSTMARK_API_KEY not configured')
  }

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': POSTMARK_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      From: FROM_EMAIL,
      To: params.to,
      Subject: params.subject,
      HtmlBody: params.html,
      TextBody: params.text || params.html.replace(/<[^>]*>/g, ''), // Strip HTML for text fallback
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ Message: 'Unknown error' }))
    throw new Error(`Failed to send email: ${error.Message || error.message || 'Unknown error'}`)
  }

  return response.json()
}
