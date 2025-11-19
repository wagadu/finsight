# Filing Agent Documentation

## Overview

The FinSight Filing Agent is an autonomous system that continuously monitors trusted sources for new annual reports (10-K, 20-F, or similar), queues candidates in Supabase, obtains human or automated approval, and then ingests filings using the existing document ingestion pipeline.

## Architecture

### Components

1. **Database Schema** (`backend/filing_agent_schema.sql`)
   - `filing_watchlist`: Companies to monitor
   - `filing_candidates`: Discovered filings awaiting approval
   - `filing_ingestions`: Ingestion event tracking

2. **Python Agent** (`backend/agents/filing_scout.py`)
   - SEC EDGAR polling
   - AnnualReports.com scraping
   - Deduplication logic
   - Candidate insertion

3. **Ingestion Bridge** (`backend/agents/filing_ingestion.py`)
   - Downloads PDFs from source URLs
   - Calls existing `/documents` endpoint
   - Records ingestion metrics

4. **Next.js Admin Interface** (`app/filings/page.tsx`)
   - Candidate review and approval
   - Status filtering and search
   - Ingestion monitoring

5. **API Routes** (`app/api/filings/*`)
   - `GET /api/filings`: List candidates with pagination/filters
   - `POST /api/filings/:id/approve`: Approve and trigger ingestion
   - `POST /api/filings/:id/reject`: Reject candidate

## Setup

### 1. Database Migration

Run the schema migration in your Supabase SQL editor:

```sql
-- Run backend/filing_agent_schema.sql
```

This creates:
- `filing_watchlist` table
- `filing_candidates` table
- `filing_ingestions` table
- Required indexes and RLS policies

### 2. Environment Variables

Add to `backend/.env`:

```env
# SEC API Configuration
SEC_USER_AGENT=FinSight Filing Scout (your-email@example.com)

# Webhook Notifications (Optional)
FILING_AGENT_WEBHOOK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
# OR
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
# OR
FILING_AGENT_WEBHOOK_URL=https://your-custom-webhook.com/endpoint

# Backend Service URL (for ingestion)
AI_SERVICE_URL=http://localhost:8001
```

Add to Next.js `.env.local`:

```env
# Supabase (for API routes)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# OR use existing SUPABASE_KEY if it's the service role key
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

New dependencies:
- `httpx` - Async HTTP client
- `beautifulsoup4` - HTML parsing
- `lxml` - XML/HTML parser

### 4. Populate Watchlist

Add companies to monitor:

```sql
INSERT INTO filing_watchlist (ticker, cik, company_name, source, priority, is_active)
VALUES
  ('AAPL', '0000320193', 'Apple Inc.', 'sec', 10, true),
  ('MSFT', '0000789019', 'Microsoft Corporation', 'sec', 10, true),
  ('GOOGL', '0001652044', 'Alphabet Inc.', 'sec', 10, true);
```

For AnnualReports.com (no CIK required):

```sql
INSERT INTO filing_watchlist (ticker, company_name, source, priority, is_active)
VALUES
  ('TSLA', 'Tesla Inc.', 'annualreports', 5, true);
```

## Usage

### Running the Agent

#### Manual Run (CLI)

```bash
# Dry run (no database writes) - safe for testing
python -m backend.agents.filing_scout --dry-run --limit 5

# Full scan (writes to database)
python -m backend.agents.filing_scout

# Full scan with limit per company
python -m backend.agents.filing_scout --limit 10
```

#### Automated Scheduling

**Option 1: Supabase Edge Function (Cron)**

Create a Supabase Edge Function that calls your backend:

```typescript
// supabase/functions/filing-scout-cron/index.ts
Deno.serve(async (req) => {
  const backendUrl = Deno.env.get('BACKEND_SERVICE_URL')!
  await fetch(`${backendUrl}/filings/scan`, { method: 'POST' })
  return new Response('OK')
})
```

Schedule in Supabase Dashboard → Database → Cron Jobs:
```sql
-- Run daily at 2 AM UTC
SELECT cron.schedule(
  'filing-scout-daily',
  '0 2 * * *',
  $$ SELECT net.http_post(
    url := 'https://your-backend.railway.app/filings/scan',
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) $$
);
```

**Option 2: Vercel Cron**

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/filings/scan",
    "schedule": "0 2 * * *"
  }]
}
```

**Option 3: External Cron (cronjob.org, GitHub Actions, etc.)**

```bash
# Daily at 2 AM
0 2 * * * curl -X POST https://your-backend.railway.app/filings/scan
```

### Reviewing Candidates

1. Navigate to `/filings` in the FinSight app
2. Filter by status, source, or ticker
3. Review candidate details
4. Click "Approve" to trigger ingestion
5. Click "Reject" to mark as rejected

### Monitoring Ingestion

Check ingestion status in the `filing_ingestions` table:

```sql
SELECT 
  fi.*,
  fc.ticker,
  fc.filing_type,
  fc.filing_year,
  d.name as document_name
FROM filing_ingestions fi
JOIN filing_candidates fc ON fi.candidate_id = fc.id
LEFT JOIN documents d ON fi.document_id = d.id
ORDER BY fi.ingestion_started_at DESC
LIMIT 20;
```

## API Reference

### Backend Endpoints

#### `POST /filings/{candidate_id}/ingest`

Trigger ingestion of an approved filing candidate.

**Response:**
```json
{
  "success": true,
  "candidate_id": "uuid",
  "document_id": "uuid"
}
```

### Next.js API Routes

#### `GET /api/filings`

List filing candidates with pagination and filters.

**Query Parameters:**
- `status`: Filter by status (`pending`, `auto_approved`, `rejected`, `ingested`, `failed`)
- `source`: Filter by source (`sec`, `annualreports`)
- `ticker`: Search by ticker (partial match)
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 50)

**Response:**
```json
{
  "candidates": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

#### `POST /api/filings/:id/approve`

Approve a filing candidate and optionally trigger ingestion.

**Body:**
```json
{
  "reviewerNote": "Optional note",
  "autoIngest": true
}
```

#### `POST /api/filings/:id/reject`

Reject a filing candidate.

**Body:**
```json
{
  "rejectionReason": "Reason for rejection"
}
```

## Workflow

1. **Discovery**: Agent polls SEC/AnnualReports.com for new filings
2. **Deduplication**: Checks against existing documents and candidates
3. **Queue**: Inserts new candidates with status `pending`
4. **Review**: Admin reviews candidates in `/filings` interface
5. **Approval**: Admin approves → status changes to `auto_approved`
6. **Ingestion**: System downloads PDF and calls `/documents` endpoint
7. **Completion**: Status changes to `ingested`, document available in RAG system

## Troubleshooting

### Agent Not Finding Filings

1. **Check watchlist**: Ensure companies are in `filing_watchlist` with `is_active = true`
2. **Verify CIK format**: SEC CIKs must be 10 digits (zero-padded)
3. **Check SEC rate limits**: Agent respects 10 req/sec limit
4. **Review logs**: Check Python logs for HTTP errors

### Ingestion Failures

1. **Check source URL**: Verify PDF URL is accessible
2. **Check file size**: Ensure PDF is under 50MB
3. **Review error message**: Check `filing_ingestions.error_message`
4. **Verify backend**: Ensure `AI_SERVICE_URL` is correct and backend is running

### Duplicate Candidates

The agent automatically deduplicates by:
- SHA256 checksum
- SEC accession number
- CIK + filing_type + filing_year

If duplicates appear, check:
- Different filing years (not duplicates)
- Different sources (SEC vs AnnualReports)
- Checksum computation failures

## Best Practices

1. **Watchlist Management**
   - Use priority field to prioritize important companies
   - Regularly review and update watchlist
   - Deactivate companies no longer needed

2. **Scheduling**
   - Run agent daily (SEC updates typically happen after market close)
   - Avoid peak hours to reduce load
   - Monitor for rate limit errors

3. **Approval Workflow**
   - Review candidates weekly
   - Reject obvious duplicates or low-quality sources
   - Approve high-priority companies first

4. **Monitoring**
   - Set up webhook notifications for high-priority filings
   - Monitor ingestion success rate
   - Review failed ingestions regularly

## Security Considerations

1. **SEC User-Agent**: Must include contact email per SEC guidelines
2. **Service Role Key**: Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side
3. **Rate Limiting**: Agent respects SEC rate limits automatically
4. **Webhook URLs**: Store webhook URLs in environment variables, never commit

## Future Enhancements

- [ ] Automatic approval rules (e.g., auto-approve high-priority companies)
- [ ] Email notifications in addition to webhooks
- [ ] Batch approval interface
- [ ] Filing quality scoring
- [ ] Integration with more data sources
- [ ] XBRL parsing for structured data extraction

