import { NextRequest, NextResponse } from 'next/server'
import { getAIServiceUrl } from '@/lib/ai-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params

    if (!runId) {
      return NextResponse.json(
        { error: 'runId is required' },
        { status: 400 }
      )
    }

    const AI_SERVICE_URL = getAIServiceUrl()
    const response = await fetch(`${AI_SERVICE_URL}/equity-analyst/runs/${runId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorMessage = 'Failed to fetch equity analyst run'
      try {
        const errorData = await response.json()
        if (errorData.detail) {
          errorMessage = errorData.detail
        }
      } catch {
        const errorText = await response.text()
        console.error('Python service error:', response.status, errorText)
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      )
    }

    const data = await response.json()
    
    // Add HTTP caching headers for completed reports
    // Completed reports are static and can be cached longer
    const cacheMaxAge = data.status === 'completed' ? 3600 : 60 // 1 hour for completed, 1 min for running
    const response_obj = NextResponse.json(data)
    
    // Cache-Control: public (can be cached by CDN), s-maxage (CDN cache), stale-while-revalidate (serve stale while revalidating)
    response_obj.headers.set(
      'Cache-Control',
      `public, s-maxage=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}, max-age=${cacheMaxAge}`
    )
    
    return response_obj
  } catch (error) {
    console.error('Error in /api/equity-analyst/runs/[runId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

