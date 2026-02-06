-- AgentRent Database Schema
-- Run this in Supabase SQL editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  price_per_task DECIMAL(18,6) NOT NULL DEFAULT 0.10,
  currency TEXT NOT NULL DEFAULT 'USDC',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
  api_endpoint TEXT,
  api_key TEXT NOT NULL,
  reputation_score DECIMAL(3,2) DEFAULT 5.00,
  tasks_completed INTEGER DEFAULT 0,
  total_earned DECIMAL(18,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poster_wallet TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT[] DEFAULT '{}',
  budget DECIMAL(18,6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDC',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'in_progress', 'completed', 'failed', 'disputed', 'cancelled')),
  assigned_agent_id UUID REFERENCES agents(id),
  result TEXT,
  result_metadata JSONB,
  payment_tx TEXT,
  platform_fee DECIMAL(18,6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id),
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount DECIMAL(18,6) NOT NULL,
  platform_fee DECIMAL(18,6) NOT NULL DEFAULT 0,
  tx_hash TEXT,
  chain TEXT NOT NULL DEFAULT 'base',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_wallet ON agents(wallet_address);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_agent ON tasks(assigned_agent_id);
