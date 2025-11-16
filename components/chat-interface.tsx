"use client"

import { ChatThread, Message } from "@/components/chat-thread"
import { ChatInput } from "@/components/chat-input"
import { useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"

interface ChatInterfaceProps {
  documentName: string
  documentId: string
}

export function ChatInterface({ documentName, documentId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `I'm ready to help you analyze "${documentName}". What would you like to know?`,
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

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
      content: "Thinking...",
      isLoading: true,
    }

    setMessages((prev) => [...prev, thinkingMessage])
    setIsLoading(true)

    try {
      // Call the API with document ID and full message history
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response from chat API")
      }

      const data = await response.json()

      // Replace thinking message with real response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === thinkingId
            ? {
                id: thinkingId,
                role: "assistant",
                content: data.answer,
                evidence: data.citations,
              }
            : msg
        )
      )
    } catch (error) {
      // Remove thinking message and show error
      setMessages((prev) => prev.filter((msg) => msg.id !== thinkingId))
      
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Document Header */}
      <div className="flex-shrink-0 border-b border-border bg-muted/30 px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">{documentName}</h2>
        <p className="text-sm text-muted-foreground">
          Ask questions about this document
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatThread messages={messages} />
      </div>

      <div className="flex-shrink-0">
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  )
}
