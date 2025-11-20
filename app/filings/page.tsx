"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw, Filter } from "lucide-react"
import { toast } from "sonner"
import { TopNav } from "@/components/top-nav"
import { FilingSearchChat } from "@/components/filing-search-chat"

interface FilingCandidate {
  id: string
  ticker: string
  cik: string | null
  company_name: string
  source: string
  source_url: string
  filing_type: string
  filing_year: number
  filing_date: string | null
  accession_number: string | null
  status: 'pending' | 'auto_approved' | 'rejected' | 'ingested' | 'failed'
  status_changed_at: string
  reviewer_note: string | null
  rejection_reason: string | null
  created_at: string
  metadata: any
}

export default function FilingsPage() {
  const [candidates, setCandidates] = useState<FilingCandidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: 'all',
    source: 'all',
    ticker: ''
  })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const fetchCandidates = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters.source && filters.source !== 'all' && { source: filters.source }),
        ...(filters.ticker && { ticker: filters.ticker })
      })

      const response = await fetch(`/api/filings?${params}`)
      if (!response.ok) throw new Error('Failed to fetch candidates')

      const data = await response.json()
      setCandidates(data.candidates || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Error fetching candidates:', error)
      toast.error('Failed to load filing candidates')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCandidates()
  }, [page, filters.status, filters.source, filters.ticker])

  const handleApprove = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id))
    try {
      const response = await fetch(`/api/filings/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoIngest: true })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to approve candidate')
      }

      const result = await response.json()
      
      if (result.warning) {
        toast.warning(result.warning)
      } else {
        toast.success('Filing approved and ingestion started')
      }
      
      fetchCandidates()
    } catch (error) {
      console.error('Error approving candidate:', error)
      toast.error('Failed to approve filing')
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleReject = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id))
    try {
      const response = await fetch(`/api/filings/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by reviewer' })
      })

      if (!response.ok) throw new Error('Failed to reject candidate')

      toast.success('Filing rejected')
      fetchCandidates()
    } catch (error) {
      console.error('Error rejecting candidate:', error)
      toast.error('Failed to reject filing')
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: 'secondary',
      auto_approved: 'default',
      ingested: 'default',
      rejected: 'destructive',
      failed: 'destructive'
    }

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Filing Candidates</h1>
          <p className="text-muted-foreground">
            Review and approve discovered annual reports for ingestion
          </p>
        </div>

        <FilingSearchChat onCandidateAdded={fetchCandidates} />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter filing candidates by status, source, or ticker</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="auto_approved">Auto Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="ingested">Ingested</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Source</label>
                <Select
                  value={filters.source}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, source: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    <SelectItem value="sec">SEC EDGAR</SelectItem>
                    <SelectItem value="annualreports">AnnualReports.com</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Ticker</label>
                <Input
                  placeholder="Search by ticker..."
                  value={filters.ticker}
                  onChange={(e) => setFilters(prev => ({ ...prev, ticker: e.target.value }))}
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({ status: 'all', source: 'all', ticker: '' })
                    setPage(1)
                  }}
                  className="w-full"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Filing Candidates</CardTitle>
              <CardDescription>
                {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCandidates}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No filing candidates found. Run the filing scout agent to discover new filings.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Filing Type</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((candidate) => (
                        <TableRow key={candidate.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{candidate.ticker}</div>
                              <div className="text-sm text-muted-foreground">
                                {candidate.company_name}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{candidate.filing_type}</TableCell>
                          <TableCell>{candidate.filing_year}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {candidate.source === 'sec' ? 'SEC' : 'AnnualReports'}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(candidate.status)}</TableCell>
                          <TableCell>{formatDate(candidate.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {candidate.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleApprove(candidate.id)}
                                    disabled={processingIds.has(candidate.id)}
                                  >
                                    {processingIds.has(candidate.id) ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                    )}
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleReject(candidate.id)}
                                    disabled={processingIds.has(candidate.id)}
                                  >
                                    {processingIds.has(candidate.id) ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <XCircle className="h-4 w-4 mr-1" />
                                    )}
                                    Reject
                                  </Button>
                                </>
                              )}
                              {candidate.source_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                >
                                  <a
                                    href={candidate.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

