"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

interface TopNavProps {
  onMenuClick?: () => void
  showBackButton?: boolean
  onBackClick?: () => void
}

export function TopNav({ onMenuClick, showBackButton, onBackClick }: TopNavProps) {
  const isMobile = useIsMobile()

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      {/* Left: Menu Button (Mobile) / App Title */}
      <div className="flex items-center gap-2 md:gap-3">
        {isMobile && onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        )}
        {isMobile && showBackButton && onBackClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBackClick}
            className="h-9 w-9"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="sr-only">Back</span>
          </Button>
        )}
        <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-primary">
          <svg
            className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h1 className="text-lg md:text-xl font-semibold text-foreground">
          FinSight Copilot
        </h1>
      </div>

      {/* Right: User Avatar */}
      <div className="flex items-center gap-4">
        <Avatar className="h-8 w-8 md:h-9 md:w-9">
          <AvatarImage src="/placeholder.svg?height=36&width=36" alt="User" />
          <AvatarFallback className="bg-muted text-xs md:text-sm font-medium">
            JD
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
