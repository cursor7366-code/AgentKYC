import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

function makeBadgeSVG(label: string, message: string, color: string): string {
  const labelWidth = label.length * 7 + 10
  const messageWidth = message.length * 7 + 10
  const totalWidth = labelWidth + messageWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img">
    <linearGradient id="s" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
    <g clip-path="url(#r)">
      <rect width="${labelWidth}" height="20" fill="#555"/>
      <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
      <rect width="${totalWidth}" height="20" fill="url(#s)"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
      <text x="${labelWidth / 2}" y="14">${label}</text>
      <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
    </g>
  </svg>`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params

  try {
    const supabase = getSupabase()

    const { data } = await supabase
      .from('verification_applications')
      .select('status')
      .eq('handle', handle)
      .eq('status', 'verified')
      .single()

    const svg = data
      ? makeBadgeSVG('AgentKYC', 'verified', '#4c1')
      : makeBadgeSVG('AgentKYC', 'unverified', '#999')

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch {
    const svg = makeBadgeSVG('AgentKYC', 'error', '#e05d44')
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60',
      },
    })
  }
}
