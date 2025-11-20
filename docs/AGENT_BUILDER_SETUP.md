# OpenAI Agent Builder - Step-by-Step Setup Guide

This guide will walk you through setting up an OpenAI Agent in Agent Builder and integrating it with the filing search feature.

## Prerequisites

- OpenAI account with API access
- Agent Builder access (check https://platform.openai.com/agent-builder)
- Your project's OpenAI API key

## Step 1: Access Agent Builder

1. Go to https://platform.openai.com/agent-builder
2. Log in with your OpenAI account
3. You should see the Agent Builder interface with options to create workflows

## Step 2: Create a New Agent

1. Click the **"Create"** button (large button with plus icon)
2. You'll be taken to the agent configuration page

## Step 3: Configure Agent Instructions

1. In the **"Instructions"** field, paste the following:

```
You are a financial filing search assistant. Your task is to extract structured information from user queries about SEC filings.

Extract the following information from user queries:
- Company name or ticker symbol (e.g., "Apple", "AAPL", "Microsoft", "MSFT", "Tesla", "TSLA")
- Filing type: "10-K" for annual reports, "10-Q" for quarterly reports, or other SEC form types
- Year: the filing year if specified, or null if not specified

You must return a JSON object with exactly these fields: company, filing_type, year

Examples:
- "Find Apple's 2023 10-K annual report" → {"company": "Apple", "filing_type": "10-K", "year": 2023}
- "Search Microsoft quarterly 2024" → {"company": "Microsoft", "filing_type": "10-Q", "year": 2024}
- "Get Tesla latest annual report" → {"company": "Tesla", "filing_type": "10-K", "year": null}
- "Find GOOGL 10-K 2022" → {"company": "GOOGL", "filing_type": "10-K", "year": 2022}
- "AAPL quarterly report" → {"company": "AAPL", "filing_type": "10-Q", "year": null}

Important:
- Always return valid JSON
- Use null for year if not specified
- Default to "10-K" for filing_type if not specified
- Extract company name or ticker accurately
```

2. Click **"Save"** or the checkmark to save the instructions

## Step 4: Configure Agent Settings (Optional)

1. **Model Selection**: Choose a model (gpt-4o or gpt-4o-mini recommended)
2. **Temperature**: Set to 0.1 for more deterministic responses
3. **Response Format**: Ensure JSON mode is enabled if available

## Step 5: Test Your Agent

1. In the Agent Builder interface, find the **"Test"** or **"Playground"** section
2. Try these test queries:
   - "Find Apple's 2023 10-K annual report"
   - "Search Microsoft quarterly 2024"
   - "Get Tesla latest annual report"
3. Verify the agent returns proper JSON with `company`, `filing_type`, and `year` fields

## Step 6: Get Your Agent ID

1. After creating and testing your agent, look for the **Agent ID**
2. It will look like: `agent_abc123xyz...`
3. Copy this ID - you'll need it for the next step

**Where to find it:**
- In the agent settings/details page
- In the URL when viewing the agent
- In the API section of the agent builder

## Step 7: Add Agent ID to Environment Variables

1. Open your `.env.local` file in the project root
2. Add the following line:

```bash
OPENAI_AGENT_ID=agent_abc123xyz...
```

Replace `agent_abc123xyz...` with your actual Agent ID.

3. Save the file
4. **Restart your Next.js development server** for the changes to take effect

## Step 8: Update the API Route to Use Agent SDK

✅ **GOOD NEWS: Step 8 is already implemented!** 

The code in `app/api/filings/search/route.ts` has already been updated to support Agent Builder. It will automatically:
- Check if `OPENAI_AGENT_ID` is set in your environment variables
- Use the Agent SDK if the ID is found
- Fall back to Chat API if the agent is not configured or fails

**You don't need to make any code changes** - just ensure you've completed Steps 1-7 (especially adding `OPENAI_AGENT_ID` to `.env.local` and restarting your server).

### How It Works

The current implementation:
1. Checks for `OPENAI_AGENT_ID` environment variable
2. If found, uses `openai.beta.agents.createRun()` to call your agent
3. Waits for the agent to complete (polls every second, max 30 seconds)
4. Extracts and parses the JSON response from the agent
5. Falls back to Chat API if agent fails or is not configured

### Verification

To verify the agent is being used, check your server logs when making a search. You should see:
```
Using Agent SDK with agent ID: agent_abc123...
```

If you see this message, the agent is being used! If not, check that:
- `OPENAI_AGENT_ID` is set in `.env.local`
- You've restarted your development server
- The Agent ID is correct (no typos)

## Step 9: Verify the Integration

1. Start your development server: `pnpm dev`
2. Navigate to `/filings`
3. Try a search query in the chat interface
4. Check the browser console and server logs for any errors
5. Verify that filings are being found and added correctly

## Troubleshooting

### "Agent ID not configured"
- Make sure `OPENAI_AGENT_ID` is set in `.env.local`
- Restart your development server after adding the variable

### "Agent run failed"
- Check that your agent is properly configured in Agent Builder
- Verify the agent instructions are correct
- Test the agent directly in Agent Builder first

### "Invalid agent ID"
- Double-check the Agent ID is correct
- Make sure there are no extra spaces or quotes in `.env.local`

### Agent returns wrong format
- Review the agent instructions in Agent Builder
- Test with sample queries in the Agent Builder playground
- Adjust instructions if needed

## Advanced: Adding Tools/Actions (Optional)

If you want the agent to directly call SEC APIs, you can add tools:

1. In Agent Builder, go to the **"Actions"** or **"Tools"** section
2. Click **"Add Action"** or **"Import OpenAPI Schema"**
3. For SEC EDGAR API, you would need to:
   - Create an OpenAPI schema for SEC endpoints
   - Configure authentication (SEC requires User-Agent header)
   - Map actions to API endpoints

However, for this use case, it's simpler to let the agent just extract information and have your backend code handle the SEC API calls.

## Comparison: Chat API vs Agent Builder

### Chat API (Current)
- ✅ Simpler setup
- ✅ Lower latency
- ✅ Direct JSON structured output
- ✅ No additional configuration

### Agent Builder
- ✅ More advanced capabilities
- ✅ Tool/action integration
- ✅ Better for complex workflows
- ✅ Built-in guardrails
- ✅ Better monitoring/observability
- ⚠️ Requires additional setup
- ⚠️ Slightly higher latency

## Next Steps

After setting up the agent:

1. Test thoroughly with various query formats
2. Monitor agent performance in Agent Builder dashboard
3. Adjust instructions based on real-world usage
4. Consider adding guardrails for edge cases

## Need Help?

- OpenAI Agent Builder Docs: https://platform.openai.com/docs/guides/agents
- OpenAI API Reference: https://platform.openai.com/docs/api-reference
- Check server logs for detailed error messages

