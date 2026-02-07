'use client'

import { useEffect, useState, useCallback } from 'react'

interface Application {
  id: string
  created_at: string
  updated_at: string
  status: string
  owner_email: string
  owner_name: string | null
  email_verified: boolean
  identity_link: string
  identity_type: string
  identity_verified: boolean
  agent_name: string
  agent_description: string | null
  agent_skills: string[]
  agent_url: string | null
  agent_platform: string | null
  handle: string | null
  test_task_sent_at: string | null
  test_task_completed: boolean
  test_task_result: string | null
  test_task_notes: string | null
  reviewer_notes: string | null
  approved_at: string | null
  approved_by: string | null
  rejection_reason: string | null
  badge_token: string | null
  requires_human_override: boolean
  auto_review_score: number | null
}

const STATUS_TABS = ['all', 'pending', 'reviewing', 'test_sent', 'verified', 'rejected']

const TEST_TASKS: Record<string, string> = {
  Research: 'Find 3 recent news articles about AI agent safety and summarize each in 2 sentences.',
  Writing: 'Write a 100-word product description for a fictional AI scheduling assistant.',
  Code: 'Write a Python function that takes a list of integers and returns the two numbers that add up to a target sum.',
  'Data Analysis': 'Given the numbers [12, 45, 67, 23, 89, 34, 56], calculate the mean, median, and identify any outliers.',
  default: 'Summarize the following article in 3 bullet points: [paste any public article URL]',
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [applications, setApplications] = useState<Application[]>([])
  const [selected, setSelected] = useState<Application | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [stats, setStats] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  // Check auth on mount
  useEffect(() => {
    fetch('/api/admin?action=stats')
      .then(res => {
        if (res.ok) {
          setAuthed(true)
          return res.json()
        }
        setLoading(false)
        return null
      })
      .then(data => {
        if (data) {
          setStats(data.stats || {})
          setTotal(data.total || 0)
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  const fetchApps = useCallback(async () => {
    const url = statusFilter === 'all'
      ? '/api/admin?action=list'
      : `/api/admin?action=list&status=${statusFilter}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setApplications(data.applications || [])
    }
  }, [statusFilter])

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/admin?action=stats')
    if (res.ok) {
      const data = await res.json()
      setStats(data.stats || {})
      setTotal(data.total || 0)
    }
  }, [])

  useEffect(() => {
    if (authed) {
      fetchApps()
    }
  }, [authed, statusFilter, fetchApps])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setAuthed(true)
      fetchStats()
    } else {
      const data = await res.json()
      setLoginError(data.error || 'Login failed')
    }
  }

  const doAction = async (action: string, extra: Record<string, string> = {}) => {
    if (!selected) return
    setActionLoading(true)
    setActionMessage('')

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, application_id: selected.id, ...extra }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionMessage(`${action} successful${data.handle ? ` (handle: ${data.handle})` : ''}`)
        setSelected(null)
        fetchApps()
        fetchStats()
      } else {
        setActionMessage(`Error: ${data.error}`)
      }
    } catch {
      setActionMessage('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = () => doAction('approve')

  const handleReject = () => {
    const reason = prompt('Rejection reason:')
    if (reason) doAction('reject', { reason })
  }

  const handleSendTest = () => {
    const primarySkill = selected?.agent_skills?.[0] || 'default'
    const prefilled = TEST_TASKS[primarySkill] || TEST_TASKS.default
    const task = prompt('Test task:', prefilled)
    if (task) doAction('send_test', { test_task: task })
  }

  // Login form
  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <form onSubmit={handleLogin} className="bg-gray-900 p-8 rounded-xl w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-black border border-gray-700 rounded px-4 py-3 mb-4 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
          {loginError && <p className="text-red-400 text-sm mb-4">{loginError}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Login
          </button>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">AgentKYC Admin</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-gray-900 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-white">{total}</div>
            <div className="text-gray-400 text-sm">Total</div>
          </div>
          {['pending', 'reviewing', 'test_sent', 'verified', 'rejected'].map(s => (
            <div key={s} className="bg-gray-900 p-4 rounded-lg text-center">
              <div className={`text-2xl font-bold ${s === 'verified' ? 'text-green-400' : s === 'rejected' ? 'text-red-400' : 'text-blue-400'}`}>
                {stats[s] || 0}
              </div>
              <div className="text-gray-400 text-sm capitalize">{s.replace('_', ' ')}</div>
            </div>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setStatusFilter(tab); setSelected(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                statusFilter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
              }`}
            >
              {tab === 'all' ? 'All' : tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {actionMessage && (
          <div className={`mb-4 px-4 py-3 rounded ${actionMessage.startsWith('Error') ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
            {actionMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Application list */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4">Applications ({applications.length})</h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {applications.length === 0 ? (
                <p className="text-gray-500 text-sm">No applications found.</p>
              ) : (
                applications.map(app => (
                  <button
                    key={app.id}
                    onClick={() => setSelected(app)}
                    className={`w-full text-left p-4 rounded-lg transition ${
                      selected?.id === app.id ? 'bg-blue-900/50 border border-blue-600' : 'bg-gray-900 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate">{app.agent_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        app.status === 'verified' ? 'bg-green-900 text-green-300'
                        : app.status === 'rejected' ? 'bg-red-900 text-red-300'
                        : 'bg-gray-800 text-gray-300'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                    <div className="text-gray-500 text-xs truncate">{app.owner_email}</div>
                    <div className="text-gray-600 text-xs">{new Date(app.created_at).toLocaleDateString()}</div>
                    {app.requires_human_override && (
                      <div className="text-yellow-400 text-xs mt-1">Needs human review</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="bg-gray-900 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">{selected.agent_name}</h2>
                  <span className={`text-sm px-3 py-1 rounded ${
                    selected.status === 'verified' ? 'bg-green-900 text-green-300'
                    : selected.status === 'rejected' ? 'bg-red-900 text-red-300'
                    : 'bg-gray-800 text-gray-300'
                  }`}>
                    {selected.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div>
                    <span className="text-gray-500">Owner:</span>
                    <span className="ml-2">{selected.owner_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2">{selected.owner_email}</span>
                    {selected.email_verified && <span className="text-green-400 ml-1">verified</span>}
                  </div>
                  <div>
                    <span className="text-gray-500">Platform:</span>
                    <span className="ml-2">{selected.agent_platform}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Identity:</span>
                    <a href={selected.identity_link} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:underline">
                      {selected.identity_type}
                    </a>
                    {selected.identity_verified && <span className="text-green-400 ml-1">verified</span>}
                  </div>
                  {selected.agent_url && (
                    <div>
                      <span className="text-gray-500">URL:</span>
                      <a href={selected.agent_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-400 hover:underline truncate">
                        {selected.agent_url}
                      </a>
                    </div>
                  )}
                  {selected.handle && (
                    <div>
                      <span className="text-gray-500">Handle:</span>
                      <span className="ml-2 font-mono">{selected.handle}</span>
                    </div>
                  )}
                  {selected.auto_review_score !== null && (
                    <div>
                      <span className="text-gray-500">Auto score:</span>
                      <span className="ml-2">{(selected.auto_review_score * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Applied:</span>
                    <span className="ml-2">{new Date(selected.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-gray-500 text-sm">Description:</span>
                  <p className="mt-1 text-gray-300 text-sm">{selected.agent_description}</p>
                </div>

                {selected.agent_skills?.length > 0 && (
                  <div className="mb-4">
                    <span className="text-gray-500 text-sm">Skills:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selected.agent_skills.map(s => (
                        <span key={s} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.rejection_reason && (
                  <div className="mb-4 p-3 bg-red-900/30 rounded">
                    <span className="text-red-300 text-sm">Rejected: {selected.rejection_reason}</span>
                  </div>
                )}

                {selected.test_task_notes && (
                  <div className="mb-4 p-3 bg-gray-800 rounded">
                    <span className="text-gray-400 text-sm">Test task: {selected.test_task_notes}</span>
                    {selected.test_task_sent_at && (
                      <span className="text-gray-500 text-xs block mt-1">
                        Sent: {new Date(selected.test_task_sent_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-6 pt-6 border-t border-gray-800">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading || !['reviewing', 'test_sent'].includes(selected.status)}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={handleSendTest}
                    disabled={actionLoading || selected.status !== 'reviewing'}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition"
                  >
                    Send Test
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading || selected.status === 'rejected' || selected.status === 'verified'}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 p-12 rounded-xl text-center text-gray-500">
                Select an application to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
