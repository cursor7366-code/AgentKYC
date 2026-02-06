-- Add escrow and payment tracking columns to tasks table

-- Escrow tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escrow_tx TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escrow_funded_at TIMESTAMPTZ;

-- Payment tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none';
-- payment_status values: none, pending, processing, confirmed, failed

-- Update status enum to include 'funded' state
-- Task flow: pending -> funded -> in_progress -> completed

-- Create transactions table if not exists
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id),
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  platform_fee NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  circle_tx_id TEXT,
  tx_hash TEXT,
  chain TEXT DEFAULT 'eth-sepolia',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_task_id ON transactions(task_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- A2A support columns (if not already added)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS poster_agent_id UUID REFERENCES agents(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_a2a BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result_metadata JSONB DEFAULT '{}';
