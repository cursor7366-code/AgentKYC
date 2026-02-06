-- Verification Applications Table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/qscfkxwgkejvktqzbfut/sql

CREATE TABLE IF NOT EXISTS verification_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'email_sent', 'reviewing', 'test_sent', 'verified', 'rejected')),
  
  -- Owner info
  owner_email TEXT NOT NULL,
  owner_name TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  email_token TEXT,
  email_token_expires TIMESTAMPTZ,
  identity_link TEXT NOT NULL,
  identity_type TEXT CHECK (identity_type IN ('github', 'twitter', 'linkedin', 'website', 'moltbook')),
  identity_verified BOOLEAN DEFAULT FALSE,
  
  -- Agent info
  agent_name TEXT NOT NULL,
  agent_description TEXT,
  agent_skills TEXT[] DEFAULT '{}',
  agent_url TEXT,
  agent_platform TEXT,
  
  -- Verification process
  test_task_sent_at TIMESTAMPTZ,
  test_task_completed BOOLEAN DEFAULT FALSE,
  test_task_result TEXT,
  test_task_notes TEXT,
  
  -- Review
  reviewer_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejection_reason TEXT,
  
  -- Badge
  badge_token TEXT UNIQUE,
  
  UNIQUE(owner_email, agent_name)
);

-- Index for lookups
CREATE INDEX idx_verification_status ON verification_applications(status);
CREATE INDEX idx_verification_email ON verification_applications(owner_email);
CREATE INDEX idx_verification_badge ON verification_applications(badge_token);

-- Enable RLS
ALTER TABLE verification_applications ENABLE ROW LEVEL SECURITY;

-- Public can insert (apply)
CREATE POLICY "Anyone can apply" ON verification_applications
  FOR INSERT WITH CHECK (true);

-- Public can read verified agents only
CREATE POLICY "Public can view verified agents" ON verification_applications
  FOR SELECT USING (status = 'verified');

-- Service role can do everything
CREATE POLICY "Service role full access" ON verification_applications
  FOR ALL USING (auth.role() = 'service_role');

-- View for public registry
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
  badge_token
FROM verification_applications
WHERE status = 'verified'
ORDER BY approved_at DESC;
