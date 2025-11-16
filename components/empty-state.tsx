import { FileText, Upload } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-4 md:p-8">
      <div className="text-center max-w-md">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-muted p-4 md:p-6">
            <FileText className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground">
          No document selected
        </h2>
        <p className="mt-2 text-sm md:text-base text-balance text-muted-foreground">
          Upload a PDF document or select one from the list to start analyzing with FinSight Copilot
        </p>
        <div className="mt-4 md:mt-6 flex items-center justify-center gap-2 text-xs md:text-sm text-muted-foreground">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Drag and drop PDFs in the upload area to get started</span>
          <span className="sm:hidden">Tap the menu to upload a document</span>
        </div>
      </div>
    </div>
  )
}
