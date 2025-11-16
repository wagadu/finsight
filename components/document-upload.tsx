"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Loader2 } from 'lucide-react'
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from '@supabase/supabase-js'

interface DocumentUploadProps {
  onUploadComplete: () => void
}

// Initialize Supabase client
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured')
  }
  
  return createClient(supabaseUrl, supabaseAnonKey)
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  const uploadFile = async (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.pdf')) {
      toast({
        title: "Invalid file type",
        description: "Only PDF files are supported",
        variant: "destructive",
      })
      return
    }

    // Validate file size (50MB limit for Supabase Storage)
    const MAX_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_SIZE) {
      toast({
        title: "File too large",
        description: `Maximum file size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`,
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      // Check if Supabase is configured
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.')
      }
      
      const supabase = getSupabaseClient()
      
      // Generate unique file path
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = fileName

      // Step 1: Upload to Supabase Storage
      // Note: Standard upload doesn't support progress callbacks, so we simulate progress
      setUploadProgress(10)
      
      // Simulate upload progress (since Supabase doesn't provide real-time progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev < 70) {
            return prev + 5 // Increment by 5% every 200ms up to 70%
          }
          return prev
        })
      }, 200)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })
      
      clearInterval(progressInterval)
      setUploadProgress(70) // Set to 70% after upload completes

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw new Error(uploadError.message || 'Failed to upload file to storage')
      }

      // Step 2: Call Edge Function to process the file
      setUploadProgress(75)
      
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload-document`
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          filePath: uploadData.path,
          fileSize: file.size,
        }),
      })

      setUploadProgress(95)

      if (!response.ok) {
        let errorMessage = 'Failed to process document'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.detail || errorMessage
          console.error('Edge Function error:', errorData)
        } catch (e) {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
          console.error('Edge Function error (text):', errorText)
        }
        
        // Clean up: delete file from storage if processing failed
        try {
          await supabase.storage.from('documents').remove([filePath])
        } catch (cleanupError) {
          console.error('Failed to cleanup file:', cleanupError)
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setUploadProgress(100)
      
      toast({
        title: "Upload successful",
        description: `${data.name} has been uploaded and processed`,
      })
      
      onUploadComplete()
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage = error instanceof Error ? error.message : 'There was an error uploading your document'
      
      // Provide helpful error message if Supabase is not configured
      if (errorMessage.includes('Supabase') || errorMessage.includes('not configured')) {
        toast({
          title: "Configuration Error",
          description: "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file and restart the dev server.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Upload failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setIsUploading(false)
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 2000)
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
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 md:p-6 text-center transition-colors ${
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

        {/* Upload Progress */}
        {isUploading && uploadProgress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}
        
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
