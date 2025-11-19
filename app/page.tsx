"use client"

import { TopNav } from "@/components/top-nav"
import { DocumentUpload } from "@/components/document-upload"
import { DocumentList } from "@/components/document-list"
import { ChatInterface } from "@/components/chat-interface"
import { EquityAnalystCopilot } from "@/components/equity-analyst-copilot"
import { EmptyState } from "@/components/empty-state"
import { EvalSummary } from "@/components/eval-summary"
import { ReportHistory } from "@/components/report-history"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export default function Home() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [selectedDocumentName, setSelectedDocumentName] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"chat" | "copilot">("chat")
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [reportHistoryRefresh, setReportHistoryRefresh] = useState(0)
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
    setSelectedRunId(null) // Reset selected run when document changes
    // Close sidebar on mobile after selecting document
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const handleBackClick = () => {
    setSelectedDocumentId(null)
    setSelectedDocumentName(null)
  }

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId)
  }

  const handleRunLoaded = (runId: string) => {
    setSelectedRunId(runId)
  }

  const handleNewRunComplete = () => {
    setReportHistoryRefresh(prev => prev + 1)
  }

  const SidebarContent = () => (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex-shrink-0">
        <DocumentUpload onUploadComplete={handleUploadComplete} />
      </div>
      {/* Documents section - always visible */}
      <div className="flex-shrink-0">
        <DocumentList 
          selectedDocument={selectedDocumentId}
          onSelectDocument={handleSelectDocument}
          refreshTrigger={refreshTrigger}
        />
      </div>
      {/* Analysis Reports - only visible in copilot tab when document is selected */}
      {activeTab === "copilot" && selectedDocumentId && (
        <div className="flex-shrink-0">
          <ReportHistory
            documentId={selectedDocumentId}
            selectedRunId={selectedRunId}
            onSelectRun={handleSelectRun}
            refreshTrigger={reportHistoryRefresh}
          />
        </div>
      )}
      <div className="flex-shrink-0">
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
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "chat" | "copilot")} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-shrink-0 border-b border-border px-4 md:px-6 pt-2">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="chat">Chat with document</TabsTrigger>
                  <TabsTrigger value="copilot">Equity Analyst Copilot</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
                <ChatInterface 
                  documentName={selectedDocumentName}
                  documentId={selectedDocumentId}
                />
              </TabsContent>
              <TabsContent value="copilot" className="flex-1 overflow-hidden m-0">
                <EquityAnalystCopilot 
                  documentName={selectedDocumentName}
                  documentId={selectedDocumentId}
                  selectedRunId={selectedRunId}
                  onRunLoaded={handleRunLoaded}
                  onNewRunComplete={handleNewRunComplete}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  )
}
