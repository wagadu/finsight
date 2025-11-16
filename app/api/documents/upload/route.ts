import { NextRequest, NextResponse } from 'next/server'
import { getAIServiceUrl } from '@/lib/ai-service'

// Vercel has a 4.5MB limit for serverless functions on Hobby plan
// We'll set a conservative 4MB limit to account for overhead
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB in bytes

// Increase body size limit for this route (though Vercel may still enforce its own limits)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
  maxDuration: 60, // 60 seconds max execution time
}

export async function POST(request: NextRequest) {
  const AI_SERVICE_URL = getAIServiceUrl()
  try {
    const requestFormData = await request.formData()
    const file = requestFormData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
          maxSize: MAX_FILE_SIZE,
          fileSize: file.size
        },
        { status: 413 }
      )
    }

    // Validate PDF file type
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Send the PDF file to Python service for parsing and storage
    const uploadFormData = new FormData()
    uploadFormData.append('file', file)
    uploadFormData.append('name', file.name || 'uploaded_document.pdf')

    const response = await fetch(`${AI_SERVICE_URL}/documents`, {
      method: 'POST',
      body: uploadFormData, // Don't set Content-Type header - browser will set it with boundary
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Python service error:', response.status, errorText)
      
      // Handle specific error cases
      if (response.status === 413) {
        return NextResponse.json(
          { error: 'File too large for the backend service' },
          { status: 413 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to register document in AI service' },
        { status: 500 }
      )
    }

    const pythonDocument = await response.json()
    
    // Normalize Python response to match frontend shape
    const document = {
      id: pythonDocument.id,
      name: pythonDocument.name,
      uploadedAt: pythonDocument.uploaded_at,
      pageCount: undefined, // Will be populated when PDF parsing is implemented
    }

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
