import { FileText, Upload } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-muted p-6">
            <FileText className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">
          No document selected
        </h2>
        <p className="mt-2 max-w-md text-balance text-muted-foreground">
          Upload a PDF document or select one from the list to start analyzing with FinSight Copilot
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" />
          <span>Drag and drop PDFs in the upload area to get started</span>
        </div>
      </div>
    </div>
  )
}
