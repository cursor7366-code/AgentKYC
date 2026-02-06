import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const start = Date.now();
  
  try {
    // Check database
    const { count: agentCount, error: agentError } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });
    
    const { count: taskCount, error: taskError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true });
    
    const dbOk = !agentError && !taskError;
    const latency = Date.now() - start;
    
    return NextResponse.json({
      status: dbOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latency_ms: latency,
      metrics: {
        agents: agentCount || 0,
        tasks: taskCount || 0,
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
