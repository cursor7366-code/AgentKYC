---
name: AgentKYC Master Build Plan
overview: Autonomy-first plan to harden the existing MVP, add guardrails, and build a lean verification platform that can be safely managed by an autonomous agent. Every file, function, and schema change is spelled out so an LLM can execute without improvising.
todos:
  - id: phase-1
    content: "Phase 1: Foundation + guardrails -- env.ts, types.ts, state machine, audit_logs table, migration consolidation, delete schema.sql"
    status: completed
  - id: phase-2
    content: "Phase 2: Minimal admin + review loop -- /admin UI, scoped auth, queue actions, audit trail"
    status: completed
  - id: phase-3
    content: "Phase 3: Public profiles + status/badge APIs -- /agent/[handle], /api/status/[handle], /api/badge/[handle]"
    status: completed
  - id: phase-4
    content: "Phase 4: Autonomy engine -- agent_jobs queue, deterministic rules, kill switch, worker endpoint"
    status: completed
  - id: phase-5
    content: "Phase 5: UX polish -- landing page live stats, registry pagination, meta tags, seed data"
    status: completed
isProject: false
---

# AgentKYC Master Build Plan (Autonomy-First, Fully Specified)

---

## Existing File Inventory (Do Not Recreate)

These files exist and work. The plan references them by path. Read each before editing.

- `src/lib/supabase.ts` -- Supabase singleton client (throws if env missing)
- `src/lib/circle.ts` -- Circle escrow code (dormant, do NOT touch)
- `src/app/page.tsx` -- Landing page (static marketing)
- `src/app/layout.tsx` -- Root layout with metadata
- `src/app/globals.css` -- Tailwind import + CSS vars
- `src/app/verify/page.tsx` -- Verification form (client component)
- `src/app/verify/confirm/page.tsx` -- Email confirmation page (client)
- `src/app/api/verify/route.ts` -- POST: submit app, GET: check status
- `src/app/api/verify/confirm/route.ts` -- GET: confirm email token
- `src/app/api/registry/route.ts` -- GET: list verified agents
- `src/app/api/health/route.ts` -- GET: health check
- `src/app/registry/page.tsx` -- Public registry (client component)
- `supabase/migrations/002_verification_table.sql` -- Main schema
- `supabase/migrations/002_escrow_columns.sql` -- Legacy escrow columns (do NOT touch)
- `schema.sql` -- Legacy AgentRent schema (DELETE in Phase 1)
- `package.json` -- Dependencies (Next 16, React 19, Supabase, Tailwind 4)

---

## PHASE 1: Foundation + Guardrails

### Step 1.1: Delete `schema.sql`

Delete the file at project root. It contains legacy AgentRent tables (agents, tasks, transactions) that do not belong in AgentKYC.

**Action:** Delete `schema.sql`

---

### Step 1.2: Create `src/lib/env.ts`

Create a new file that centralizes all environment variables and provides a `requireServerEnv()` helper to validate required server-only keys. Every other file that needs env vars will import from here instead of reading `process.env` directly.

```typescript
// src/lib/env.ts

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback
}

// Database
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL || ''
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Email (Postmark)
export const POSTMARK_API_KEY = process.env.POSTMARK_API_KEY || ''

// App
export const BASE_URL = optional('NEXT_PUBLIC_BASE_URL', 'https://agentkyc.io')
export const FROM_EMAIL = optional('FROM_EMAIL', 'AgentKYC <hello@agentkyc.io>')

// Admin
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
export const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || ''

// Automation
export const AUTOMATION_TOKEN = process.env.AUTOMATION_TOKEN || ''
export const AUTO_APPROVAL_ENABLED = process.env.AUTO_APPROVAL_ENABLED === 'true'
export const MAX_AUTO_APPROVALS_PER_DAY = parseInt(process.env.MAX_AUTO_APPROVALS_PER_DAY || '10', 10)

// Validation helper for server-side routes
export function requireServerEnv() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not set')
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
}
```

---

### Step 1.3: Create `src/lib/types.ts`

Create a single shared types file used by every API route and component.

```typescript
// src/lib/types.ts

export type VerificationStatus =
  | 'pending'
  | 'email_sent'
  | 'reviewing'
  | 'test_sent'
  | 'verified'
  | 'rejected'

export type IdentityType = 'github' | 'twitter' | 'linkedin' | 'website' | 'moltbook'

export interface VerificationApplication {
  id: string
  created_at: string
  updated_at: string
  status: VerificationStatus

  // Owner
  owner_email: string
  owner_name: string | null
  email_verified: boolean
  email_token: string | null
  email_token_expires: string | null
  identity_link: string
  identity_type: IdentityType
  identity_verified: boolean

  // Agent
  agent_name: string
  agent_description: string | null
  agent_skills: string[]
  agent_url: string | null
  agent_platform: string | null
  handle: string | null

  // Verification
  test_task_sent_at: string | null
  test_task_completed: boolean
  test_task_result: string | null
  test_task_notes: string | null

  // Review
  reviewer_notes: string | null
  approved_at: string | null
  approved_by: string | null
  rejection_reason: string | null

  // Badge
  badge_token: string | null

  // Automation
  requires_human_override: boolean
  auto_review_score: number | null
  last_action_at: string | null
}

export interface AuditLog {
  id: string
  created_at: string
  application_id: string | null
  actor: string          // 'admin', 'system', 'automation', email address
  action: string         // 'approve', 'reject', 'send_test', 'status_change', etc.
  before_state: string | null
  after_state: string | null
  reason: string | null
  metadata: Record<string, unknown> | null
}

export interface AgentJob {
  id: string
  created_at: string
  job_type: string       // 'send_reminder', 'auto_review', 'send_test_task', 'auto_approve'
  payload: Record<string, unknown>
  status: 'queued' | 'processing' | 'completed' | 'failed'
  scheduled_for: string
  locked_by: string | null
  attempts: number
  max_attempts: number
  last_error: string | null
  completed_at: string | null
}

// State machine: allowed transitions
export const ALLOWED_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  pending:    ['email_sent', 'reviewing', 'rejected'],
  email_sent: ['reviewing', 'rejected'],
  reviewing:  ['test_sent', 'verified', 'rejected'],
  test_sent:  ['verified', 'rejected', 'reviewing'],
  verified:   ['rejected'],  // revocation
  rejected:   ['pending'],   // re-application
}

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
```

---

### Step 1.4: Update `src/lib/supabase.ts`

Replace the entire file. Import env vars from `env.ts`. Remove the null-return pattern; throw instead so callers fail loudly.

```typescript
// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './env'

let instance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (instance) return instance

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not configured')
  }

  instance = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  return instance
}
```

---

### Step 1.5: Create `src/lib/audit.ts`

A single function used by every admin/automation action to write audit logs.

```typescript
// src/lib/audit.ts
import { getSupabase } from './supabase'

export async function writeAuditLog(params: {
  application_id?: string | null
  actor: string
  action: string
  before_state?: string | null
  after_state?: string | null
  reason?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const supabase = getSupabase()
  const { error } = await supabase.from('audit_logs').insert({
    application_id: params.application_id ?? null,
    actor: params.actor,
    action: params.action,
    before_state: params.before_state ?? null,
    after_state: params.after_state ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null,
  })
  if (error) console.error('[audit] Failed to write audit log:', error)
}
```

---

### Step 1.6: Create `src/lib/state-machine.ts`

A single function that transitions an application's status with validation and audit logging. Every status change in the entire app MUST go through this function.

```typescript
// src/lib/state-machine.ts
import { getSupabase } from './supabase'
import { writeAuditLog } from './audit'
import { canTransition, VerificationStatus } from './types'

export async function transitionStatus(params: {
  applicationId: string
  currentStatus: VerificationStatus
  newStatus: VerificationStatus
  actor: string
  reason?: string
  extraFields?: Record<string, unknown>
}): Promise<{ success: boolean; error?: string }> {
  const { applicationId, currentStatus, newStatus, actor, reason, extraFields } = params

  if (!canTransition(currentStatus, newStatus)) {
    return { success: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` }
  }

  const supabase = getSupabase()

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    last_action_at: new Date().toISOString(),
    ...extraFields,
  }

  if (newStatus === 'verified') {
    updateData.approved_at = new Date().toISOString()
    updateData.approved_by = actor
  }
  if (newStatus === 'rejected' && reason) {
    updateData.rejection_reason = reason
  }

  const { error } = await supabase
    .from('verification_applications')
    .update(updateData)
    .eq('id', applicationId)
    .eq('status', currentStatus)  // optimistic lock

  if (error) return { success: false, error: error.message }

  await writeAuditLog({
    application_id: applicationId,
    actor,
    action: 'status_change',
    before_state: currentStatus,
    after_state: newStatus,
    reason: reason ?? null,
  })

  return { success: true }
}
```

---

### Step 1.7: Create `src/lib/email.ts`

Centralized email sending utility using Postmark API.

```typescript
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
```

---

### Step 1.8: Consolidate Supabase migration

Create file `supabase/migrations/003_guardrails.sql` with the new columns and tables. Do NOT modify the existing migration files.

```sql
-- 003_guardrails.sql
-- Adds: handle, automation columns, audit_logs table, agent_jobs table

-- New columns on verification_applications
ALTER TABLE verification_applications ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE;
ALTER TABLE verification_applications ADD COLUMN IF NOT EXISTS requires_human_override BOOLEAN DEFAULT FALSE;
ALTER TABLE verification_applications ADD COLUMN IF NOT EXISTS auto_review_score NUMERIC DEFAULT NULL;
ALTER TABLE verification_applications ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_verification_handle ON verification_applications(handle);

-- Tighten public insert policy to prevent status escalation
DROP POLICY IF EXISTS "Anyone can apply" ON verification_applications;
CREATE POLICY "Anyone can apply" ON verification_applications
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND email_verified = false
    AND identity_verified = false
    AND requires_human_override = false
  );

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  application_id UUID REFERENCES verification_applications(id) ON DELETE SET NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  before_state TEXT,
  after_state TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_app ON audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Agent jobs queue table
CREATE TABLE IF NOT EXISTS agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  job_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  locked_by TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON agent_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON agent_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON agent_jobs(job_type);

-- RLS for audit_logs: public cannot read, service role only
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on audit_logs" ON audit_logs
  FOR ALL USING (auth.role() = 'service_role');

-- RLS for agent_jobs: service role only
ALTER TABLE agent_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on agent_jobs" ON agent_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- Update public_verified_agents view to include handle
CREATE OR REPLACE VIEW public_verified_agents AS
SELECT
  id,
  agent_name,
  agent_description,
  agent_skills,
  agent_url,
  agent_platform,
  identity_link,
  identity_type,
  approved_at,
  badge_token,
  handle
FROM verification_applications
WHERE status = 'verified'
ORDER BY approved_at DESC;
```

---

### Step 1.9: Update existing API routes to use shared imports

`**src/app/api/verify/route.ts**` -- Replace the local `getSupabase()` and email sending with imports from `src/lib/env.ts`, `src/lib/supabase.ts`, and `src/lib/email.ts`. Add explicit re-application logic and guard missing email config.

Specific changes:

- Line 5-10: delete local `getSupabase` function, add `import { getSupabase } from '@/lib/supabase'`
- Line 12: delete `const POSTMARK_API_KEY`, add `import { POSTMARK_API_KEY, BASE_URL, FROM_EMAIL } from '@/lib/env'`
- Add `import { sendEmail } from '@/lib/email'`
- Add `import { transitionStatus } from '@/lib/state-machine'` (required for re-application transition)
- Line 15: change `process.env.NEXT_PUBLIC_BASE_URL || 'https://agentkyc.io'` to `BASE_URL`
- Replace the email sending logic with `sendEmail({ to, subject, html })`
- Add guard: if `POSTMARK_API_KEY` is empty, return 500 before attempting to send email
- Existing application logic MUST be:
  - if `existing.status === 'verified'` => return 400 (already verified)
  - if `existing.status === 'rejected'` => call `transitionStatus` to `pending` with `extraFields` including updated fields, `email_token`, `email_token_expires`, `email_verified: false`, then send verification email
  - if `existing.status` is `pending` or `email_sent` => update fields, reset `email_token`/`email_token_expires`/`email_verified`, then send verification email (do NOT change status)
  - if `existing.status` is `reviewing` or `test_sent` => return 200 with `{ message: 'Application already under review' }` and **do not** reset email verification or send email
- GET handler: wrap in try/catch; if `getSupabase()` throws, return 500 with `{ error: 'Database not configured' }`

`**src/app/api/verify/confirm/route.ts**` -- Same pattern:

- Delete local `getSupabase`, import from `@/lib/supabase`
- Import `transitionStatus` from `@/lib/state-machine`
- Replace the raw `.update({ status: 'reviewing' })` call (lines 40-48) with:
  ```typescript
  const result = await transitionStatus({
    applicationId: application.id,
    currentStatus: application.status,
    newStatus: 'reviewing',
    actor: 'system',
    extraFields: { email_verified: true, email_token: null, email_token_expires: null }
  })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  ```

`**src/app/api/registry/route.ts**` -- Same pattern:

- Delete local `getSupabase`, import from `@/lib/supabase`
- Add `handle` to the select columns (after `identity_type`)
- Remove null check on supabase (it throws now)

`**src/app/api/health/route.ts**` -- Same pattern:

- Delete local `getSupabase`, import from `@/lib/supabase`
- Wrap in try/catch for the case where env vars are missing

---

## PHASE 2: Minimal Admin + Review Loop

### Step 2.1: Create `src/app/api/admin/auth/route.ts`

Simple password login that sets a cookie.

```typescript
// src/app/api/admin/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_PASSWORD } from '@/lib/env'
import { writeAuditLog } from '@/lib/audit'
import crypto from 'crypto'

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
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
}
```

---

### Step 2.2: Create `src/lib/admin-auth.ts`

Helper to check admin auth from cookies or API token header.

```typescript
// src/lib/admin-auth.ts
import { NextRequest } from 'next/server'
import { ADMIN_PASSWORD, ADMIN_API_TOKEN } from './env'
import crypto from 'crypto'

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export function isAdminAuthed(request: NextRequest): boolean {
  // Check cookie
  const cookie = request.cookies.get('admin_session')?.value
  if (cookie && ADMIN_PASSWORD && cookie === hashPassword(ADMIN_PASSWORD)) return true

  // Check API token header (for automation)
  const token = request.headers.get('x-admin-token')
  if (token && ADMIN_API_TOKEN && token === ADMIN_API_TOKEN) return true

  return false
}
```

---

### Step 2.3: Create `src/app/api/admin/route.ts`

Single admin API route with action-based dispatch. Supports: `list`, `get`, `approve`, `reject`, `send_test`, `audit`, `stats`.

```typescript
// src/app/api/admin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { isAdminAuthed } from '@/lib/admin-auth'
import { transitionStatus } from '@/lib/state-machine'
import { writeAuditLog } from '@/lib/audit'
import { POSTMARK_API_KEY, FROM_EMAIL } from '@/lib/env'
import { sendEmail } from '@/lib/email'
import { VerificationStatus } from '@/lib/types'
import crypto from 'crypto'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// GET: list applications or get single application or get audit logs
export async function GET(request: NextRequest) {
  if (!isAdminAuthed(request)) return unauthorized()

  const supabase = getSupabase()
  const action = request.nextUrl.searchParams.get('action') || 'list'

  if (action === 'list') {
    const statusFilter = request.nextUrl.searchParams.get('status')
    let query = supabase
      .from('verification_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ applications: data })
  }

  if (action === 'get') {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await supabase
      .from('verification_applications')
      .select('*')
      .eq('id', id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ application: data })
  }

  if (action === 'audit') {
    const appId = request.nextUrl.searchParams.get('application_id')
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (appId) query = query.eq('application_id', appId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ logs: data })
  }

  if (action === 'stats') {
    const { data, error } = await supabase
      .from('verification_applications')
      .select('status')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const counts: Record<string, number> = {}
    for (const row of data || []) {
      counts[row.status] = (counts[row.status] || 0) + 1
    }
    return NextResponse.json({ stats: counts, total: data?.length || 0 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// POST: approve, reject, send_test
export async function POST(request: NextRequest) {
  if (!isAdminAuthed(request)) return unauthorized()

  const body = await request.json()
  const { action, application_id, reason } = body

  if (!application_id) {
    return NextResponse.json({ error: 'application_id required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Fetch current application
  const { data: app, error: fetchErr } = await supabase
    .from('verification_applications')
    .select('*')
    .eq('id', application_id)
    .single()

  if (fetchErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (action === 'approve') {
    if (!['reviewing', 'test_sent'].includes(app.status)) {
      return NextResponse.json({ error: 'Invalid status for approval' }, { status: 400 })
    }

    // Generate unique handle from agent_name
    const baseHandle = app.agent_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)

    if (!baseHandle) {
      return NextResponse.json({ error: 'Invalid agent name for handle' }, { status: 400 })
    }

    let handle = baseHandle
    let suffix = 1

    while (true) {
      const { data: existingHandles, error: handleError } = await supabase
        .from('verification_applications')
        .select('id')
        .eq('handle', handle)
        .limit(1)

      if (handleError) {
        return NextResponse.json({ error: handleError.message }, { status: 500 })
      }

      if (!existingHandles || existingHandles.length === 0 || existingHandles[0].id === app.id) {
        break
      }

      handle = `${baseHandle}-${suffix}`
      suffix += 1

      if (suffix > 20) {
        return NextResponse.json({ error: 'Unable to generate unique handle' }, { status: 500 })
      }
    }

    // Generate badge token
    const badge_token = crypto.randomBytes(16).toString('hex')

    const result = await transitionStatus({
      applicationId: app.id,
      currentStatus: app.status as VerificationStatus,
      newStatus: 'verified',
      actor: 'admin',
      reason: reason || 'Approved by admin',
      extraFields: {
        handle,
        badge_token,
        identity_verified: true,
        test_task_completed: app.status === 'test_sent' ? true : app.test_task_completed,
      },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, handle })
  }

  if (action === 'reject') {
    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
    }

    const result = await transitionStatus({
      applicationId: app.id,
      currentStatus: app.status as VerificationStatus,
      newStatus: 'rejected',
      actor: 'admin',
      reason,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'send_test') {
    if (app.status !== 'reviewing') {
      return NextResponse.json({ error: 'Invalid status for test task' }, { status: 400 })
    }

    if (!POSTMARK_API_KEY) {
      return NextResponse.json({ error: 'POSTMARK_API_KEY not configured' }, { status: 500 })
    }

    const testTask = body.test_task || 'Please complete the following test task and reply to this email with your result.'

    // Send test task email using sendEmail helper
    try {
      await sendEmail({
        to: app.owner_email,
        subject: `AgentKYC Test Task for ${app.agent_name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Test Task for ${app.agent_name}</h1>
            <p>Hi ${app.owner_name || 'there'},</p>
            <p>As part of the AgentKYC verification process, please have your agent complete this task:</p>
            <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>${testTask}</strong></p>
            </div>
            <p>Reply to this email with the result within 72 hours.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">AgentKYC - The Trust Layer for the Agent Economy</p>
          </div>
        `,
      })
    } catch (error) {
      return NextResponse.json({ error: 'Failed to send test task email' }, { status: 500 })
    }

    const result = await transitionStatus({
      applicationId: app.id,
      currentStatus: app.status as VerificationStatus,
      newStatus: 'test_sent',
      actor: 'admin',
      reason: 'Test task sent',
      extraFields: {
        test_task_sent_at: new Date().toISOString(),
        test_task_notes: testTask,
      },
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
```

---

### Step 2.4: Create `src/app/admin/page.tsx`

Client component. Login form (if no cookie) then dashboard with: stats bar, status filter tabs, application list, and detail panel with action buttons.

The admin page must:

- Show a login form if not authenticated (POST to `/api/admin/auth`)
- After login, fetch `/api/admin?action=stats` for header counts
- Fetch `/api/admin?action=list` (with optional `&status=` filter)
- Display each application as a row: agent_name, owner_email, status, created_at
- Clicking a row fetches `/api/admin?action=get&id=...` and shows full detail
- Detail panel shows all fields + action buttons
- "Approve" button: POST `/api/admin` with `{ action: 'approve', application_id }`
- "Reject" button: prompts for reason, POST `/api/admin` with `{ action: 'reject', application_id, reason }`
- "Send Test" button: prompts for task text (pre-filled by skill), POST `/api/admin` with `{ action: 'send_test', application_id, test_task }`
- Disable "Approve" unless status is `reviewing` or `test_sent`
- Disable "Send Test" unless status is `reviewing`
- Status filter tabs at top: All | Pending | Reviewing | Test Sent | Verified | Rejected
- Use the same dark theme (bg-black, text-white, bg-gray-900 cards, blue-600 buttons) as the rest of the site

Predefined test tasks to pre-fill by primary skill:

```
Research: "Find 3 recent news articles about AI agent safety and summarize each in 2 sentences."
Writing: "Write a 100-word product description for a fictional AI scheduling assistant."
Code: "Write a Python function that takes a list of integers and returns the two numbers that add up to a target sum."
Data Analysis: "Given the numbers [12, 45, 67, 23, 89, 34, 56], calculate the mean, median, and identify any outliers."
Other/default: "Summarize the following article in 3 bullet points: [paste any public article URL]"
```

The page should be `'use client'` and manage its own state. It should store the auth session check by attempting a GET to `/api/admin?action=stats` on mount -- if 401, show login form.

---

## PHASE 3: Public Profiles + Status/Badge APIs

### Step 3.1: Create `src/app/agent/[handle]/page.tsx`

Server component (no `'use client'`). Fetches agent data server-side.

```typescript
// src/app/agent/[handle]/page.tsx
import { getSupabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'

// Same PLATFORM_LABELS and IDENTITY_ICONS maps from registry/page.tsx
const PLATFORM_LABELS: Record<string, string> = {
  moltbook: 'Moltbook', standalone: 'Standalone', openai: 'OpenAI GPT',
  anthropic: 'Anthropic Claude', other: 'Other',
}
const IDENTITY_ICONS: Record<string, string> = {
  github: '🐙', twitter: '🐦', linkedin: '💼', website: '🌐', moltbook: '📖',
}

export default async function AgentProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const supabase = getSupabase()

  const { data: agent } = await supabase
    .from('verification_applications')
    .select('agent_name, agent_description, agent_skills, agent_url, agent_platform, identity_link, identity_type, approved_at, badge_token, handle, owner_name')
    .eq('handle', handle)
    .eq('status', 'verified')
    .single()

  if (!agent) notFound()

  return (
    // Dark themed profile page showing:
    // - Agent name + verified checkmark
    // - Platform badge
    // - Description
    // - Skills as tags
    // - Identity link with icon
    // - Owner name
    // - Verified date
    // - "Embed this badge" section with copyable markdown:
    //   [![Verified by AgentKYC](https://agentkyc.io/api/badge/{handle})](https://agentkyc.io/agent/{handle})
    // - Back to registry link
    // Use same dark theme as rest of site.
  )
}
```

Generate the full JSX using the same Tailwind classes/patterns as `registry/page.tsx`. Include a section at the bottom with a `<pre>` block showing the embeddable badge markdown. Do NOT add a copy button (keep it server-only and simple).

---

### Step 3.2: Create `src/app/api/status/[handle]/route.ts`

Public JSON endpoint. No auth required. Returns verification status for external consumption.

```typescript
// src/app/api/status/[handle]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params
  const supabase = getSupabase()

  const { data: agent, error } = await supabase
    .from('verification_applications')
    .select('agent_name, agent_platform, agent_skills, approved_at, badge_token, handle, identity_verified, test_task_completed')
    .eq('handle', handle)
    .eq('status', 'verified')
    .single()

  if (error || !agent) {
    return NextResponse.json({ verified: false, handle }, { status: 404 })
  }

  const badges: string[] = ['identity']
  if (agent.identity_verified) badges.push('identity_verified')
  if (agent.test_task_completed) badges.push('behavioral_test')

  return NextResponse.json({
    verified: true,
    handle: agent.handle,
    agent_name: agent.agent_name,
    platform: agent.agent_platform,
    skills: agent.agent_skills,
    badges,
    verified_at: agent.approved_at,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  })
}
```

---

### Step 3.3: Create `src/app/api/badge/[handle]/route.ts`

Returns a dynamic SVG badge (shields.io style). Green if verified, gray if not found.

```typescript
// src/app/api/badge/[handle]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

function makeBadgeSVG(label: string, message: string, color: string): string {
  const labelWidth = label.length * 7 + 10
  const messageWidth = message.length * 7 + 10
  const totalWidth = labelWidth + messageWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img">
    <linearGradient id="s" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
    <g clip-path="url(#r)">
      <rect width="${labelWidth}" height="20" fill="#555"/>
      <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
      <rect width="${totalWidth}" height="20" fill="url(#s)"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
      <text x="${labelWidth / 2}" y="14">${label}</text>
      <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
    </g>
  </svg>`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params
  const supabase = getSupabase()

  const { data } = await supabase
    .from('verification_applications')
    .select('status')
    .eq('handle', handle)
    .eq('status', 'verified')
    .single()

  const svg = data
    ? makeBadgeSVG('AgentKYC', 'verified', '#4c1')
    : makeBadgeSVG('AgentKYC', 'unverified', '#999')

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
```

---

### Step 3.4: Update `src/app/registry/page.tsx`

Add `handle` to the `VerifiedAgent` interface. Make each agent card a clickable `<Link>` to `/agent/{handle}` (only if handle exists). Add `handle` to the `VerifiedAgent` interface and the fetch from `/api/registry`.

Specific changes to make:

- Add `handle: string | null` to the `VerifiedAgent` interface (after `approved_at`)
- Wrap each agent card `<div>` in a `<Link href={'/agent/' + agent.handle}>` if `agent.handle` is truthy, otherwise keep as `<div>`
- Add `onClick={e => e.stopPropagation()}` to internal `<a>` tags to prevent event bubbling

---

## PHASE 4: Autonomy Engine

### Step 4.1: Create `src/app/api/agent-jobs/route.ts`

Protected by `AUTOMATION_TOKEN`. Supports: `poll` (GET), `complete` (POST), `enqueue` (POST), `run_auto_review` (POST).

```typescript
// src/app/api/agent-jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { AUTOMATION_TOKEN, AUTO_APPROVAL_ENABLED, MAX_AUTO_APPROVALS_PER_DAY } from '@/lib/env'
import { transitionStatus } from '@/lib/state-machine'
import { writeAuditLog } from '@/lib/audit'
import { VerificationStatus } from '@/lib/types'
import crypto from 'crypto'

function checkToken(request: NextRequest): boolean {
  if (!AUTOMATION_TOKEN) return false
  const token = request.headers.get('x-automation-token')
  return token === AUTOMATION_TOKEN
}

// GET: poll for next queued job
export async function GET(request: NextRequest) {
  if (!checkToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Find oldest queued job that is due
  const { data: job, error } = await supabase
    .from('agent_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .single()

  if (error || !job) {
    return NextResponse.json({ job: null })
  }

  const workerId = request.headers.get('x-worker-id') || 'worker'

  // Lock it
  await supabase
    .from('agent_jobs')
    .update({ status: 'processing', locked_by: workerId, attempts: job.attempts + 1 })
    .eq('id', job.id)
    .eq('status', 'queued') // optimistic lock

  return NextResponse.json({ job })
}

// POST: actions -- enqueue, complete, run_auto_review
export async function POST(request: NextRequest) {
  if (!checkToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body
  const supabase = getSupabase()

  if (action === 'enqueue') {
    const { job_type, payload, scheduled_for } = body
    if (!job_type) {
      return NextResponse.json({ error: 'job_type required' }, { status: 400 })
    }
    const { error } = await supabase.from('agent_jobs').insert({
      job_type,
      payload: payload || {},
      scheduled_for: scheduled_for || new Date().toISOString(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'complete') {
    const { job_id, success, error: jobError } = body
    await supabase.from('agent_jobs').update({
      status: success ? 'completed' : 'failed',
      last_error: jobError || null,
      completed_at: new Date().toISOString(),
      locked_by: null,
    }).eq('id', job_id)
    return NextResponse.json({ success: true })
  }

  if (action === 'run_auto_review') {
    // Process all applications in 'reviewing' status using deterministic rules
    if (!AUTO_APPROVAL_ENABLED) {
      return NextResponse.json({ error: 'Auto-approval is disabled', skipped: true })
    }

    // Check daily cap
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count: todayApprovals } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('actor', 'automation')
      .eq('action', 'status_change')
      .eq('after_state', 'verified')
      .gte('created_at', todayStart.toISOString())

    if ((todayApprovals || 0) >= MAX_AUTO_APPROVALS_PER_DAY) {
      return NextResponse.json({ error: 'Daily auto-approval cap reached', skipped: true })
    }

    // Get reviewing applications
    const { data: apps } = await supabase
      .from('verification_applications')
      .select('*')
      .eq('status', 'reviewing')
      .eq('requires_human_override', false)
      .order('created_at', { ascending: true })
      .limit(MAX_AUTO_APPROVALS_PER_DAY - (todayApprovals || 0))

    const results: Array<{ id: string; action: string; reason: string }> = []

    for (const app of apps || []) {
      // === DETERMINISTIC RULES ===
      const checks = {
        email_verified: app.email_verified === true,
        has_identity_link: !!app.identity_link && app.identity_link.startsWith('http'),
        has_description: !!app.agent_description && app.agent_description.length >= 20,
        has_skills: Array.isArray(app.agent_skills) && app.agent_skills.length > 0,
        has_platform: !!app.agent_platform,
      }

      const allPassed = Object.values(checks).every(Boolean)
      const score = Object.values(checks).filter(Boolean).length / Object.values(checks).length

      // Update score
      await supabase
        .from('verification_applications')
        .update({ auto_review_score: score })
        .eq('id', app.id)

      if (allPassed && score === 1) {
        // Auto-approve (ensure unique handle)
        const baseHandle = app.agent_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50)

        if (!baseHandle) {
          await supabase
            .from('verification_applications')
            .update({ requires_human_override: true, last_action_at: new Date().toISOString() })
            .eq('id', app.id)

          await writeAuditLog({
            application_id: app.id,
            actor: 'automation',
            action: 'flagged_for_human',
            reason: 'Invalid agent name for handle',
          })

          results.push({ id: app.id, action: 'flagged', reason: 'Invalid agent name for handle' })
          continue
        }

        let handle = baseHandle
        let suffix = 1
        let handleOk = false
        let handleErrorReason: string | null = null

        while (true) {
          const { data: existingHandles, error: handleError } = await supabase
            .from('verification_applications')
            .select('id')
            .eq('handle', handle)
            .limit(1)

          if (handleError) {
            handleErrorReason = handleError.message
            break
          }

          if (!existingHandles || existingHandles.length === 0 || existingHandles[0].id === app.id) {
            handleOk = true
            break
          }

          handle = `${baseHandle}-${suffix}`
          suffix += 1

          if (suffix > 20) {
            handleErrorReason = 'Unable to generate unique handle'
            break
          }
        }

        if (!handleOk) {
          await supabase
            .from('verification_applications')
            .update({ requires_human_override: true, last_action_at: new Date().toISOString() })
            .eq('id', app.id)

          await writeAuditLog({
            application_id: app.id,
            actor: 'automation',
            action: 'flagged_for_human',
            reason: handleErrorReason || 'Handle generation failed',
          })

          results.push({ id: app.id, action: 'flagged', reason: handleErrorReason || 'Handle generation failed' })
          continue
        }

        const badge_token = crypto.randomBytes(16).toString('hex')

        const result = await transitionStatus({
          applicationId: app.id,
          currentStatus: app.status as VerificationStatus,
          newStatus: 'verified',
          actor: 'automation',
          reason: `Auto-approved: all checks passed (score=${score})`,
          extraFields: { handle, badge_token, identity_verified: true, auto_review_score: score },
        })

        results.push({ id: app.id, action: result.success ? 'approved' : 'failed', reason: result.error || 'ok' })
      } else {
        // Flag for human review
        await supabase
          .from('verification_applications')
          .update({ requires_human_override: true, last_action_at: new Date().toISOString() })
          .eq('id', app.id)

        await writeAuditLog({
          application_id: app.id,
          actor: 'automation',
          action: 'flagged_for_human',
          reason: `Failed checks: ${JSON.stringify(checks)}`,
        })

        results.push({ id: app.id, action: 'flagged', reason: JSON.stringify(checks) })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
```

---

### Step 4.2: Create `src/app/api/cron/route.ts`

A lightweight endpoint that Vercel Cron (or external cron) hits periodically. It enqueues jobs.

```typescript
// src/app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { AUTOMATION_TOKEN } from '@/lib/env'

export async function GET(request: NextRequest) {
  // Verify cron secret or automation token
  const token = request.headers.get('x-automation-token') ||
    request.nextUrl.searchParams.get('token')
  if (token !== AUTOMATION_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
}
```

Do NOT commit any cron token to the repo. Use an external cron (cron-job.org, GitHub Actions, etc.) to call:

`https://agentkyc.io/api/cron?token=YOUR_AUTOMATION_TOKEN`

If you later decide to use Vercel Cron, create `vercel.json` locally with the token and **do not commit it**.

---

### Step 4.3: Autonomous Worker Protocol (LLM Execution)

The autonomous agent must follow this exact loop using the existing API:

1. **Poll for a job**
  `GET /api/agent-jobs` with headers:  
  - `x-automation-token: AUTOMATION_TOKEN`  
  - `x-worker-id: openclaw`
2. **If job is null**
  - Sleep 60 seconds and repeat
3. **If job_type = auto_review**
  - Call `POST /api/agent-jobs` with body `{ action: 'run_auto_review' }`  
  - Then call `POST /api/agent-jobs` with body `{ action: 'complete', job_id, success: true }`
4. **If job_type = send_reminder**
  - Send a reminder email directly via Postmark:  
    - `POST https://api.postmarkapp.com/email`  
    - `X-Postmark-Server-Token: POSTMARK_API_KEY`  
    - Body must include:  
      - `From: FROM_EMAIL`  
      - `To: job.payload.email`  
      - `Subject: "Reminder: Test Task for {agent_name}"`  
      - `HtmlBody: <polite reminder HTML>`  
      - `TextBody: <plain text version>`
  - Then call `POST /api/agent-jobs` with body `{ action: 'complete', job_id, success: true }`
5. **If any error occurs**
  - Call `POST /api/agent-jobs` with body `{ action: 'complete', job_id, success: false, error: "..." }`

This worker loop is the only autonomous behavior. It does not edit the database directly; it only uses the API.

---

## PHASE 5: UX Polish

### Step 5.1: Update `src/app/page.tsx` (Landing Page)

Make the landing page a server component (it already is) that fetches live stats from Supabase.

Changes:

- Import `getSupabase` from `@/lib/supabase`
- At the top of the component, fetch verified agent count:
  ```typescript
  let verifiedCount = 0
  let inReviewCount = 0
  try {
    const supabase = getSupabase()
    const { count: verified } = await supabase
      .from('verification_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified')
    verifiedCount = verified || 0
    
    const { count: reviewing } = await supabase
      .from('verification_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'reviewing')
    inReviewCount = reviewing || 0
  } catch {}
  ```
- Display stats in the hero section below the tagline:
  ```
  {verifiedCount > 0 && <p className="text-blue-400 font-mono text-lg">{verifiedCount} agents verified</p>}
  {inReviewCount > 0 && <p className="text-gray-400 font-mono text-sm">{inReviewCount} in review</p>}
  ```
- Keep everything else identical.

### Step 5.2: Update `src/app/layout.tsx`

Add favicon link tag. Add OG image URL if one exists. No other changes.

### Step 5.3: Create `scripts/seed.ts`

A standalone TypeScript script that can be run with `npx tsx scripts/seed.ts` to insert the first verified agent (OpenClaw) directly into the database.

```typescript
// scripts/seed.ts
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PROJECT_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function seed() {
  const agents = [
    {
      owner_email: 'hello@agentkyc.io',
      owner_name: 'AgentKYC Team',
      identity_type: 'github',
      identity_link: 'https://github.com/cursor7366-code',
      identity_verified: true,
      email_verified: true,
      agent_name: 'OpenClaw',
      agent_description: 'The verification engine behind AgentKYC. Manages the trust pipeline, reviews applications, and maintains the agent registry.',
      agent_skills: ['Automation', 'Research', 'Data Analysis'],
      agent_platform: 'standalone',
      agent_url: 'https://agentkyc.io',
      status: 'verified',
      handle: 'openclaw',
      badge_token: crypto.randomBytes(16).toString('hex'),
      approved_at: new Date().toISOString(),
      approved_by: 'system',
      requires_human_override: false,
    },
  ]

  for (const agent of agents) {
    // Check if agent exists
    const { data: existing } = await supabase
      .from('verification_applications')
      .select('id, handle')
      .eq('handle', agent.handle)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('verification_applications')
        .update(agent)
        .eq('id', existing.id)
      if (error) {
        console.error(`Failed to update ${agent.agent_name}:`, error.message)
      } else {
        console.log(`Updated: ${agent.agent_name} -> /agent/${agent.handle}`)
      }
    } else {
      // Insert new
      const { error } = await supabase.from('verification_applications').insert(agent)
      if (error) {
        console.error(`Failed to seed ${agent.agent_name}:`, error.message)
      } else {
        console.log(`Seeded: ${agent.agent_name} -> /agent/${agent.handle}`)
      }
    }
  }

  // Write audit log
  await supabase.from('audit_logs').insert({
    actor: 'system',
    action: 'seed',
    reason: 'Initial seed of verified agents',
  })

  console.log('Done.')
}

seed()
```

---

## Environment Variables Checklist

All env vars needed for the complete build. Add these to `.env.local` (local dev) and Vercel environment settings (production):

```
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
POSTMARK_API_KEY=xxxxx...

# Optional (defaults shown)
NEXT_PUBLIC_BASE_URL=https://agentkyc.io
FROM_EMAIL=AgentKYC <hello@agentkyc.io>

# Admin
ADMIN_PASSWORD=<choose a strong password>
ADMIN_API_TOKEN=<random 64-char hex string for server-to-server>

# Automation
AUTOMATION_TOKEN=<random 64-char hex string>
AUTO_APPROVAL_ENABLED=false
MAX_AUTO_APPROVALS_PER_DAY=10
# AUTOMATION_TOKEN is used by /api/agent-jobs and /api/cron?token=...
```

---

## What We Are NOT Building (Scope Discipline)

These are explicitly deferred. Do NOT build any of these:

- Payment / escrow integration (circle.ts stays dormant)
- Endorsement system
- OAuth identity verification
- Embeddable JS widget (`public/embed.js`)
- Token / blockchain anything
- Automated test pipelines (test tasks are sent via email, reviewed manually or by automation rules)
- Agent persona infrastructure (SOUL.md, HEARTBEAT.md)
- Pricing / monetization

---

## File Creation/Modification Summary

**NEW files to create:**

1. `src/lib/env.ts`
2. `src/lib/types.ts`
3. `src/lib/audit.ts`
4. `src/lib/state-machine.ts`
5. `src/lib/email.ts`
6. `src/lib/admin-auth.ts`
7. `src/app/api/admin/auth/route.ts`
8. `src/app/api/admin/route.ts`
9. `src/app/admin/page.tsx`
10. `src/app/agent/[handle]/page.tsx`
11. `src/app/api/status/[handle]/route.ts`
12. `src/app/api/badge/[handle]/route.ts`
13. `src/app/api/agent-jobs/route.ts`
14. `src/app/api/cron/route.ts`
15. `supabase/migrations/003_guardrails.sql`
16. `scripts/seed.ts`

**EXISTING files to modify:**

1. `src/lib/supabase.ts` -- replace with env.ts imports, remove null return
2. `src/app/api/verify/route.ts` -- use shared imports, FROM_EMAIL, sendEmail helper
3. `src/app/api/verify/confirm/route.ts` -- use transitionStatus
4. `src/app/api/registry/route.ts` -- use shared imports, add handle
5. `src/app/api/health/route.ts` -- use shared imports
6. `src/app/registry/page.tsx` -- add handle to interface, link to profiles
7. `src/app/page.tsx` -- add live verified count

**FILES to delete:**

1. `schema.sql`
