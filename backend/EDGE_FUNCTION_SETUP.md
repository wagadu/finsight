# Supabase Edge Function Setup Guide

This guide will help you set up the Supabase Edge Function for handling large file uploads.

## Overview

The Edge Function bypasses Vercel's 4.5MB file size limit by:
1. Uploading files directly to Supabase Storage (50MB limit)
2. Processing files in the Edge Function
3. Calling the Python backend to parse PDFs and generate embeddings

## Prerequisites

1. Supabase project with Storage enabled
2. Python backend running and accessible
3. Supabase CLI installed (for local development)

## Step 1: Set Up Supabase Storage

1. Go to your Supabase dashboard → **Storage**
2. Run the SQL from `backend/storage_setup.sql` in the SQL Editor to:
   - Create the `documents` bucket
   - Set up RLS policies

Or manually:
1. Go to **Storage** → **Buckets** → **New Bucket**
2. Name: `documents`
3. Public: `false` (private)
4. File size limit: `52428800` (50MB)
5. Allowed MIME types: `application/pdf`

## Step 2: Deploy Edge Function

### Option A: Deploy via Supabase Dashboard

1. Go to your Supabase dashboard → **Edge Functions**
2. Click **Create a new function**
3. Name: `upload-document`
4. Copy the contents of `supabase/functions/upload-document/index.ts`
5. Paste into the function editor
6. Save and deploy

### Option B: Deploy via Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy upload-document
```

## Step 3: Set Environment Variables

In your Supabase dashboard → **Edge Functions** → **upload-document** → **Settings**:

Add these secrets:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (from Settings → API)
- `OPENAI_API_KEY`: Your OpenAI API key
- `PYTHON_BACKEND_URL`: Your Python backend URL (e.g., `https://your-backend.railway.app` or `http://localhost:8001` for local)

## Step 4: Update Frontend Environment Variables

Add to your `.env.local` (for Next.js):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

These are public variables (safe to expose in the browser).

## Step 5: Test the Setup

1. Start your Python backend
2. Start your Next.js frontend
3. Try uploading a PDF file (any size up to 50MB)
4. Check the upload progress indicator
5. Verify the document appears in your documents list

## Troubleshooting

### Error: "Supabase credentials not configured"
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in your `.env.local`

### Error: "Failed to upload file to storage"
- Check that the `documents` bucket exists in Supabase Storage
- Verify RLS policies allow uploads
- Check file size is under 50MB

### Error: "Failed to process document"
- Verify Python backend is running and accessible
- Check `PYTHON_BACKEND_URL` in Edge Function secrets
- Check Python backend logs for errors

### Error: "Missing required environment variables"
- Verify all Edge Function secrets are set in Supabase dashboard
- Check that `SUPABASE_SERVICE_ROLE_KEY` is the service role key (not anon key)

## Architecture Flow

```
Client (Browser)
  ↓ (1. Upload file)
Supabase Storage (direct upload, bypasses Vercel)
  ↓ (2. Call Edge Function)
Supabase Edge Function
  ↓ (3. Download from Storage)
  ↓ (4. Call Python Backend)
Python Backend (processes PDF, chunks, embeddings)
  ↓ (5. Store in Database)
Supabase Database
  ↓ (6. Return document metadata)
Client (shows success)
```

## Local Development

To test Edge Functions locally:

```bash
# Start Supabase locally
supabase start

# Serve Edge Functions locally
supabase functions serve upload-document --env-file .env.local

# The function will be available at:
# http://localhost:54321/functions/v1/upload-document
```

Update `PYTHON_BACKEND_URL` in your local `.env` to point to your local Python backend.

## Production Deployment

1. Deploy Edge Function to Supabase (via dashboard or CLI)
2. Set all environment variables/secrets in Supabase dashboard
3. Update frontend environment variables in Vercel
4. Test with a large file (> 4MB) to verify it works

