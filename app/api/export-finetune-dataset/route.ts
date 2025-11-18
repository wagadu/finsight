import { NextRequest, NextResponse } from 'next/server'
import { getAIServiceUrl } from '@/lib/ai-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const modelName = searchParams.get('modelName') || undefined
    const isGoldOnly = searchParams.get('isGoldOnly') === 'true'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    const AI_SERVICE_URL = getAIServiceUrl()
    
    // Build query string
    const queryParams = new URLSearchParams()
    if (modelName) queryParams.append('model_name', modelName)
    if (isGoldOnly) queryParams.append('is_gold_only', 'true')
    if (limit) queryParams.append('limit', limit.toString())

    const queryString = queryParams.toString()
    const url = `${AI_SERVICE_URL}/export-finetune-dataset${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorMessage = 'Failed to export fine-tuning dataset'
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

    // Get the filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'finetune_dataset.jsonl'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }

    // Return the file content
    const blob = await response.blob()
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error in /api/export-finetune-dataset:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

