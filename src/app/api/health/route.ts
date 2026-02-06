import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const start = Date.now();
  
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      note: 'Database not configured',
      services: {
        database: 'not_configured',
        api: 'up',
      }
    });
  }

  try {
    // Check database - count verified agents
    const { count: agentCount, error: agentError } = await supabase
      .from('verification_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified');
    
    const dbOk = !agentError;
    const latency = Date.now() - start;
    
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
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      services: {
        database: 'down',
        api: 'up',
      }
    }, { status: 503 });
  }
}
