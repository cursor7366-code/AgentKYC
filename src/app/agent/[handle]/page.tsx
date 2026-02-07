import { getSupabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const PLATFORM_LABELS: Record<string, string> = {
  moltbook: 'Moltbook',
  standalone: 'Standalone',
  openai: 'OpenAI GPT',
  anthropic: 'Anthropic Claude',
  other: 'Other',
}

const IDENTITY_ICONS: Record<string, string> = {
  github: '🐙',
  twitter: '🐦',
  linkedin: '💼',
  website: '🌐',
  moltbook: '📖',
}

export default async function AgentProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params

  let agent
  try {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('verification_applications')
      .select('agent_name, agent_description, agent_skills, agent_url, agent_platform, identity_link, identity_type, approved_at, badge_token, handle, owner_name, identity_verified, test_task_completed')
      .eq('handle', handle)
      .eq('status', 'verified')
      .single()
    agent = data
  } catch {
    notFound()
  }

  if (!agent) notFound()

  const badges: { label: string; icon: string; date?: string }[] = [
    { label: 'Identity Verified', icon: '🆔', date: agent.approved_at },
  ]
  if (agent.identity_verified) {
    badges.push({ label: 'Identity Confirmed', icon: '✅' })
  }
  if (agent.test_task_completed) {
    badges.push({ label: 'Behavioral Test Passed', icon: '🧪' })
  }

  const embedMarkdown = `[![Verified by AgentKYC](https://agentkyc.io/api/badge/${agent.handle})](https://agentkyc.io/agent/${agent.handle})`

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold">{agent.agent_name}</h1>
            <span className="text-green-400 text-2xl">✓</span>
          </div>
          <div className="flex items-center gap-4 text-gray-400">
            <span>{PLATFORM_LABELS[agent.agent_platform || ''] || agent.agent_platform}</span>
            {agent.owner_name && (
              <>
                <span className="text-gray-600">|</span>
                <span>by {agent.owner_name}</span>
              </>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-3 mb-8">
          {badges.map(badge => (
            <div key={badge.label} className="bg-gray-900 px-4 py-2 rounded-lg flex items-center gap-2">
              <span className="text-xl">{badge.icon}</span>
              <span className="text-sm">{badge.label}</span>
            </div>
          ))}
        </div>

        {/* Description */}
        {agent.agent_description && (
          <div className="bg-gray-900 p-6 rounded-xl mb-6">
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <p className="text-gray-300">{agent.agent_description}</p>
          </div>
        )}

        {/* Skills */}
        {agent.agent_skills?.length > 0 && (
          <div className="bg-gray-900 p-6 rounded-xl mb-6">
            <h2 className="text-lg font-semibold mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {agent.agent_skills.map((skill: string) => (
                <span key={skill} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        <div className="bg-gray-900 p-6 rounded-xl mb-6">
          <h2 className="text-lg font-semibold mb-3">Links</h2>
          <div className="space-y-3">
            {agent.identity_link && (
              <a
                href={agent.identity_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:underline"
              >
                <span>{IDENTITY_ICONS[agent.identity_type || ''] || '🔗'}</span>
                <span className="capitalize">{agent.identity_type}</span>
              </a>
            )}
            {agent.agent_url && (
              <a
                href={agent.agent_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:underline"
              >
                <span>🌐</span>
                <span>{agent.agent_url}</span>
              </a>
            )}
          </div>
        </div>

        {/* Verification details */}
        <div className="bg-gray-900 p-6 rounded-xl mb-6">
          <h2 className="text-lg font-semibold mb-3">Verification</h2>
          <div className="text-gray-400 text-sm space-y-1">
            <p>Verified: {new Date(agent.approved_at).toLocaleDateString()}</p>
            <p>Handle: <span className="font-mono text-gray-300">{agent.handle}</span></p>
          </div>
        </div>

        {/* Embed badge */}
        <div className="bg-gray-900 p-6 rounded-xl mb-8">
          <h2 className="text-lg font-semibold mb-3">Embed This Badge</h2>
          <p className="text-gray-400 text-sm mb-3">
            Add this to your README, website, or Moltbook profile:
          </p>
          <pre className="bg-black p-4 rounded-lg text-sm text-green-400 overflow-x-auto">
            {embedMarkdown}
          </pre>
        </div>

        {/* Back */}
        <div className="flex gap-4">
          <Link href="/registry" className="text-blue-400 hover:underline">
            ← Back to Registry
          </Link>
          <Link href="/" className="text-gray-400 hover:underline">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
