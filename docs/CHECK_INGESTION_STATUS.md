# How to Check Ingestion Status

## Quick Check Steps

### 1. Check Backend Terminal

Look at the terminal where you're running the backend (`uvicorn main:app --reload --port 8001`). You should see:
- ✅ Success messages: "Successfully ingested document: {id}"
- ❌ Error messages: "Error ingesting filing candidate" or "Error uploading to backend"

### 2. Check Supabase Database

**Option A: Via Supabase Dashboard**

1. Go to **Table Editor** → **`filing_ingestions`**
2. Sort by `ingestion_started_at` DESC (newest first)
3. Check the most recent entry:
   - **`status`**: Should be `completed`, `processing`, or `failed`
   - **`error_message`**: Shows the error if status is `failed`
   - **`document_id`**: UUID of created document (if successful)

**Option B: Via SQL Query**

```sql
-- Check recent ingestions
SELECT 
  fi.id,
  fi.status,
  fi.error_message,
  fi.document_id,
  fi.ingestion_started_at,
  fi.ingestion_completed_at,
  fc.ticker,
  fc.filing_type,
  fc.filing_year,
  d.name as document_name
FROM filing_ingestions fi
JOIN filing_candidates fc ON fi.candidate_id = fc.id
LEFT JOIN documents d ON fi.document_id = d.id
ORDER BY fi.ingestion_started_at DESC
LIMIT 5;
```

### 3. Check Documents Table

```sql
-- Check if document was created
SELECT 
  id,
  name,
  uploaded_at,
  CASE 
    WHEN text_content IS NULL THEN 'NO CONTENT (parsing failed)'
    WHEN LENGTH(text_content) = 0 THEN 'EMPTY CONTENT'
    ELSE 'HAS CONTENT'
  END as content_status,
  LENGTH(text_content) as content_length
FROM documents
WHERE name LIKE '%10-K%'
ORDER BY uploaded_at DESC
LIMIT 10;
```

### 4. Check Document Chunks

```sql
-- Check if chunks were created
SELECT 
  d.name,
  COUNT(dc.id) as chunk_count,
  SUM(CASE WHEN dc.embedding IS NOT NULL THEN 1 ELSE 0 END) as embedding_count
FROM documents d
LEFT JOIN document_chunks dc ON d.id = dc.document_id
WHERE d.name LIKE '%10-K%'
GROUP BY d.id, d.name
ORDER BY d.uploaded_at DESC
LIMIT 10;
```

## Common Error Messages and Fixes

### "Download failed: ..."
- **Cause**: Can't download PDF from SEC URL
- **Fix**: Check SEC URL is accessible, verify User-Agent header

### "Backend upload failed (HTTP 500): ..."
- **Cause**: Backend endpoint error
- **Fix**: Check backend logs for detailed error

### "Backend upload failed: ..."
- **Cause**: Network error or backend not running
- **Fix**: Ensure backend is running at `http://localhost:8001`

### "Could not find PDF version for HTML filing"
- **Cause**: SEC filing doesn't have PDF version
- **Fix**: This should be fixed in latest code - try re-approving

## Manual Test

To test ingestion manually:

```bash
cd backend

# Get a candidate_id from Supabase (filing_candidates table)
# Then run:
python3 test_ingestion.py <candidate_id>
```

This will show detailed error messages.

