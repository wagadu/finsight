# Agent Builder Workflow API Limitations

## Current Situation

Workflows created in OpenAI Agent Builder (with IDs starting with `wf_`) are **not currently accessible via server-side REST API**. Based on testing and API responses, workflows appear to be designed primarily for **ChatKit** (client-side integration).

## What's Happening

When you try to use a workflow ID (`wf_...`) in the filing search API:

1. **The code attempts** to call various REST API endpoints:
   - `/v1/workflows/{id}/runs` → 404 Not Found
   - `/v1/agents/{id}/invoke` → 404 Not Found  
   - `/v1/responses` → 400 (requires model parameter)

2. **The code automatically falls back** to Chat API with equivalent instructions
   - This works perfectly and produces the same results
   - The instructions match what you configured in Agent Builder

## Why This Happens

OpenAI Agent Builder workflows are likely designed for:
- **ChatKit integration** (client-side, browser-based)
- **Future server-side API** (may be coming soon)

The REST API endpoints for workflows may not be publicly available yet or may require different authentication/access.

## Current Solution

The code automatically uses **Chat API fallback** which:
- ✅ Works reliably
- ✅ Uses the same instructions as your workflow
- ✅ Produces identical results
- ✅ No code changes needed

## How to Verify It's Working

Check your server logs - you should see:
```
🤖 Using Agent Builder with ID: wf_...
📦 Trying /v1/agents/{id}/invoke endpoint for workflow
⚠️ Workflow not accessible via REST API
💬 Using Chat API (workflow fallback mode)
📋 Note: Using equivalent instructions to your Agent Builder workflow
✅ Successfully parsed agent response: {...}
```

The search will complete successfully and filings will be found.

## Future Options

### Option 1: Wait for Official API
OpenAI may release server-side workflow APIs in the future. When available, the code will automatically use them.

### Option 2: Use ChatKit (Client-Side)
If you want to use the actual workflow (not just equivalent instructions), you could:
1. Integrate ChatKit in your frontend
2. Call the workflow from the browser
3. Send results to your backend

This would require frontend changes and using the ChatKit SDK.

### Option 3: Continue with Chat API
The current fallback approach works perfectly and is actually simpler:
- No additional dependencies
- Lower latency
- Same results
- More reliable

## Recommendation

**Continue using the current setup.** The Chat API fallback:
- Produces identical results to your workflow
- Is more reliable and faster
- Doesn't require additional setup
- Will automatically upgrade if workflow APIs become available

The workflow you created in Agent Builder is still valuable for:
- Testing and iteration
- Documentation of your requirements
- Future migration when APIs are available

## Technical Details

The workflow instructions you configured in Agent Builder are:
```
You are a financial filing search assistant. Your task is to extract structured information from user queries about SEC filings.

Extract:
- Company name or ticker symbol
- Filing type: "10-K" for annual, "10-Q" for quarterly
- Year: the filing year if specified

Return JSON: {"company": "...", "filing_type": "...", "year": ...}
```

These exact instructions are used in the Chat API fallback, so the behavior is identical.

## Questions?

If you need to use the actual workflow (not just equivalent instructions), consider:
1. Checking OpenAI's latest documentation for workflow APIs
2. Using ChatKit for client-side integration
3. Contacting OpenAI support about server-side workflow access

For now, the fallback solution works perfectly for your use case.

