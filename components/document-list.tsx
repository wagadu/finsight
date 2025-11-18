"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FileText, Loader2 } from 'lucide-react'
import { useEffect, useState } from "react"

interface Document {
  id: string
  name: string
  uploadedAt: string
  pageCount?: number
}

interface DocumentListProps {
  selectedDocument: string | null
  onSelectDocument: (docId: string, docName: string) => void
  refreshTrigger: number
}

function formatDate(isoString: string) {
  const date = new Date(isoString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInHours / 24)
  
  if (diffInHours < 1) return "Just now"
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

export function DocumentList({ selectedDocument, onSelectDocument, refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const response = await fetch('/api/documents')
        
        if (!response.ok) {
          throw new Error('Failed to fetch documents')
        }
        
        const data = await response.json()
        setDocuments(data.documents)
      } catch (err) {
        setError('Failed to load documents')
        console.error('Error fetching documents:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocuments()
  }, [refreshTrigger])

  return (
    <Card className="flex-1 w-full max-w-full overflow-hidden flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base">Documents</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden flex-1 min-h-0">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {error}
            </div>
          ) : documents.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No documents yet
            </div>
          ) : (
            <div className="space-y-1 p-3 w-full">
              {documents.map((doc) => (
                <Tooltip key={doc.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectDocument(doc.id, doc.name)}
                      className={`flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent ${
                        selectedDocument === doc.id ? "bg-accent" : ""
                      }`}
                    >
                      <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0 w-0 overflow-hidden">
                        <p className="text-sm font-medium truncate block overflow-hidden text-ellipsis whitespace-nowrap">
                          {doc.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(doc.uploadedAt)}
                          {doc.pageCount && ` • ${doc.pageCount} pages`}
                        </p>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs break-words">{doc.name}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
