# Quick Start: Filing Agent Setup

## ✅ Step 1: Database Migration (You've Done This!)

You've already run `backend/filing_agent_schema.sql` in your Supabase SQL editor. Great!

## 📝 Step 2: Add Companies to Watchlist

You need to add companies to the `filing_watchlist` table so the agent knows which companies to monitor.

### Quick Method: Using SQL Editor

1. **Open Supabase Dashboard** → **SQL Editor** → **New query**

2. **Copy and paste this SQL** (or customize with your companies):

```sql
-- Add some example companies to monitor
INSERT INTO filing_watchlist (ticker, cik, company_name, source, priority, is_active)
VALUES
  ('AAPL', '0000320193', 'Apple Inc.', 'sec', 10, true),
  ('MSFT', '0000789019', 'Microsoft Corporation', 'sec', 10, true),
  ('GOOGL', '0001652044', 'Alphabet Inc.', 'sec', 10, true);
```

3. **Click "Run"** (or press Cmd/Ctrl + Enter)

4. **Verify**: Go to **Table Editor** → `filing_watchlist` to see your companies

### Finding CIK Numbers

- Go to https://www.sec.gov/edgar/searchedgar/companysearch.html
- Search for company name
- Copy the CIK and format as 10 digits with leading zeros (e.g., `320193` → `0000320193`)

**For detailed instructions, see [WATCHLIST_SETUP.md](./WATCHLIST_SETUP.md)**

## 🧪 Step 3: Test the Agent

### First, install dependencies:

```bash
cd backend
pip install httpx beautifulsoup4 lxml
```

### Test with dry run (safe, no database writes):

```bash
python -m backend.agents.filing_scout --dry-run --limit 5
```

This will:
- ✅ Check your watchlist companies
- ✅ Fetch filings from SEC/AnnualReports
- ✅ Show what would be inserted
- ✅ **NOT write to database** (safe for testing)

### Expected Output:

```
============================================================
FinSight Filing Scout Agent
============================================================
Mode: DRY RUN (no database writes)
Limit: 5 candidates per company
============================================================

{
  "companies_checked": 3,
  "candidates_found": 15,
  "candidates_inserted": 0,
  "duplicates_skipped": 0,
  "errors": 0
}
```

### Run for real (writes to database):

```bash
python -m backend.agents.filing_scout
```

## ⚙️ Step 4: Set Up Scheduling (Optional)

You can run the agent manually or set up automatic scheduling. See [filing_agent.md](./filing_agent.md) for cron setup options.

## 🌐 Step 5: Access Admin UI

### Fix Environment Variables First

Make sure your `.env.local` file (in the project root, not backend/) has:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important**: Use the **service role key**, not the anon key!

### Then Access the UI

1. **Start your Next.js dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Navigate to**: http://localhost:3000/filings

3. **You should see**:
   - Empty state if no candidates yet
   - List of filing candidates if agent has run

### Troubleshooting the UI Error

If you see "Failed to fetch candidates":

1. **Check environment variables**:
   - Open `.env.local` in project root
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
   - Restart dev server: `npm run dev`

2. **Check database tables exist**:
   - Go to Supabase Dashboard → Table Editor
   - Verify `filing_candidates` table exists
   - If missing, re-run `backend/filing_agent_schema.sql`

3. **Check browser console**:
   - Open browser DevTools (F12)
   - Check Console tab for detailed error messages
   - The API route now returns helpful error hints

4. **Test API directly**:
   ```bash
   curl http://localhost:3000/api/filings
   ```
   Should return JSON with candidates array (may be empty)

## 🎯 Next Steps After Setup

1. **Run the agent** to discover filings
2. **Review candidates** in `/filings` UI
3. **Approve filings** to trigger ingestion
4. **Monitor ingestion** in the `filing_ingestions` table
5. **Set up webhooks** (optional) for notifications

## 📚 More Help

- **Detailed watchlist setup**: [WATCHLIST_SETUP.md](./WATCHLIST_SETUP.md)
- **Full documentation**: [filing_agent.md](./filing_agent.md)
- **Troubleshooting**: See "Troubleshooting" section in [filing_agent.md](./filing_agent.md)

