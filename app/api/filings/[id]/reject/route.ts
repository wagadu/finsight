import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

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
    
    const rejectionReason = body.rejectionReason || body.reason || 'Rejected by reviewer'

    // Update candidate status
    const { data: candidate, error: updateError } = await supabase
      .from('filing_candidates')
      .update({
        status: 'rejected',
        status_changed_at: new Date().toISOString(),
        rejection_reason: rejectionReason
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error rejecting candidate:', updateError)
      return NextResponse.json(
        { error: 'Failed to reject candidate' },
        { status: 500 }
      )
    }

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      candidate: {
        ...candidate,
        status: 'rejected'
      }
    })
  } catch (error) {
    console.error('Error in /api/filings/[id]/reject:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

