# Supabase Setup Guide

This guide will help you set up Supabase for the FinSight AI Service.

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: FinSight (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose the closest region
4. Click "Create new project" and wait for it to be ready (~2 minutes)

## Step 2: Create the Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click "New query"
3. Copy the entire contents of `schema.sql` from this directory
4. Paste it into the SQL editor
5. Click "Run" (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned"

## Step 3: Get Your Credentials

1. Go to **Project Settings** → **API** (left sidebar)
2. You'll need two values:
   - **Project URL**: This is your `SUPABASE_URL`
     - Example: `https://abcdefghijklmnop.supabase.co`
   - **anon public** key: This is your `SUPABASE_KEY`
     - It's a long string starting with `eyJ...`

## Step 4: Configure Environment Variables

1. In the `backend/` directory, create or edit `.env`:
   ```bash
   cd backend
   # If .env doesn't exist, create it
   touch .env
   ```

2. Add your Supabase credentials:
   ```env
   OPENAI_API_KEY=your_openai_key_here
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your_anon_public_key_here
   ```

3. Save the file

## Step 5: Install Dependencies

Make sure you have the Supabase Python client installed:

```bash
cd backend
pip3 install supabase
```

Or install all dependencies:

```bash
pip3 install -r requirements.txt
```

## Step 6: Test the Connection

1. Start your backend server:
   ```bash
   python3 -m uvicorn main:app --reload --port 8001
   ```

2. Check the health endpoint:
   ```bash
   curl http://localhost:8001/health
   ```

3. If you see `{"status":"ok"}`, the server is running

4. Try uploading a document through the frontend - it should now save to Supabase!

## Verifying Data in Supabase

1. Go to your Supabase dashboard
2. Navigate to **Table Editor** (left sidebar)
3. Click on the `documents` table
4. You should see any documents you've uploaded

## Troubleshooting

### "Database connection not configured" error
- Make sure your `.env` file has both `SUPABASE_URL` and `SUPABASE_KEY`
- Restart the backend server after adding environment variables

### "relation 'documents' does not exist" error
- Make sure you ran the SQL schema in Step 2
- Check the SQL Editor for any errors

### "new row violates row-level security policy" error
- The schema includes RLS policies that should allow all operations
- If you see this, check that the policy was created correctly in the SQL Editor

## Next Steps

Once Supabase is set up, you can:
- Upload documents and see them persist across server restarts
- Query documents directly in Supabase
- Later add embeddings and vector search for RAG

