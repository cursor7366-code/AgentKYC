'use client';

import { useState } from 'react';

const SKILLS = [
  'Research',
  'Writing',
  'Code',
  'Data Analysis',
  'Customer Support',
  'Translation',
  'Image Generation',
  'Voice/Audio',
  'Automation',
  'Other'
];

const PLATFORMS = [
  { value: 'moltbook', label: 'Moltbook' },
  { value: 'standalone', label: 'Standalone / Self-hosted' },
  { value: 'openai', label: 'OpenAI GPT' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'other', label: 'Other' }
];

const IDENTITY_TYPES = [
  { value: 'github', label: 'GitHub Profile' },
  { value: 'twitter', label: 'Twitter/X Profile' },
  { value: 'linkedin', label: 'LinkedIn Profile' },
  { value: 'website', label: 'Personal/Company Website' },
  { value: 'moltbook', label: 'Moltbook Profile' }
];

export default function VerifyPage() {
  const [formData, setFormData] = useState({
    owner_email: '',
    owner_name: '',
    identity_type: '',
    identity_link: '',
    agent_name: '',
    agent_description: '',
    agent_skills: [] as string[],
    agent_url: '',
    agent_platform: '',
    agree_tos: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.agree_tos) {
      setError('You must agree to the Terms of Service');
      return;
    }

    setSubmitting(true);
    
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      agent_skills: prev.agent_skills.includes(skill)
        ? prev.agent_skills.filter(s => s !== skill)
        : [...prev.agent_skills, skill]
    }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-6xl mb-6">📧</div>
          <h1 className="text-3xl font-bold mb-4">Check Your Email</h1>
          <p className="text-gray-400 text-lg">
            We sent a verification link to <strong>{formData.owner_email}</strong>.
            <br />Click the link to continue your application.
          </p>
          <p className="text-gray-500 mt-8 text-sm">
            Didn't receive it? Check your spam folder or <a href="/verify" className="text-blue-400 hover:underline">try again</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Get Verified ✓</h1>
          <p className="text-gray-400 text-lg">
            Join the registry of trusted AI agents. Verification is free.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="bg-gray-900 p-4 rounded-lg text-center">
            <div className="text-2xl mb-2">🛡️</div>
            <div className="text-sm text-gray-400">Trusted Badge</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg text-center">
            <div className="text-2xl mb-2">📋</div>
            <div className="text-sm text-gray-400">Listed in Registry</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg text-center">
            <div className="text-2xl mb-2">🔍</div>
            <div className="text-sm text-gray-400">Discoverable</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Owner Section */}
          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Owner Information</h2>
            <p className="text-gray-500 text-sm mb-4">Who operates this agent?</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={formData.owner_name}
                  onChange={e => setFormData({...formData, owner_name: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="Jane Smith"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.owner_email}
                  onChange={e => setFormData({...formData, owner_email: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Identity Verification</label>
                <p className="text-gray-500 text-xs mb-2">Link a public profile so we can verify you're real</p>
                <div className="flex gap-2">
                  <select
                    required
                    value={formData.identity_type}
                    onChange={e => setFormData({...formData, identity_type: e.target.value})}
                    className="bg-black border border-gray-700 rounded px-4 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select type...</option>
                    {IDENTITY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    required
                    value={formData.identity_link}
                    onChange={e => setFormData({...formData, identity_link: e.target.value})}
                    className="flex-1 bg-black border border-gray-700 rounded px-4 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="https://github.com/yourusername"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Agent Section */}
          <div className="bg-gray-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Agent Information</h2>
            <p className="text-gray-500 text-sm mb-4">Tell us about your agent</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Agent Name</label>
                <input
                  type="text"
                  required
                  value={formData.agent_name}
                  onChange={e => setFormData({...formData, agent_name: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="ResearchBot 3000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  required
                  value={formData.agent_description}
                  onChange={e => setFormData({...formData, agent_description: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-2 focus:border-blue-500 focus:outline-none h-24"
                  placeholder="What does your agent do? What makes it special?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Platform</label>
                <select
                  required
                  value={formData.agent_platform}
                  onChange={e => setFormData({...formData, agent_platform: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select platform...</option>
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Agent URL (optional)</label>
                <input
                  type="url"
                  value={formData.agent_url}
                  onChange={e => setFormData({...formData, agent_url: e.target.value})}
                  className="w-full bg-black border border-gray-700 rounded px-4 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="https://moltbook.com/u/youragent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS.map(skill => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        formData.agent_skills.includes(skill)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="bg-gray-900 p-6 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.agree_tos}
                onChange={e => setFormData({...formData, agree_tos: e.target.checked})}
                className="mt-1"
              />
              <span className="text-sm text-gray-400">
                I agree to the <a href="/terms" className="text-blue-400 hover:underline">Terms of Service</a>. 
                I confirm that I operate this agent, the information provided is accurate, 
                and I understand that verified status can be revoked for violations.
              </span>
            </label>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition"
          >
            {submitting ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Verification is free and typically takes 24-48 hours.
          <br />Questions? Email <a href="mailto:hello@agentkyc.io" className="text-blue-400 hover:underline">hello@agentkyc.io</a>
        </p>
      </div>
    </div>
  );
}
