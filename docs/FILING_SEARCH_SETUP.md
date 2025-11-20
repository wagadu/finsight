# Filing Search Chat Integration Setup

This document describes how to set up the filing search chat feature that allows users to search for SEC filings using natural language queries.

## Architecture Overview

The filing search feature consists of:

1. **Frontend Chat Interface** (`components/filing-search-chat.tsx`)
   - Chat window where users can input natural language queries
   - Displays search results and filing candidate information

2. **API Route** (`app/api/filings/search/route.ts`)
   - Processes user queries using OpenAI Chat API
   - Extracts company name, filing type, and year from queries
   - Searches SEC EDGAR database for matching filings
   - Creates filing candidates in Supabase database

3. **Integration with Filings Page** (`app/filings/page.tsx`)
   - Chat interface integrated at the top of the filings page
   - Automatically refreshes candidate list when new filings are found

## Setup Instructions

### 1. Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini

# SEC API User Agent (required by SEC)
SEC_USER_AGENT=FinSight Filing Search (your-email@example.com)

# Supabase (should already be configured)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Install Dependencies

The OpenAI SDK is already installed. If you need to reinstall:

```bash
pnpm add openai
```

### 3. Database Schema

Ensure your Supabase database has the `filing_candidates` table. The schema should already be set up from the filing agent setup. Key fields:

- `ticker` - Company ticker symbol
- `cik` - SEC Central Index Key
- `company_name` - Full company name
- `filing_type` - SEC form type (10-K, 10-Q, etc.)
- `filing_year` - Year of the filing
- `source` - Source of filing (typically 'sec')
- `source_url` - URL to the filing on SEC website
- `status` - Candidate status (pending, auto_approved, etc.)

### 4. Testing the Feature

1. Navigate to `/filings` page
2. Use the chat interface at the top
3. Try queries like:
   - "Find Apple's 2023 10-K annual report"
   - "Search Microsoft quarterly 2024"
   - "Get Tesla latest annual report"
   - "Find GOOGL 10-K 2022"

## How It Works

### Query Processing Flow

1. **User Input**: User types a natural language query in the chat interface
2. **OpenAI Parsing**: Query is sent to OpenAI Chat API with structured output format
3. **Information Extraction**: OpenAI extracts:
   - Company name or ticker
   - Filing type (10-K, 10-Q, etc.)
   - Year (if specified)
4. **Company Resolution**: System resolves company name/ticker to CIK (Central Index Key)
5. **SEC Search**: System searches SEC EDGAR database for matching filing
6. **Candidate Creation**: If found, creates a new entry in `filing_candidates` table
7. **UI Update**: Chat interface displays result and candidate list refreshes

### SEC API Integration

The system uses the SEC EDGAR API to search for filings:

- **Company Tickers API**: `https://www.sec.gov/files/company_tickers.json`
  - Used to resolve company names/tickers to CIK
- **Submissions API**: `https://data.sec.gov/submissions/CIK{formatted_cik}.json`
  - Used to fetch all filings for a company
  - Searches for matching filing type and year

**Important**: SEC requires a proper User-Agent header. Make sure to set `SEC_USER_AGENT` environment variable with your contact email.

## Optional: Using OpenAI Agent Builder

While the current implementation uses the OpenAI Chat API directly, you can optionally configure an OpenAI Agent in Agent Builder for more advanced processing. Here's how:

### Setting Up an Agent in OpenAI Agent Builder

1. **Navigate to Agent Builder**
   - Go to https://platform.openai.com/agent-builder
   - Click "Create" to create a new agent

2. **Configure Agent Instructions**
   ```
   You are a financial filing search assistant. Extract information from user queries about SEC filings.

   Extract:
   - Company name or ticker symbol (e.g., "Apple", "AAPL", "Microsoft", "MSFT")
   - Filing type: "10-K" for annual reports, "10-Q" for quarterly reports, or other SEC form types
   - Year: the filing year if specified, or null if not specified

   Return a JSON object with: company, filing_type, year

   Examples:
   - "Find Apple's 2023 10-K annual report" -> {"company": "Apple", "filing_type": "10-K", "year": 2023}
   - "Search Microsoft quarterly 2024" -> {"company": "Microsoft", "filing_type": "10-Q", "year": 2024}
   - "Get Tesla latest annual report" -> {"company": "Tesla", "filing_type": "10-K", "year": null}
   ```

3. **Configure Actions (Optional)**
   - You can add actions to directly call SEC API endpoints
   - Import OpenAPI schema for SEC EDGAR API
   - Configure authentication if needed

4. **Test the Agent**
   - Use the test panel in Agent Builder
   - Try sample queries to ensure proper extraction

5. **Get Agent ID**
   - After creating the agent, copy the Agent ID
   - Add to environment variables: `OPENAI_AGENT_ID=agent_...`

6. **Update API Route (If Using Agent)**
   - Modify `app/api/filings/search/route.ts`
   - Replace Chat API calls with Agent SDK calls:
   ```typescript
   const agentResponse = await openai.beta.agents.createRun({
     agent_id: process.env.OPENAI_AGENT_ID!,
     instructions: "...",
     additional_messages: [{ role: 'user', content: query }],
   })
   ```

### Benefits of Using Agent Builder

- **More Control**: Fine-tune agent behavior with specific instructions
- **Tool Integration**: Can add tools/actions for direct API calls
- **Guardrails**: Built-in content moderation and safety features
- **Monitoring**: Better visibility into agent performance

### Current Implementation vs Agent Builder

**Current (Chat API)**:
- ✅ Simpler setup
- ✅ Lower latency
- ✅ Direct JSON structured output
- ✅ No additional configuration needed

**Agent Builder**:
- ✅ More advanced capabilities
- ✅ Tool/action integration
- ✅ Better for complex workflows
- ⚠️ Requires additional setup
- ⚠️ Slightly higher latency

## Troubleshooting

### "OpenAI API key not configured"
- Ensure `OPENAI_API_KEY` is set in `.env.local`
- Restart your development server after adding environment variables

### "Could not find company"
- Check that the company name or ticker is correct
- Ensure the company is a US-listed public company
- Try using the ticker symbol instead of company name

### "Could not find filing"
- Verify the filing type and year are correct
- Some companies may not have filings for certain years
- Check SEC EDGAR directly to confirm filing exists

### SEC API Rate Limits
- SEC allows 10 requests per second
- The system includes rate limiting delays
- If you encounter rate limit errors, increase delays in the code

### Database Errors
- Ensure `filing_candidates` table exists
- Check Supabase connection credentials
- Verify RLS (Row Level Security) policies allow inserts

## Future Enhancements

Potential improvements to consider:

1. **Caching**: Cache company lookups and filing searches
2. **Fuzzy Matching**: Better handling of typos in company names
3. **Multiple Results**: Show multiple matching filings when year is not specified
4. **Auto-approval**: Option to auto-approve certain types of filings
5. **Batch Search**: Allow searching for multiple companies at once
6. **Historical Data**: Search across multiple years at once

## Related Documentation

- [Filing Agent Setup](./filing_agent.md)
- [Quick Start Filing Agent](./QUICK_START_FILING_AGENT.md)
- [Troubleshooting Ingestion](./TROUBLESHOOTING_INGESTION.md)

