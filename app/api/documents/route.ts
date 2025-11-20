import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseServerClient()
    
    // Fetch documents directly from Supabase
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, uploaded_at, created_at')
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching documents from Supabase:', error)
      return NextResponse.json(
        { 
          error: 'Failed to fetch documents',
          details: error.message 
        },
        { status: 500 }
      )
    }

    // Transform to match frontend shape
    const documents = (data || []).map((doc) => ({
      id: doc.id,
      name: doc.name,
      uploadedAt: doc.uploaded_at || doc.created_at,
      pageCount: undefined, // Will be populated when PDF parsing is implemented
    }))

    return NextResponse.json({ documents })
  } catch (error: any) {
    console.error('Error in /api/documents:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}
