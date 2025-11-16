"use client"

import { TopNav } from "@/components/top-nav"
import { DocumentUpload } from "@/components/document-upload"
import { DocumentList } from "@/components/document-list"
import { ChatInterface } from "@/components/chat-interface"
import { EmptyState } from "@/components/empty-state"
import { EvalSummary } from "@/components/eval-summary"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"

export default function Home() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [selectedDocumentName, setSelectedDocumentName] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()
  
  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1)
    // Close sidebar on mobile after upload
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const handleSelectDocument = (docId: string, docName: string) => {
    setSelectedDocumentId(docId)
    setSelectedDocumentName(docName)
    // Close sidebar on mobile after selecting document
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const handleBackClick = () => {
    setSelectedDocumentId(null)
    setSelectedDocumentName(null)
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4 p-4">
      <DocumentUpload onUploadComplete={handleUploadComplete} />
      <DocumentList 
        selectedDocument={selectedDocumentId}
        onSelectDocument={handleSelectDocument}
        refreshTrigger={refreshTrigger}
      />
      <div className="mt-auto">
        <EvalSummary documentId={selectedDocumentId} />
      </div>
    </div>
  )

  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation */}
      <TopNav 
        onMenuClick={() => setSidebarOpen(true)}
        showBackButton={isMobile && selectedDocumentId !== null}
        onBackClick={handleBackClick}
      />
      
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-80 flex-col gap-4 overflow-y-auto border-r border-border bg-muted/30 p-4">
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar - Sheet/Drawer */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0 overflow-y-auto">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <SidebarContent />
          </SheetContent>
        </Sheet>
        
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
