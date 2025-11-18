"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Play, TrendingUp, AlertTriangle, DollarSign, Target, BarChart3, ChevronDown, ChevronRight, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ModelType, SectionType, EquityAnalystSection } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface EquityAnalystCopilotProps {
  documentName: string
  documentId: string
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

export function EquityAnalystCopilot({ documentName, documentId }: EquityAnalystCopilotProps) {
  const [selectedModel, setSelectedModel] = useState<ModelType>("baseline")
  const [isRunning, setIsRunning] = useState(false)
  const [sections, setSections] = useState<EquityAnalystSection[]>([])
  const { toast } = useToast()

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
          <div>
            <h2 className="text-base md:text-lg font-semibold text-foreground truncate">
              Equity Analyst Copilot
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              {documentName}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              disabled={isRunning}
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
        {sections.length === 0 && !isRunning ? (
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

