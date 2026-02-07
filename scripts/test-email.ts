// scripts/test-email.ts
// Test Postmark email sending
// Usage: npx tsx scripts/test-email.ts <your-email>

import { sendEmail } from '../src/lib/email'

const testEmail = process.argv[2]

if (!testEmail) {
  console.error('Usage: npx tsx scripts/test-email.ts <your-email>')
  process.exit(1)
}

async function test() {
  try {
    console.log(`Sending test email to ${testEmail}...`)
    const result = await sendEmail({
      to: testEmail,
      subject: 'AgentKYC Postmark Test',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Postmark Test</h1>
          <p>This is a test email from AgentKYC to verify Postmark integration is working.</p>
          <p>If you received this, Postmark is configured correctly! ✅</p>
        </div>
      `,
    })
    console.log('✅ Email sent successfully!')
    console.log('Result:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('❌ Failed to send email:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

test()
