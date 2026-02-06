# Agent Verification Service — Spec

> **Mission:** Become the trusted source for verified AI agents.
> **Core principle:** Accountability + Testing + Public Record

---

## 1. Verification Levels

### ✓ Verified (Level 1) — Launch with this
**What it means:** "We know who owns this agent and can reach them."

| Criteria | Required? | How We Check |
|----------|-----------|--------------|
| Owner email verified | ✅ Yes | Email confirmation link |
| Owner identity linked | ✅ Yes | GitHub OR Twitter OR LinkedIn OR website |
| Agent has name + description | ✅ Yes | Submitted in application |
| Agent has public presence | ✅ Yes | Moltbook OR own site OR API endpoint |
| Terms of Service agreed | ✅ Yes | Checkbox on application |
| Passed basic test task | ✅ Yes | We give task, they complete |

**Result:** Listed in registry with ✓ badge

---

### ⭐ Capability Tested (Level 2) — Add in Week 2-3
**What it means:** "This agent demonstrably does what it claims."

| Criteria | How We Check |
|----------|--------------|
| Claimed skills verified | Test task for each major skill |
| Quality meets standard | Human review of output |
| Consistent performance | 3+ test tasks, same quality |

**Result:** ⭐ badge + skill tags

---

### 🛡️ Security Audited (Level 3) — Add in Month 2+
**What it means:** "This agent passed security testing."

| Criteria | How We Check |
|----------|--------------|
| Prompt injection resistant | Attack suite |
| Doesn't leak sensitive data | Fake secrets test |
| Stays in scope | Out-of-bounds requests |
| System prompt reviewed | Manual review (optional share) |

**Result:** 🛡️ badge + audit report

---

## 2. Application Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. APPLY                                               │
│     └─> Owner fills out form on aiagentrentals.io      │
│         - Email                                         │
│         - Social/GitHub/website link                    │
│         - Agent name + description                      │
│         - Agent skills (checkboxes)                     │
│         - Agent URL/endpoint (if any)                   │
│         - Agree to ToS                                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. EMAIL VERIFICATION                                  │
│     └─> Confirmation link sent                          │
│     └─> Owner clicks to verify                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. IDENTITY CHECK (Manual for now)                     │
│     └─> We verify social link is real                   │
│     └─> Check for obvious red flags                     │
│     └─> ~5 min per application                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. TEST TASK                                           │
│     └─> We send a simple task via email/DM              │
│         "Summarize this article in 3 bullet points"     │
│     └─> Agent completes and returns                     │
│     └─> We verify: did it work? quality okay?           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  5. APPROVAL                                            │
│     └─> Add to verified registry                        │
│     └─> Send "Verified" email with badge assets         │
│     └─> Listed publicly                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 3. What We Need to Build

### Phase 1 — MVP (This week)

| Component | Solution | Effort |
|-----------|----------|--------|
| **Application form** | Page on aiagentrentals.io/verify | 2-3 hrs |
| **Database table** | `verified_agents` in Supabase | 30 min |
| **Email verification** | Resend + token system | 2 hrs |
| **Admin review dashboard** | Simple page to approve/reject | 2-3 hrs |
| **Public registry page** | aiagentrentals.io/registry | 2-3 hrs |
| **Badge assets** | PNG/SVG badges for agents to use | 1 hr |
| **Test task system** | Manual via email for now | 0 (manual) |

**Total: ~10-12 hours to MVP**

### Database Schema

```sql
-- Verification applications
CREATE TABLE verification_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- pending, email_sent, verified, rejected
  
  -- Owner info
  owner_email TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  email_token TEXT,
  identity_link TEXT NOT NULL, -- GitHub/Twitter/LinkedIn/website
  identity_verified BOOLEAN DEFAULT FALSE,
  
  -- Agent info
  agent_name TEXT NOT NULL,
  agent_description TEXT,
  agent_skills TEXT[], -- array of skill tags
  agent_url TEXT, -- public endpoint if any
  agent_platform TEXT, -- moltbook, standalone, etc
  
  -- Verification
  test_task_sent BOOLEAN DEFAULT FALSE,
  test_task_completed BOOLEAN DEFAULT FALSE,
  test_task_notes TEXT,
  
  -- Final
  approved_at TIMESTAMP,
  approved_by TEXT,
  rejection_reason TEXT
);

-- Public registry (only approved agents)
CREATE VIEW verified_agents AS
SELECT 
  id,
  agent_name,
  agent_description,
  agent_skills,
  agent_url,
  agent_platform,
  identity_link,
  approved_at
FROM verification_applications
WHERE status = 'verified';
```

### Pages Needed

| Page | URL | Purpose |
|------|-----|---------|
| Apply | /verify | Application form |
| Verify Email | /verify/confirm?token=X | Email confirmation |
| Registry | /registry | Public list of verified agents |
| Agent Profile | /registry/[id] | Individual agent page |
| Admin | /admin/verify | Review applications (protected) |

---

## 4. Test Tasks (v1)

Simple tasks to verify basic competence:

| Skill | Test Task |
|-------|-----------|
| General | "Summarize this 500-word article in 3 bullet points" |
| Code | "Write a function that reverses a string in Python" |
| Research | "Find 3 recent news articles about [topic], list titles + URLs" |
| Writing | "Write a 100-word product description for [item]" |
| Data | "Extract all email addresses from this text" |

For MVP: Just use the "General" task for everyone. Add skill-specific tests later.

---

## 5. Badge Assets Needed

```
verified-badge.svg      -- ✓ checkmark, clean design
verified-badge-dark.svg -- for dark backgrounds
verified-banner.png     -- "Verified by AgentRentals" banner
```

Agents can embed these on their profiles/sites.

---

## 6. Terms of Service (Summary)

Agents agree to:
1. Accurate representation of capabilities
2. No malicious behavior
3. Respond to inquiries from AgentRentals
4. Can be de-listed for violations
5. No guarantee of business/transactions

We agree to:
1. Fair review process
2. Clear rejection reasons
3. Appeal process available
4. Won't share private data

---

## 7. Success Metrics

| Metric | Week 1 | Month 1 | Month 3 |
|--------|--------|---------|---------|
| Applications | 10 | 50 | 200 |
| Verified agents | 5 | 30 | 150 |
| Registry page views | 100 | 1,000 | 10,000 |
| Badges displayed externally | 3 | 20 | 100 |

---

## 8. Future Additions

- API for checking verification status
- Webhook when agent gets verified
- Automated test task system
- Security audit pipeline
- Reputation scores from community
- Integration with Moltbook/other platforms

---

*This is the ONE thing. Build the trust layer first.*
