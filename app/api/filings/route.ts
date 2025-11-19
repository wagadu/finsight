import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const ticker = searchParams.get('ticker')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('filing_candidates')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (source) {
      query = query.eq('source', source)
    }
    if (ticker) {
      query = query.ilike('ticker', `%${ticker}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching filing candidates:', error)
      // Return more detailed error for debugging
      return NextResponse.json(
        { 
          error: 'Failed to fetch filing candidates',
          details: error.message,
          hint: error.message?.includes('relation') 
            ? 'Make sure you have run the filing_agent_schema.sql migration'
            : undefined
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      candidates: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error: any) {
    console.error('Error in /api/filings:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'Unknown error',
        hint: error?.message?.includes('Supabase credentials')
          ? 'Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local file'
          : undefined
      },
      { status: 500 }
    )
  }
}

