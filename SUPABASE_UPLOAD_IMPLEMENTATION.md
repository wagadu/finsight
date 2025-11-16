# Supabase Storage Upload Implementation Summary

## Overview

This implementation bypasses Vercel's 4.5MB file size limit by using Supabase Storage and Edge Functions for direct file uploads and processing.

## What Was Implemented

### 1. Supabase Storage Setup
- **File**: `backend/storage_setup.sql`
- Creates `documents` bucket with 50MB file size limit
- Sets up RLS policies for service role and authenticated users
- Allows direct client uploads to Supabase Storage

### 2. Supabase Edge Function
- **Location**: `supabase/functions/upload-document/index.ts`
- **Purpose**: Processes uploaded files after they're stored in Supabase Storage
- **Flow**:
  1. Receives file metadata (fileName, filePath, fileSize)
  2. Downloads file from Supabase Storage
  3. Calls Python backend to process PDF (parse, chunk, embed)
  4. Returns document metadata
  5. Cleans up storage on error

### 3. Frontend Updates
- **File**: `components/document-upload.tsx`
- **Changes**:
  - Direct upload to Supabase Storage (bypasses Vercel)
  - Real-time upload progress tracking (0-100%)
  - Progress bar UI component
  - Error handling with storage cleanup
  - Updated file size limit to 50MB

### 4. Dependencies
- Added `@supabase/supabase-js` for client-side Supabase access

## Architecture Flow

```
1. User selects PDF file
   ↓
2. Frontend uploads directly to Supabase Storage
   - Shows progress: 10% → 80%
   ↓
3. Frontend calls Edge Function with file metadata
   - Progress: 85% → 95%
   ↓
4. Edge Function downloads file from Storage
   ↓
5. Edge Function calls Python backend with file
   ↓
6. Python backend processes:
   - Parses PDF
   - Chunks text
   - Generates embeddings
   - Stores in database
   ↓
7. Edge Function returns document metadata
   ↓
8. Frontend shows success (100%)
```

## Environment Variables Required

### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### Backend (.env)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key_here
OPENAI_API_KEY=your_openai_key_here
```

### Edge Function (Supabase Dashboard)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (secret)
- `OPENAI_API_KEY`: OpenAI API key (secret)
- `PYTHON_BACKEND_URL`: Python backend URL (e.g., `https://your-backend.railway.app`)

## Setup Steps

1. **Run Storage Setup SQL**
   - Go to Supabase SQL Editor
   - Run `backend/storage_setup.sql`

2. **Deploy Edge Function**
   - See `backend/EDGE_FUNCTION_SETUP.md` for detailed instructions
   - Deploy via Supabase Dashboard or CLI

3. **Set Environment Variables**
   - Frontend: Add to `.env.local`
   - Backend: Add to `backend/.env`
   - Edge Function: Add secrets in Supabase Dashboard

4. **Test Upload**
   - Upload a file > 4MB to verify it works
   - Check upload progress indicator
   - Verify document appears in list

## Benefits

✅ **Bypasses Vercel 4.5MB limit**: Files up to 50MB supported  
✅ **Real-time progress**: Users see upload progress  
✅ **Direct upload**: No intermediate Vercel serverless function  
✅ **Scalable**: Supabase Storage handles large files efficiently  
✅ **Error handling**: Automatic cleanup on failure  

## File Size Limits

- **Vercel Serverless Functions**: 4.5MB (bypassed)
- **Supabase Storage**: 50MB per file
- **Edge Functions**: 50MB request body
- **Current Implementation**: 50MB limit

## Notes

- The old `/api/documents/upload` route still exists but is no longer used by the frontend
- All uploads now go through Supabase Storage
- Python backend must be accessible from Edge Function (set `PYTHON_BACKEND_URL`)
- Edge Function uses service role key for full database access

## Troubleshooting

### "Supabase credentials not configured"
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`

### "Failed to upload file to storage"
- Verify `documents` bucket exists
- Check RLS policies allow uploads
- Verify file size < 50MB

### "Failed to process document"
- Check Python backend is running
- Verify `PYTHON_BACKEND_URL` in Edge Function secrets
- Check Python backend logs

### "Missing required environment variables" (Edge Function)
- Verify all secrets are set in Supabase Dashboard
- Check `SUPABASE_SERVICE_ROLE_KEY` is service role key (not anon key)

