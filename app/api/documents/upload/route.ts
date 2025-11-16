import { NextRequest, NextResponse } from 'next/server'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001'

export async function POST(request: NextRequest) {
  try {
    const requestFormData = await request.formData()
    const file = requestFormData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
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
