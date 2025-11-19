import { NextRequest, NextResponse } from 'next/server'
import { getAIServiceUrl } from '@/lib/ai-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      )
    }

    const AI_SERVICE_URL = getAIServiceUrl()
    const response = await fetch(`${AI_SERVICE_URL}/equity-analyst/runs?document_id=${encodeURIComponent(documentId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorMessage = 'Failed to fetch equity analyst runs'
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
    
    // Add HTTP caching headers for runs list
    // Shorter cache since new runs might be added, but still cache for performance
    const response_obj = NextResponse.json(data)
    
    // Cache for 5 minutes, with stale-while-revalidate for 10 minutes
    // This allows serving stale data while fetching fresh data in background
    response_obj.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600, max-age=300'
    )
    
    return response_obj
  } catch (error) {
    console.error('Error in /api/equity-analyst/runs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

