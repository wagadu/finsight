"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, TrendingUp, AlertTriangle, DollarSign, Target, BarChart3, ChevronDown, ChevronRight, FileText, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ModelType, SectionType, EquityAnalystSection, EquityAnalystRunResponse } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface EquityAnalystCopilotProps {
  documentName: string
  documentId: string
  selectedRunId?: string | null
  onRunLoaded?: (runId: string) => void
  onNewRunComplete?: () => void
}

const SECTION_ICONS: Record<SectionType, React.ReactNode> = {
  revenue_drivers: <TrendingUp className="h-4 w-4" />,
  key_risks: <AlertTriangle className="h-4 w-4" />,
  unit_economics: <DollarSign className="h-4 w-4" />,
  investment_thesis: <Target className="h-4 w-4" />,
  financial_trends: <BarChart3 className="h-4 w-4" />,
}

const SECTION_TITLES: Record<SectionType, string> = {
  revenue_drivers: "Revenue Drivers",
  key_risks: "Key Risks",
  unit_economics: "Unit Economics & Margins",
  investment_thesis: "Investment Thesis",
  financial_trends: "Financial Trends",
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

export function EquityAnalystCopilot({ 
  documentName, 
  documentId, 
  selectedRunId,
  onRunLoaded,
  onNewRunComplete 
}: EquityAnalystCopilotProps) {
  const [selectedModel, setSelectedModel] = useState<ModelType>("baseline")
  const [isRunning, setIsRunning] = useState(false)
  const [sections, setSections] = useState<EquityAnalystSection[]>([])
  const [currentRunId, setCurrentRunId] = useState<string | null>(selectedRunId || null)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [loadedReportInfo, setLoadedReportInfo] = useState<{ model: ModelType; timestamp: string } | null>(null)
  const { toast } = useToast()

  // Auto-load latest report when document changes or selectedRunId changes
  useEffect(() => {
    console.log('EquityAnalystCopilot useEffect triggered:', { documentId, selectedRunId })
    
    if (!documentId) {
      setSections([])
      setCurrentRunId(null)
      setLoadedReportInfo(null)
      setIsLoadingReport(false)
      return
    }

    const loadReport = async (runId: string | null = null) => {
      setIsLoadingReport(true)
      try {
        // If a specific runId is provided, load it directly
        if (runId) {
          console.log('Loading specific report:', runId)
          const reportResponse = await fetch(`/api/equity-analyst/runs/${runId}`)
          
          if (!reportResponse.ok) {
            const errorText = await reportResponse.text()
            console.error('Failed to load report:', reportResponse.status, errorText)
            toast({
              title: "Failed to load report",
              description: `Error: ${reportResponse.status}`,
              variant: "destructive",
            })
            setIsLoadingReport(false)
            return
          }
          
          const reportData: EquityAnalystRunResponse = await reportResponse.json()
          console.log('Report loaded:', reportData)
          
          if (reportData.sections && reportData.sections.length > 0) {
            setSections(reportData.sections)
            setCurrentRunId(runId)
            
            // Fetch run info for display
            const runsResponse = await fetch(`/api/equity-analyst/runs?documentId=${documentId}`)
            if (runsResponse.ok) {
              const runsData = await runsResponse.json()
              const runs = runsData.runs || []
              const runInfo = runs.find((r: any) => r.id === runId)
              if (runInfo) {
                setLoadedReportInfo({
                  model: runInfo.run_type as ModelType,
                  timestamp: runInfo.created_at
                })
              }
            }
            
            if (onRunLoaded) {
              onRunLoaded(runId)
            }
          } else {
            console.warn('Report has no sections:', reportData)
            setSections([])
            toast({
              title: "Report is empty",
              description: "This report has no analysis sections.",
              variant: "destructive",
            })
          }
          setIsLoadingReport(false)
          return
        }
        
        // Otherwise, fetch all runs first to check if any exist
        const runsResponse = await fetch(`/api/equity-analyst/runs?documentId=${documentId}`)
        
        if (!runsResponse.ok) {
          throw new Error('Failed to fetch reports')
        }
        
        const runsData = await runsResponse.json()
        const runs = runsData.runs || []
        
        // If no runs exist, stop loading and show empty state
        if (runs.length === 0) {
          console.log('No reports found for document')
          setSections([])
          setCurrentRunId(null)
          setLoadedReportInfo(null)
          setIsLoadingReport(false)
          return
        }
        
        // Find the latest completed run
        const latestCompleted = runs.find((r: any) => r.status === 'completed')
        
        if (latestCompleted) {
          const reportResponse = await fetch(`/api/equity-analyst/runs/${latestCompleted.id}`)
          if (reportResponse.ok) {
            const reportData: EquityAnalystRunResponse = await reportResponse.json()
            setSections(reportData.sections || [])
            setCurrentRunId(latestCompleted.id)
            setLoadedReportInfo({
              model: latestCompleted.run_type as ModelType,
              timestamp: latestCompleted.created_at
            })
            
            if (onRunLoaded) {
              onRunLoaded(latestCompleted.id)
            }
          }
        } else {
          // No completed reports available
          setSections([])
          setCurrentRunId(null)
          setLoadedReportInfo(null)
        }
        setIsLoadingReport(false)
      } catch (error) {
        console.error('Error loading report:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        toast({
          title: "Failed to load report",
          description: errorMessage,
          variant: "destructive",
        })
        setSections([])
        setCurrentRunId(null)
        setLoadedReportInfo(null)
        setIsLoadingReport(false)
      }
    }

    loadReport(selectedRunId || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, selectedRunId])

  const handleRunAnalysis = async () => {
    setIsRunning(true)
    setSections([])

    try {
      const response = await fetch("/api/equity-analyst/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          modelKey: selectedModel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to run analysis")
      }

      const data = await response.json()
      setSections(data.sections || [])
      setCurrentRunId(data.runId)
      
      // Update loaded report info
      setLoadedReportInfo({
        model: selectedModel,
        timestamp: new Date().toISOString()
      })
      
      if (onRunLoaded) {
        onRunLoaded(data.runId)
      }
      
      if (onNewRunComplete) {
        onNewRunComplete()
      }

      toast({
        title: "Analysis completed",
        description: `Generated ${data.sections?.length || 0} analysis sections`,
      })
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to run analysis",
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
    }
  }

  const formatSectionType = (type: string): SectionType => {
    return type as SectionType
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-muted/30 px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-semibold text-foreground truncate">
              Equity Analyst Copilot
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                {documentName}
              </p>
              {loadedReportInfo && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <Badge variant="outline" className="text-xs">
                    {loadedReportInfo.model === 'baseline' ? 'Baseline' : 
                     loadedReportInfo.model === 'ft' ? 'Fine-tuned' : 'Distilled'}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(loadedReportInfo.timestamp)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value as ModelType)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baseline">Baseline</SelectItem>
                <SelectItem value="ft">Fine-tuned</SelectItem>
                <SelectItem value="distilled">Distilled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleRunAnalysis}
              disabled={isRunning || isLoadingReport}
              className="flex-shrink-0"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run full analysis
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoadingReport ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Loading report...</p>
          </div>
        ) : sections.length === 0 && !isRunning ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ready to analyze</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Click "Run full analysis" to generate a comprehensive equity analysis with revenue drivers, risks, unit economics, investment thesis, and financial trends.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {sections.map((section) => {
              const sectionType = formatSectionType(section.section_type)
              const icon = SECTION_ICONS[sectionType]
              const title = SECTION_TITLES[sectionType]

              return (
                <Card key={section.id} className="w-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {icon}
                      {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Answer with Markdown formatting */}
                    <div className="rounded-lg px-4 py-3 bg-muted text-foreground border border-border">
                      <div className="text-sm leading-relaxed markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc mb-2 space-y-1 ml-4 pl-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal mb-2 space-y-1 ml-4 pl-2">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            code: ({ className, children, ...props }) => {
                              const isInline = !className
                              return isInline ? (
                                <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              )
                            },
                            pre: ({ children }) => (
                              <pre className="bg-muted p-3 rounded-md overflow-x-auto mb-2 border border-border">
                                {children}
                              </pre>
                            ),
                            h1: ({ children }) => <h1 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-border pl-4 italic my-2 text-muted-foreground">
                                {children}
                              </blockquote>
                            ),
                            a: ({ children, href }) => (
                              <a href={href} className="text-primary underline underline-offset-4 hover:text-primary/80" target="_blank" rel="noopener noreferrer">
                                {children}
                              </a>
                            ),
                            hr: () => <hr className="my-3 border-border" />,
                          }}
                        >
                          {section.model_answer}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Collapsible Evidence Section */}
                    {section.citations && section.citations.length > 0 && (
                      <SectionEvidence citations={section.citations} />
                    )}

                    {section.response_time_ms && (
                      <div className="text-xs text-muted-foreground">
                        Response time: {section.response_time_ms}ms
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {isRunning && sections.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Running analysis...</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Collapsible Evidence Component (matching chat-thread style)
function SectionEvidence({ citations }: { citations: EquityAnalystSection['citations'] }) {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false)

  if (!citations || citations.length === 0) {
    return null
  }

  return (
    <Card className="w-full border-border/50">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEvidenceExpanded(!isEvidenceExpanded)}
        className="w-full justify-start gap-2 px-3 py-2 h-auto font-normal"
      >
        {isEvidenceExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Evidence ({citations.length})
        </span>
      </Button>

      {isEvidenceExpanded && (
        <div className="border-t border-border/50 p-3 space-y-2">
          {citations.map((citation, index) => (
            <div
              key={citation.id || index}
              className="rounded-md bg-muted/50 p-3 space-y-1"
            >
              <div className="text-xs font-medium text-foreground">
                {citation.label || `Citation ${index + 1}`}
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {citation.excerpt}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

