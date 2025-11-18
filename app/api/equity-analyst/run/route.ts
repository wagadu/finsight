import { NextRequest, NextResponse } from 'next/server'
import { getAIServiceUrl } from '@/lib/ai-service'

export const runtime = 'nodejs' // Use Node.js runtime for external API calls

type EquityAnalystRunRequest = {
  documentId: string
  modelKey: 'baseline' | 'ft' | 'distilled'
}

export async function POST(request: NextRequest) {
  try {
    const body: EquityAnalystRunRequest = await request.json()
    
    // Validate request body
    if (!body.documentId || !body.modelKey) {
      return NextResponse.json(
        { error: 'Invalid request body. documentId and modelKey are required.' },
        { status: 400 }
      )
    }

    if (!['baseline', 'ft', 'distilled'].includes(body.modelKey)) {
      return NextResponse.json(
        { error: 'modelKey must be "baseline", "ft", or "distilled"' },
        { status: 400 }
      )
    }

    const AI_SERVICE_URL = getAIServiceUrl()
    // Forward request to Python FastAPI service
    const response = await fetch(`${AI_SERVICE_URL}/equity-analyst/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let errorMessage = 'Failed to run equity analyst copilot'
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
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in /api/equity-analyst/run:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

