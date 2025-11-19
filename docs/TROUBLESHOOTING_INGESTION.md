# Troubleshooting Filing Ingestion

## Problem: Documents Not Appearing After Approval

If you approve a filing candidate but don't see the document in the documents list, follow these steps:

### Step 1: Check if Backend is Running

The ingestion requires the Python FastAPI backend to be running.

**Check:**
```bash
# In a terminal, check if backend is running
curl http://localhost:8001/health
```

**If not running, start it:**
```bash
cd backend
uvicorn main:app --reload --port 8001
```

### Step 2: Check Ingestion Status in Database

1. **Open Supabase Dashboard** → **Table Editor** → **`filing_ingestions`**

2. **Look for recent entries** - Find the ingestion record for your approved candidate

3. **Check the `status` column:**
   - ✅ `completed` - Ingestion succeeded, document should be in `documents` table
   - ⚠️ `processing` - Still in progress (wait a moment and refresh)
   - ❌ `failed` - Check `error_message` column for details

4. **Check `error_message`** if status is `failed` - This will tell you what went wrong

### Step 3: Check Documents Table

1. **Open Supabase Dashboard** → **Table Editor** → **`documents`**

2. **Look for the document** - Search by name pattern like:
   ```sql
   SELECT * FROM documents 
   WHERE name LIKE '%GOOGL%10-K%2024%'
   ORDER BY created_at DESC;
   ```

3. **Check `text_content`**:
   - ✅ Has content - Document was parsed successfully
   - ❌ `NULL` - PDF parsing failed (see "PDF Parsing Issues" below)

### Step 4: Check Backend Logs

If the backend is running, check the terminal output for errors:

```bash
# Look for errors like:
# "Error ingesting filing candidate"
# "Error downloading PDF"
# "Error uploading to backend"
```

### Step 5: Check Browser Console

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Look for errors** when you click "Approve"
4. **Common errors:**
   - `Failed to fetch` - Backend not running or wrong URL
   - `Network error` - Connection issue
   - `500 Internal Server Error` - Backend error (check backend logs)

## Common Issues and Solutions

### Issue 1: Backend Not Running

**Symptoms:**
- Approval succeeds but document never appears
- Browser console shows "Failed to fetch" or network errors
- `filing_ingestions` table shows no new entries

**Solution:**
```bash
cd backend
uvicorn main:app --reload --port 8001
```

### Issue 2: PDF Parsing Failed (text_content is NULL)

**Symptoms:**
- Document appears in `documents` table
- But `text_content` is `NULL`
- No chunks created
- Document not searchable

**Causes:**
- SEC provided HTML instead of PDF (now fixed in latest code)
- Corrupted PDF file
- Unsupported PDF format

**Solution:**
1. **Delete the broken document:**
   ```sql
   DELETE FROM documents WHERE name = 'YOUR_DOCUMENT_NAME';
   ```

2. **Re-approve the candidate** in `/filings` UI

3. **The latest code should now:**
   - Detect HTML files from SEC
   - Find the PDF version automatically
   - Download and parse the PDF correctly

### Issue 3: Ingestion Stuck in "processing"

**Symptoms:**
- `filing_ingestions.status` = `processing`
- No document created after several minutes

**Solution:**
1. **Check backend logs** for errors
2. **Check if backend is still running**
3. **Manually mark as failed** if needed:
   ```sql
   UPDATE filing_ingestions 
   SET status = 'failed', 
       error_message = 'Manually marked as failed - check logs',
       ingestion_completed_at = NOW()
   WHERE status = 'processing' 
   AND ingestion_started_at < NOW() - INTERVAL '10 minutes';
   ```

### Issue 4: Wrong Backend URL

**Symptoms:**
- Approval fails with network error
- Console shows connection refused

**Solution:**
1. **Check `.env.local`** (project root):
   ```env
   AI_SERVICE_URL=http://localhost:8001
   ```

2. **If backend is on different port/URL**, update it:
   ```env
   AI_SERVICE_URL=http://your-backend-url:port
   ```

3. **Restart Next.js dev server** after changing `.env.local`

## Manual Ingestion (If Needed)

If automatic ingestion fails, you can manually trigger it:

### Option 1: Via Backend API

```bash
curl -X POST http://localhost:8001/filings/{candidate_id}/ingest
```

Replace `{candidate_id}` with the UUID from `filing_candidates` table.

### Option 2: Via Python Script

```bash
cd backend
python3 -m agents.filing_ingestion --candidate-id {candidate_id}
```

## Verification Checklist

After approving a filing, verify:

- [ ] Backend is running (`curl http://localhost:8001/health`)
- [ ] `filing_ingestions` table has a new entry
- [ ] `filing_ingestions.status` = `completed` (not `failed`)
- [ ] `documents` table has a new entry with the document name
- [ ] `documents.text_content` is NOT NULL
- [ ] `document_chunks` table has entries for the document
- [ ] Document appears in `/` (main page) documents list

## Getting Help

If none of these steps resolve the issue:

1. **Check all logs:**
   - Browser console (F12)
   - Backend terminal output
   - Supabase logs (Dashboard → Logs)

2. **Share the following:**
   - `filing_ingestions` entry (status, error_message)
   - `documents` entry (name, text_content status)
   - Backend error logs
   - Browser console errors

