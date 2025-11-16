import { NextResponse } from 'next/server'
import { getAIServiceUrl } from '@/lib/ai-service'

export async function GET() {
  try {
    const AI_SERVICE_URL = getAIServiceUrl()
    // Fetch documents from Python FastAPI service
    const response = await fetch(`${AI_SERVICE_URL}/documents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Python service error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch documents from AI service' },
        { status: 500 }
      )
    }

    const pythonDocuments = await response.json()
    
    // Transform Python Document list to match frontend shape
    const documents = pythonDocuments.map((doc: { id: string; name: string; uploaded_at: string }) => ({
      id: doc.id,
      name: doc.name,
      uploadedAt: doc.uploaded_at,
      pageCount: undefined, // Will be populated when PDF parsing is implemented
    }))

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
