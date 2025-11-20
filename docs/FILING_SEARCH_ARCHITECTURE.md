# Filing Search Chat - Architecture & Integration Guide

## Overview

This document provides a comprehensive overview of the filing search chat feature architecture and step-by-step integration guide.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /filings Page                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  FilingSearchChat Component                    │  │  │
│  │  │  - Chat input interface                        │  │  │
│  │  │  - Message display                             │  │  │
│  │  │  - Candidate preview                           │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Filing Candidates Table                       │  │  │
│  │  │  - Lists all candidates                        │  │  │
│  │  │  - Auto-refreshes on new additions            │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ POST /api/filings/search
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  app/api/filings/search/route.ts                    │  │
│  │                                                       │  │
│  │  1. Receive user query                               │  │
│  │  2. Call OpenAI Chat API (structured output)         │  │
│  │  3. Extract: company, filing_type, year             │  │
│  │  4. Resolve company → CIK                            │  │
│  │  5. Search SEC EDGAR API                             │  │
│  │  6. Create filing_candidate in Supabase              │  │
│  │  7. Return result to frontend                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────────┐            ┌──────────────────────┐
│   OpenAI API         │            │   SEC EDGAR API      │
│   - Chat Completions │            │   - Company Tickers  │
│   - Structured Output│            │   - Submissions      │
└──────────────────────┘            └──────────────────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │   Supabase Database  │
                │   - filing_candidates│
                │   - filing_watchlist  │
                └──────────────────────┘
```

## Component Breakdown

### 1. Frontend Components

#### `FilingSearchChat` Component
**Location**: `components/filing-search-chat.tsx`

**Responsibilities**:
- Render chat interface UI
- Handle user input
- Display conversation history
- Show filing candidate previews
- Trigger parent refresh callback

**Props**:
- `onCandidateAdded?: () => void` - Callback when new candidate is added

**State**:
- `messages: Message[]` - Chat message history
- `isLoading: boolean` - Loading state

#### Integration in Filings Page
**Location**: `app/filings/page.tsx`

The chat component is integrated at the top of the filings page, above the filters section. It automatically refreshes the candidate list when a new filing is found.

### 2. API Route

#### `/api/filings/search`
**Location**: `app/api/filings/search/route.ts`

**Request**:
```typescript
{
  query: string  // Natural language query
}
```

**Response**:
```typescript
{
  message: string
  candidate?: {
    id: string
    ticker: string
    company_name: string
    filing_type: string
    filing_year: number
    status: string
  }
  error?: string
}
```

**Processing Flow**:
1. Validate request
2. Call OpenAI Chat API with structured output
3. Parse extracted data (company, filing_type, year)
4. Resolve company name/ticker to CIK
5. Search SEC EDGAR for matching filing
6. Check for existing candidate (deduplication)
7. Create new candidate in database
8. Return result

### 3. Helper Functions

#### `resolveCompanyToCIK(companyIdentifier: string)`
- First checks Supabase `filing_watchlist` table
- Falls back to SEC company tickers API
- Returns: `{ ticker, cik, company_name }`

#### `searchSECFiling(ticker, cik, filingType, filingYear)`
- Fetches company submissions from SEC API
- Searches for matching form type and year
- Constructs proper SEC URL
- Returns: `{ source_url, accession_number, filing_date }`

## Data Flow

### Example: User searches for "Find Apple's 2023 10-K"

1. **User Input**: "Find Apple's 2023 10-K annual report"
2. **Frontend**: Sends POST to `/api/filings/search` with query
3. **OpenAI Processing**:
   ```
   Input: "Find Apple's 2023 10-K annual report"
   Output: {
     "company": "Apple",
     "filing_type": "10-K",
     "year": 2023
   }
   ```
4. **Company Resolution**:
   - Search watchlist → Not found
   - Search SEC tickers API → Found: AAPL, CIK: 0000320193
5. **SEC Filing Search**:
   - Fetch submissions for CIK 0000320193
   - Find 10-K filing from 2023
   - Extract accession number and filing date
6. **Database Insert**:
   ```sql
   INSERT INTO filing_candidates (
     ticker, cik, company_name, filing_type, filing_year,
     source_url, accession_number, status, ...
   ) VALUES (
     'AAPL', '0000320193', 'Apple Inc.', '10-K', 2023,
     'https://www.sec.gov/...', '0000320193-23-000077', 'pending', ...
   )
   ```
7. **Response**: Return candidate info to frontend
8. **UI Update**: Chat shows success message, table refreshes

## Integration Steps

### Step 1: Install Dependencies
```bash
pnpm add openai
```

### Step 2: Environment Variables
Add to `.env.local`:
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # Optional
SEC_USER_AGENT=FinSight Filing Search (your-email@example.com)
```

### Step 3: Verify Database Schema
Ensure `filing_candidates` table exists with required fields.

### Step 4: Test the Integration
1. Start development server: `pnpm dev`
2. Navigate to `/filings`
3. Try sample queries in the chat interface

## OpenAI Agent Builder Setup (Optional)

While the current implementation uses OpenAI Chat API directly, you can optionally use Agent Builder for more advanced capabilities.

### Why Use Agent Builder?

1. **Tool Integration**: Add actions/tools for direct API calls
2. **Guardrails**: Built-in content moderation
3. **Monitoring**: Better observability
4. **Complex Workflows**: Handle multi-step processes

### Setup Steps

1. **Create Agent in Agent Builder**
   - Go to https://platform.openai.com/agent-builder
   - Click "Create"
   - Name: "Filing Search Agent"

2. **Configure Instructions**
   ```
   You are a financial filing search assistant. Extract information from user queries about SEC filings.

   Extract:
   - Company name or ticker symbol
   - Filing type: "10-K" for annual, "10-Q" for quarterly
   - Year: the filing year if specified

   Return JSON: {"company": "...", "filing_type": "...", "year": ...}
   ```

3. **Add Actions (Optional)**
   - Import OpenAPI schema for SEC EDGAR API
   - Configure authentication
   - Map actions to API endpoints

4. **Get Agent ID**
   - Copy the Agent ID from Agent Builder
   - Add to `.env.local`: `OPENAI_AGENT_ID=agent_...`

5. **Update API Route**
   - Modify `app/api/filings/search/route.ts`
   - Replace Chat API calls with Agent SDK calls
   - See documentation in `FILING_SEARCH_SETUP.md`

### Agent SDK Integration Example

```typescript
// Using Agent SDK instead of Chat API
const agentResponse = await openai.beta.agents.createRun({
  agent_id: process.env.OPENAI_AGENT_ID!,
  instructions: "Extract company, filing_type, and year from query",
  additional_messages: [
    { role: 'user', content: query }
  ],
})

// Wait for completion
let run = agentResponse
while (run.status !== 'completed' && run.status !== 'failed') {
  await new Promise(resolve => setTimeout(resolve, 1000))
  run = await openai.beta.agents.retrieveRun(agentId, run.id)
}

// Extract response
const parsedData = JSON.parse(run.messages[run.messages.length - 1].content)
```

## Error Handling

### Common Errors and Solutions

1. **"OpenAI API key not configured"**
   - Solution: Add `OPENAI_API_KEY` to `.env.local`

2. **"Could not find company"**
   - Solution: Verify company name/ticker is correct
   - Try using ticker symbol instead of company name

3. **"Could not find filing"**
   - Solution: Verify filing type and year exist
   - Check SEC EDGAR directly

4. **SEC API Rate Limits**
   - Solution: System includes delays, but may need adjustment
   - SEC allows 10 requests/second

5. **Database Errors**
   - Solution: Check Supabase credentials
   - Verify table schema matches expected structure

## Performance Considerations

1. **Caching**: Consider caching company lookups
2. **Rate Limiting**: SEC API has rate limits (10 req/sec)
3. **Async Processing**: Large searches could be moved to background jobs
4. **Deduplication**: System checks for existing candidates before inserting

## Security Considerations

1. **API Keys**: Store in environment variables, never commit
2. **User Input**: Sanitize queries before processing
3. **Rate Limiting**: Implement rate limiting on API route
4. **Validation**: Validate all inputs before database operations

## Future Enhancements

1. **Batch Search**: Search multiple companies at once
2. **Fuzzy Matching**: Better handling of typos
3. **Auto-approval**: Auto-approve certain filing types
4. **Caching**: Cache company and filing lookups
5. **Webhooks**: Notify when filings are found
6. **Analytics**: Track search patterns and success rates

## Related Documentation

- [Filing Search Setup Guide](./FILING_SEARCH_SETUP.md)
- [Filing Agent Documentation](./filing_agent.md)
- [Quick Start Guide](./QUICK_START_FILING_AGENT.md)

