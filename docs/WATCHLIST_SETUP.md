# How to Add Companies to the Filing Watchlist

## Step-by-Step Guide

### Option 1: Using Supabase Dashboard (Easiest)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Table Editor**
   - Click on "Table Editor" in the left sidebar
   - Find and click on the `filing_watchlist` table

3. **Add a New Row**
   - Click the "+ Insert row" button (or "Insert" → "Insert row")
   - Fill in the fields:
     - **ticker**: Stock ticker symbol (e.g., `AAPL`, `MSFT`, `GOOGL`)
     - **cik**: SEC Central Index Key (10 digits, zero-padded) - **Required for SEC source**
     - **company_name**: Full company name (e.g., `Apple Inc.`)
     - **source**: Choose `sec` or `annualreports`
     - **priority**: Number (0-10, higher = more important, default: 0)
     - **is_active**: Check this box (true) to enable monitoring
   - Click "Save" or press Enter

4. **Example Entry for SEC (Apple Inc.)**
   ```
   ticker: AAPL
   cik: 0000320193
   company_name: Apple Inc.
   source: sec
   priority: 10
   is_active: true
   ```

5. **Example Entry for AnnualReports.com (Tesla)**
   ```
   ticker: TSLA
   cik: (leave empty or null)
   company_name: Tesla Inc.
   source: annualreports
   priority: 5
   is_active: true
   ```

### Option 2: Using SQL Editor (Faster for Multiple Companies)

1. **Open SQL Editor**
   - In Supabase Dashboard, click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Copy and Paste This SQL Template**

```sql
-- Add companies to watchlist
INSERT INTO filing_watchlist (ticker, cik, company_name, source, priority, is_active)
VALUES
  -- SEC EDGAR companies (require CIK)
  ('AAPL', '0000320193', 'Apple Inc.', 'sec', 10, true),
  ('MSFT', '0000789019', 'Microsoft Corporation', 'sec', 10, true),
  ('GOOGL', '0001652044', 'Alphabet Inc.', 'sec', 10, true),
  ('AMZN', '0001018724', 'Amazon.com Inc.', 'sec', 10, true),
  ('META', '0001326801', 'Meta Platforms Inc.', 'sec', 10, true),
  ('TSLA', '0001318605', 'Tesla Inc.', 'sec', 8, true),
  ('NVDA', '0001045810', 'NVIDIA Corporation', 'sec', 8, true),
  
  -- AnnualReports.com companies (no CIK required)
  ('BRK.A', NULL, 'Berkshire Hathaway Inc.', 'annualreports', 5, true),
  ('JPM', NULL, 'JPMorgan Chase & Co.', 'annualreports', 5, true);
```

3. **Click "Run"** (or press Cmd/Ctrl + Enter)

4. **Verify the Insertion**
   - Go to Table Editor → `filing_watchlist`
   - You should see your new companies listed

### Finding SEC CIK Numbers

If you need to find a company's CIK:

1. **SEC EDGAR Company Search**
   - Go to https://www.sec.gov/edgar/searchedgar/companysearch.html
   - Search for the company name
   - The CIK will be shown (format it as 10 digits with leading zeros)

2. **Example: Finding Apple's CIK**
   - Search "Apple Inc"
   - You'll see CIK: 320193
   - Format as: `0000320193` (10 digits, zero-padded)

### Important Notes

- **CIK Format**: Must be exactly 10 digits with leading zeros
  - ✅ Correct: `0000320193`
  - ❌ Wrong: `320193` or `3201930`

- **Source Types**:
  - `sec`: Uses SEC EDGAR API (requires CIK, more reliable)
  - `annualreports`: Uses web scraping (no CIK needed, less reliable)

- **Priority Levels**:
  - `10`: Highest priority (checked first, webhook notifications)
  - `5-9`: Medium priority
  - `0-4`: Low priority

- **Active Status**:
  - Only companies with `is_active = true` will be monitored
  - Set to `false` to temporarily disable monitoring without deleting

### Updating Existing Companies

To update a company's information:

```sql
-- Update priority
UPDATE filing_watchlist 
SET priority = 10 
WHERE ticker = 'AAPL';

-- Deactivate a company
UPDATE filing_watchlist 
SET is_active = false 
WHERE ticker = 'TSLA';

-- Change source
UPDATE filing_watchlist 
SET source = 'sec', cik = '0001318605' 
WHERE ticker = 'TSLA';
```

### Deleting Companies

```sql
-- Delete a company from watchlist
DELETE FROM filing_watchlist WHERE ticker = 'TICKER';
```

### Viewing Your Watchlist

```sql
-- View all active companies
SELECT * FROM filing_watchlist WHERE is_active = true ORDER BY priority DESC;

-- View companies by source
SELECT * FROM filing_watchlist WHERE source = 'sec' AND is_active = true;
```

