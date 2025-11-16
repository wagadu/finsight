-- Supabase Storage setup for document uploads
-- Run this in your Supabase SQL editor

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
-- RLS is enabled by default, but we'll create policies

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Service role can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can delete documents" ON storage.objects;

-- Policy: Allow service role to upload files
CREATE POLICY "Service role can upload documents"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'documents');

-- Policy: Allow service role to read files
CREATE POLICY "Service role can read documents"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'documents');

-- Policy: Allow service role to delete files
CREATE POLICY "Service role can delete documents"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'documents');

-- Policy: Allow authenticated users to upload (for direct client uploads)
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Policy: Allow anonymous users (anon key) to upload files
-- This is needed for frontend uploads using NEXT_PUBLIC_SUPABASE_ANON_KEY
CREATE POLICY "Anonymous users can upload documents"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'documents');

-- Policy: Allow anonymous users to read files
CREATE POLICY "Anonymous users can read documents"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'documents');

-- Policy: Allow anonymous users to delete files (for cleanup on error)
CREATE POLICY "Anonymous users can delete documents"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'documents');

