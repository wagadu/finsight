"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send } from 'lucide-react'
import { useState, KeyboardEvent } from "react"

interface ChatInputProps {
  onSend: (message: string) => void
  placeholder?: string
  suggestions?: string[]
  disabled?: boolean
}

export function ChatInput({
  onSend,
  placeholder = "Ask a question about this document...",
  suggestions = [
    "Summarise key risks",
    "What was total revenue in 2023?",
    "Identify financial trends",
  ],
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim() || disabled) return
    onSend(input)
    setInput("")
  }

  const handleSuggestionClick = (suggestion: string) => {
    if (disabled) return
    onSend(suggestion)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-muted/30 p-3 md:p-4 space-y-2 md:space-y-3">
      {/* Suggestion Chips - Hide on very small screens */}
      {suggestions.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-2">
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={disabled}
              className="h-auto py-1.5 px-3 text-xs font-normal bg-background hover:bg-accent"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="flex gap-2 items-end"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[44px] max-h-[100px] md:max-h-[120px] resize-none text-sm md:text-base"
          rows={1}
          disabled={disabled}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || disabled} className="h-[44px] w-[44px] flex-shrink-0">
          <Send className="h-4 w-4" />
          <span className="sr-only">Send message</span>
        </Button>
      </form>
      <p className="hidden md:block text-xs text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  )
}
