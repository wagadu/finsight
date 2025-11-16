"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Play } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"

interface EvalSummary {
  totalQuestions: number
  successRate: number
  lastRunAt?: string
}

interface EvalSummaryProps {
  documentId?: string | null
}

export function EvalSummary({ documentId }: EvalSummaryProps) {
  const [summary, setSummary] = useState<EvalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchSummary = async () => {
    try {
      const response = await fetch("/api/eval/summary")
      if (!response.ok) {
        throw new Error("Failed to fetch eval summary")
      }
      const data = await response.json()
      setSummary(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const handleRunEvaluation = async () => {
    if (!documentId) {
      toast({
        title: "No document selected",
        description: "Please select a document first to run an evaluation.",
        variant: "destructive",
      })
      return
    }

    setRunning(true)
    try {
      const response = await fetch("/api/eval/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          runName: `Evaluation - ${new Date().toLocaleString()}`,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to run evaluation")
      }

      const data = await response.json()
      
      toast({
        title: "Evaluation completed",
        description: `Success rate: ${Math.round(data.successRate * 100)}% (${data.successfulAnswers}/${data.totalQuestions} questions)`,
      })

      // Refresh summary after evaluation completes
      await fetchSummary()
    } catch (err) {
      toast({
        title: "Evaluation failed",
        description: err instanceof Error ? err.message : "Failed to run evaluation",
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-3">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading eval metrics...</span>
        </div>
      </Card>
    )
  }

  if (error || !summary) {
    return (
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">
          Unable to load evaluation metrics
        </p>
      </Card>
    )
  }

  let relativeTime: string = "Never"
  if (summary.lastRunAt) {
    const lastRun = new Date(summary.lastRunAt)
    const now = new Date()
    const diffMs = now.getTime() - lastRun.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) {
      relativeTime = `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
    } else if (diffHours > 0) {
      relativeTime = `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
    } else {
      relativeTime = "Less than an hour ago"
    }
  }

  return (
    <Card className="border-accent/50 bg-accent/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h4 className="text-xs font-semibold text-foreground">Evaluation</h4>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRunEvaluation}
          disabled={running || !documentId}
          className="h-6 px-2 text-xs"
        >
          {running ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-1 h-3 w-3" />
              Run
            </>
          )}
        </Button>
      </div>
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Eval questions:</span>
          <span className="font-medium text-foreground">
            {summary.totalQuestions}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Success rate:</span>
          <span className="font-medium text-foreground">
            {Math.round(summary.successRate * 100)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Last run:</span>
          <span className="font-medium text-foreground">{relativeTime}</span>
        </div>
      </div>
    </Card>
  )
}
