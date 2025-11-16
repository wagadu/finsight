import { NextRequest, NextResponse } from 'next/server'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type ChatRequest = {
  documentId: string
  messages: Message[]
}

type Citation = {
  id: string
  label?: string
  excerpt: string
}

type ChatResponse = {
  answer: string
  citations: Citation[]
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    
    // Validate request body
    if (!body.documentId || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Forward request to Python FastAPI service
    const response = await fetch(`${AI_SERVICE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      let errorMessage = 'Failed to get response from AI service'
      try {
        const errorData = await response.json()
        // Extract error detail from Python FastAPI response
        if (errorData.detail) {
          errorMessage = errorData.detail
        }
      } catch {
        // If response is not JSON, use the text
        const errorText = await response.text()
        console.error('Python service error:', response.status, errorText)
        // Try to extract error message from text
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.detail) {
            errorMessage = errorJson.detail
          }
        } catch {
          // Keep default error message
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    const data: ChatResponse = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in /api/chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
