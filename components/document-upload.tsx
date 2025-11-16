"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Loader2 } from 'lucide-react'
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface DocumentUploadProps {
  onUploadComplete: () => void
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      toast({
        title: "Invalid file type",
        description: "Only PDF files are supported",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      
      toast({
        title: "Upload successful",
        description: `${data.name} has been uploaded`,
      })
      
      onUploadComplete()
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your document",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      uploadFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      uploadFile(files[0])
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/50"
          }`}
        >
          {isUploading ? (
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {isUploading ? "Uploading..." : "Drag and drop PDF files here"}
          </p>
          {!isUploading && <p className="text-xs text-muted-foreground">or</p>}
        </div>
        
        <Button className="w-full" variant="outline" disabled={isUploading} asChild={!isUploading}>
          <label className={isUploading ? "" : "cursor-pointer"}>
            {isUploading ? "Uploading..." : "Browse files"}
            {!isUploading && (
              <input
                type="file"
                accept=".pdf"
                className="sr-only"
                onChange={handleFileSelect}
              />
            )}
          </label>
        </Button>
      </CardContent>
    </Card>
  )
}
