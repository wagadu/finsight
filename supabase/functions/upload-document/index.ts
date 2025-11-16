// Supabase Edge Function for document upload and processing
// This function handles PDF uploads, parsing, chunking, and embedding generation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// CORS headers for Supabase Edge Functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DocumentUploadRequest {
  fileName: string
  filePath: string // Path in Supabase Storage
  fileSize: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // Note: OPENAI_API_KEY is not used here - Python backend handles OpenAI API calls

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { fileName, filePath, fileSize }: DocumentUploadRequest = await req.json()

    if (!fileName || !filePath) {
      return new Response(
        JSON.stringify({ error: 'Missing fileName or filePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate file type
    if (!fileName.endsWith('.pdf')) {
      return new Response(
        JSON.stringify({ error: 'Only PDF files are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate file size (50MB limit for Supabase Storage)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Download file from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath)

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError)
      return new Response(
        JSON.stringify({ error: 'Failed to download file from storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get file as blob for processing
    const fileBlob = fileData

    // Call Python backend to process the file
    // The Python backend will download from Storage, parse PDF, chunk, and embed
    let pythonBackendUrl = Deno.env.get('PYTHON_BACKEND_URL') || 'http://localhost:8001'
    
    // Ensure URL has protocol (https:// or http://)
    if (pythonBackendUrl && !pythonBackendUrl.startsWith('http://') && !pythonBackendUrl.startsWith('https://')) {
      pythonBackendUrl = `https://${pythonBackendUrl}`
    }
    
    // Create FormData to send file to Python backend
    const formData = new FormData()
    formData.append('file', fileBlob, fileName)
    formData.append('name', fileName)
    formData.append('storage_path', filePath) // Pass storage path for reference

    try {
      const pythonResponse = await fetch(`${pythonBackendUrl}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (!pythonResponse.ok) {
        const errorText = await pythonResponse.text()
        console.error('Python backend error:', pythonResponse.status, errorText)
        
        // Clean up: delete file from storage if processing failed
        await supabase.storage.from('documents').remove([filePath])
        
        return new Response(
          JSON.stringify({ 
            error: `Python backend error (${pythonResponse.status}): ${errorText || 'Failed to process document'}`,
            detail: errorText
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const document = await pythonResponse.json()

      // Return document metadata
      return new Response(
        JSON.stringify({
          id: document.id,
          name: document.name,
          uploaded_at: document.uploaded_at,
          text_content: document.text_content,
        }),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } catch (error) {
      console.error('Error calling Python backend:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Clean up: delete file from storage if processing failed
      try {
        await supabase.storage.from('documents').remove([filePath])
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError)
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Failed to call Python backend: ${errorMessage}`,
          detail: `Python backend URL: ${pythonBackendUrl}. Make sure the backend is running and accessible.`
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in upload-document function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

