import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getAIServiceUrl } from '@/lib/ai-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getSupabaseServerClient()
    const body = await request.json().catch(() => ({}))
    
    const reviewerNote = body.reviewerNote || body.note || null
    const autoIngest = body.autoIngest !== false // Default to true

    // Update candidate status
    const { data: candidate, error: updateError } = await supabase
      .from('filing_candidates')
      .update({
        status: 'auto_approved',
        status_changed_at: new Date().toISOString(),
        reviewer_note: reviewerNote,
        auto_approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error approving candidate:', updateError)
      return NextResponse.json(
        { error: 'Failed to approve candidate' },
        { status: 500 }
      )
    }

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    // If autoIngest is true, trigger ingestion
    if (autoIngest) {
      try {
        // Call backend ingestion endpoint
        const aiServiceUrl = getAIServiceUrl()
        const ingestResponse = await fetch(`${aiServiceUrl}/filings/${id}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (!ingestResponse.ok) {
          const errorText = await ingestResponse.text()
          console.error('Ingestion failed:', ingestResponse.status, errorText)
          // Still approve the candidate, but log the error
          return NextResponse.json({
            success: true,
            candidate: {
              ...candidate,
              status: 'auto_approved'
            },
            warning: 'Ingestion may have failed. Check backend logs or filing_ingestions table.'
          })
        }
        
        const ingestData = await ingestResponse.json()
        console.log('Ingestion started successfully:', ingestData)
      } catch (error) {
        console.error('Error triggering ingestion:', error)
        // Still approve the candidate, but return a warning
        return NextResponse.json({
          success: true,
          candidate: {
            ...candidate,
            status: 'auto_approved'
          },
          warning: `Ingestion trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure backend is running at ${getAIServiceUrl()}`
        })
      }
    }

    return NextResponse.json({
      success: true,
      candidate: {
        ...candidate,
        status: 'auto_approved'
      }
    })
  } catch (error) {
    console.error('Error in /api/filings/[id]/approve:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

