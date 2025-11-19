"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, XCircle, Loader2, TrendingUp } from "lucide-react"
import { EquityAnalystRunSummary, ModelType } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ReportHistoryProps {
  documentId: string | null
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
  refreshTrigger?: number
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

function getModelBadgeVariant(runType: ModelType): "default" | "secondary" | "outline" {
  switch (runType) {
    case "baseline":
      return "default"
    case "ft":
      return "secondary"
    case "distilled":
      return "outline"
    default:
      return "default"
  }
}

function getModelLabel(runType: ModelType): string {
  switch (runType) {
    case "baseline":
      return "Baseline"
    case "ft":
      return "Fine-tuned"
    case "distilled":
      return "Distilled"
    default:
      return runType
  }
}

export function ReportHistory({ 
  documentId, 
  selectedRunId, 
  onSelectRun,
  refreshTrigger = 0 
}: ReportHistoryProps) {
  const [runs, setRuns] = useState<EquityAnalystRunSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      console.log('ReportHistory: No documentId provided')
      setRuns([])
      return
    }

    console.log('ReportHistory: Fetching runs for documentId:', documentId)

    const fetchRuns = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const url = `/api/equity-analyst/runs?documentId=${documentId}`
        console.log('ReportHistory: Fetching from:', url)
        const response = await fetch(url)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch reports' }))
          throw new Error(errorData.error || 'Failed to fetch reports')
        }
        
        const data = await response.json()
        console.log('Fetched runs data:', data)
        console.log('Response status:', response.status)
        console.log('Data keys:', Object.keys(data))
        
        // Check if response has error field
        if (data.error) {
          console.error('API returned error:', data.error)
          setError(data.error)
          setRuns([])
        } else if (data.runs) {
          console.log('Setting runs:', data.runs.length, 'reports')
          setRuns(data.runs)
          if (data.runs.length === 0) {
            console.log('No runs in response array')
          }
        } else {
          console.warn('Unexpected response format:', data)
          setRuns([])
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load reports'
        setError(errorMessage)
        setRuns([])
        console.error('Error fetching reports:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRuns()
  }, [documentId, refreshTrigger])

  if (!documentId) {
    return null
  }

  console.log('ReportHistory render:', { documentId, runsCount: runs.length, isLoading, error })

  return (
    <Card className="w-full flex flex-col">
      <CardHeader className="flex-shrink-0 border-b pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Analysis Reports {runs.length > 0 && `(${runs.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-3 text-sm text-destructive text-center">
              {error}
            </div>
          ) : runs.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No reports yet. Run an analysis to generate reports.
            </div>
          ) : (
            <div className="space-y-1 p-3 w-full">
              {runs.map((run, index) => {
                console.log(`Rendering run ${index}:`, run.id, run.status, run.section_count, run)
                if (!run || !run.id) {
                  console.error('Invalid run data:', run)
                  return null
                }
                return (
                <button
                  key={run.id}
                  onClick={() => {
                    console.log('Report clicked:', run.id, run.status)
                    onSelectRun(run.id)
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent",
                    selectedRunId === run.id && "bg-accent"
                  )}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {run.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : run.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={getModelBadgeVariant(run.run_type)}
                        className="text-xs"
                      >
                        {getModelLabel(run.run_type)}
                      </Badge>
                      {run.status === "completed" && run.section_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {run.section_count} sections
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeAgo(run.created_at)}</span>
                      {run.avg_response_time_ms && (
                        <>
                          <span>•</span>
                          <span>{(run.avg_response_time_ms / 1000).toFixed(1)}s avg</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

