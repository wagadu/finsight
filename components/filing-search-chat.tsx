"use client"

import { ChatInput } from "@/components/chat-input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useState } from "react"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  isLoading?: boolean
  filingCandidate?: {
    id: string
    ticker: string
    company_name: string
    filing_type: string
    filing_year: number
    status: string
  }
}

interface FilingSearchChatProps {
  onCandidateAdded?: () => void
}

export function FilingSearchChat({ onCandidateAdded }: FilingSearchChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "I can help you search for 10-K annual or quarterly reports for US-listed public companies. Try asking something like:\n\n• \"Find Apple's 2023 10-K annual report\"\n• \"Search for Microsoft's quarterly report from 2024\"\n• \"Get Tesla's latest annual report\"",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async (content: string) => {
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }

    setMessages((prev) => [...prev, userMessage])

    // Add temporary "Thinking..." message
    const thinkingId = (Date.now() + 1).toString()
    const thinkingMessage: Message = {
      id: thinkingId,
      role: "assistant",
      content: "Searching for the filing...",
      isLoading: true,
    }

    setMessages((prev) => [...prev, thinkingMessage])
    setIsLoading(true)

    try {
      const response = await fetch("/api/filings/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: content,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to search for filing")
      }

      const data = await response.json()

      // Replace thinking message with real response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === thinkingId
            ? {
                id: thinkingId,
                role: "assistant",
                content: data.message || "Filing found and added to candidates.",
                filingCandidate: data.candidate,
              }
            : msg
        )
      )

      if (data.candidate) {
        toast.success(
          `Found ${data.candidate.ticker} ${data.candidate.filing_type} ${data.candidate.filing_year}`
        )
        // Trigger refresh of the candidates list
        if (onCandidateAdded) {
          onCandidateAdded()
        }
      }
    } catch (error: any) {
      // Remove thinking message and show error
      setMessages((prev) => prev.filter((msg) => msg.id !== thinkingId))

      toast({
        title: "Error",
        description: error.message || "Failed to search for filing. Please try again.",
        variant: "destructive",
      })

      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message || "Failed to search for filing"}. Please try rephrasing your request.`,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Search for Filings</CardTitle>
        <CardDescription>
          Ask in plain language to find and add 10-K annual or quarterly reports to the candidates list
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Messages */}
          <div className="min-h-[200px] max-h-[400px] overflow-y-auto space-y-4 p-4 border rounded-lg bg-muted/30">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border"
                  }`}
                >
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{message.content}</span>
                    </div>
                  ) : (
                    <>
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                      {message.filingCandidate && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">
                              {message.filingCandidate.ticker}
                            </Badge>
                            <Badge variant="outline">
                              {message.filingCandidate.filing_type}
                            </Badge>
                            <Badge variant="outline">
                              {message.filingCandidate.filing_year}
                            </Badge>
                            <Badge
                              variant={
                                message.filingCandidate.status === "pending"
                                  ? "secondary"
                                  : "default"
                              }
                            >
                              {message.filingCandidate.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {message.filingCandidate.company_name}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder="e.g., Find Apple's 2023 10-K annual report..."
            suggestions={[
              "Find Apple's 2023 10-K",
              "Search Microsoft quarterly 2024",
              "Get Tesla latest annual report",
            ]}
          />
        </div>
      </CardContent>
    </Card>
  )
}

