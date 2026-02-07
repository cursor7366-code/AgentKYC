'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface VerifiedAgent {
  id: string;
  agent_name: string;
  agent_description: string;
  agent_skills: string[];
  agent_url: string | null;
  agent_platform: string;
  identity_link: string;
  identity_type: string;
  approved_at: string;
  handle: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  moltbook: 'Moltbook',
  standalone: 'Standalone',
  openai: 'OpenAI GPT',
  anthropic: 'Anthropic Claude',
  other: 'Other'
};

const IDENTITY_ICONS: Record<string, string> = {
  github: '🐙',
  twitter: '🐦',
  linkedin: '💼',
  website: '🌐',
  moltbook: '📖'
};

export default function RegistryPage() {
  const [agents, setAgents] = useState<VerifiedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/registry')
      .then(res => res.json())
      .then(data => {
        setAgents(data.agents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredAgents = agents.filter(agent => 
    agent.agent_name.toLowerCase().includes(filter.toLowerCase()) ||
    agent.agent_description.toLowerCase().includes(filter.toLowerCase()) ||
    agent.agent_skills.some(s => s.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Verified Agent Registry</h1>
          <p className="text-gray-400 text-lg mb-8">
            Trusted AI agents, verified by AgentKYC
          </p>
          
          {/* Search */}
          <div className="max-w-md mx-auto">
            <input
              type="text"
              placeholder="Search agents by name, skill, or description..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="bg-gray-900 p-6 rounded-lg text-center">
            <div className="text-3xl font-bold text-blue-400">{agents.length}</div>
            <div className="text-gray-400 text-sm">Verified Agents</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg text-center">
            <div className="text-3xl font-bold text-green-400">✓</div>
            <div className="text-gray-400 text-sm">Identity Verified</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg text-center">
            <div className="text-3xl font-bold text-purple-400">🛡️</div>
            <div className="text-gray-400 text-sm">Tested & Trusted</div>
          </div>
        </div>

        {/* Agent List */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading...</div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-400 mb-4">
              {agents.length === 0 
                ? "No verified agents yet. Be the first!"
                : "No agents match your search."}
            </p>
            <Link
              href="/verify"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              Get Verified
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map(agent => {
              const cardContent = (
              <div className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition block">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      {agent.agent_name}
                      <span className="text-green-400 text-sm">✓</span>
                    </h3>
                    <span className="text-gray-500 text-sm">
                      {PLATFORM_LABELS[agent.agent_platform] || agent.agent_platform}
                    </span>
                  </div>
                  {agent.identity_link && (
                    <a
                      href={agent.identity_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xl hover:scale-110 transition"
                      title={`View on ${agent.identity_type}`}
                      onClick={e => e.stopPropagation()}
                    >
                      {IDENTITY_ICONS[agent.identity_type] || '🔗'}
                    </a>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                  {agent.agent_description}
                </p>

                {/* Skills */}
                {agent.agent_skills && agent.agent_skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {agent.agent_skills.slice(0, 4).map(skill => (
                      <span
                        key={skill}
                        className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded"
                      >
                        {skill}
                      </span>
                    ))}
                    {agent.agent_skills.length > 4 && (
                      <span className="text-gray-500 text-xs px-2 py-1">
                        +{agent.agent_skills.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <span className="text-gray-500 text-xs">
                    Verified {new Date(agent.approved_at).toLocaleDateString()}
                  </span>
                  {agent.agent_url && (
                    <a
                      href={agent.agent_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                      onClick={e => e.stopPropagation()}
                    >
                      Visit →
                    </a>
                  )}
                </div>
              </div>
              );
              return agent.handle ? (
                <Link key={agent.id} href={`/agent/${agent.handle}`} className="block">
                  {cardContent}
                </Link>
              ) : (
                <div key={agent.id}>{cardContent}</div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-16 py-12 border-t border-gray-800">
          <h2 className="text-2xl font-bold mb-4">Want to be listed?</h2>
          <p className="text-gray-400 mb-6">
            Get your agent verified and join the trusted registry.
          </p>
          <Link
            href="/verify"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition"
          >
            Apply for Verification
          </Link>
        </div>
      </div>
    </div>
  );
}
