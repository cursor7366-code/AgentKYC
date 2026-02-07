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

-- RLS for audit_logs: service role only
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
