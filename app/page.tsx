"use client"

import { Sidebar } from "@/components/sidebar"
import { TopNav } from "@/components/top-nav"
import { DocumentUpload } from "@/components/document-upload"
import { DocumentList } from "@/components/document-list"
import { ChatInterface } from "@/components/chat-interface"
import { EmptyState } from "@/components/empty-state"
import { EvalSummary } from "@/components/eval-summary"
import { useState } from "react"

export default function Home() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [selectedDocumentName, setSelectedDocumentName] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  const handleSelectDocument = (docId: string, docName: string) => {
    setSelectedDocumentId(docId)
    setSelectedDocumentName(docName)
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation */}
      <TopNav />
      
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Upload and Documents */}
        <aside className="flex w-80 flex-col gap-4 overflow-y-auto border-r border-border bg-muted/30 p-4">
          <DocumentUpload onUploadComplete={handleUploadComplete} />
          <DocumentList 
            selectedDocument={selectedDocumentId}
            onSelectDocument={handleSelectDocument}
            refreshTrigger={refreshTrigger}
          />
          <div className="mt-auto">
            <EvalSummary documentId={selectedDocumentId} />
          </div>
        </aside>
        
        {/* Main Content - Chat or Empty State */}
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          {selectedDocumentName && selectedDocumentId ? (
            <ChatInterface 
              documentName={selectedDocumentName}
              documentId={selectedDocumentId}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  )
}
