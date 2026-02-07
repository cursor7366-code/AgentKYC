import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const start = Date.now()

  try {
    const supabase = getSupabase()

    // Check database - count verified agents
    const { count: agentCount, error: agentError } = await supabase
      .from('verification_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified')

    const dbOk = !agentError
    const latency = Date.now() - start

    return NextResponse.json({
      status: dbOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latency_ms: latency,
      metrics: {
        verified_agents: agentCount || 0,
      },
      services: {
        database: dbOk ? 'up' : 'down',
        api: 'up',
      },
    })
  } catch {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
        services: {
          database: 'down',
          api: 'up',
        },
      },
      { status: 503 }
    )
  }
}
