"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronDown, ChevronRight, FileText, Loader2 } from 'lucide-react'
import { useState, useEffect, useRef } from "react"

export interface Evidence {
  label: string
  excerpt: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  evidence?: Evidence[]
  isLoading?: boolean
}

interface ChatThreadProps {
  messages: Message[]
}

export function ChatThread({ messages }: ChatThreadProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messagesEndRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth"
      })
    }
  }, [messages])

  return (
    <div 
      ref={scrollContainerRef}
      className="h-full overflow-y-auto px-6 py-4"
    >
      <div className="space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const [isEvidenceExpanded, setIsEvidenceExpanded] = useState(false)
  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground border border-border"
          }`}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-sm leading-relaxed">{message.content}</p>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
        </div>

        {/* Evidence Section - Only for assistant messages */}
        {!isUser && message.evidence && message.evidence.length > 0 && (
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
                Evidence ({message.evidence.length})
              </span>
            </Button>

            {isEvidenceExpanded && (
              <div className="border-t border-border/50 p-3 space-y-2">
                {message.evidence.map((evidence, index) => (
                  <div
                    key={index}
                    className="rounded-md bg-muted/50 p-3 space-y-1"
                  >
                    <div className="text-xs font-medium text-foreground">
                      {evidence.label}
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {evidence.excerpt}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
