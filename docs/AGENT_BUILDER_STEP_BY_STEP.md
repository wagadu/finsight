# OpenAI Agent Builder - Complete Step-by-Step Guide

This is a detailed, step-by-step guide to set up OpenAI Agent Builder for your filing search feature.

## ✅ What You'll Accomplish

By the end of this guide, you'll have:
- Created an OpenAI Agent in Agent Builder
- Configured it to extract filing information from natural language
- Integrated it with your filing search API
- Tested the complete flow

---

## 📋 Prerequisites Checklist

Before starting, make sure you have:
- [ ] OpenAI account (sign up at https://openai.com if needed)
- [ ] Access to OpenAI Platform (https://platform.openai.com)
- [ ] Your OpenAI API key (from https://platform.openai.com/api-keys)
- [ ] Your project's `.env.local` file accessible

---

## 🚀 Step-by-Step Instructions

### Step 1: Navigate to Agent Builder

1. **Open your browser** and go to: **https://platform.openai.com/agent-builder**
2. **Log in** with your OpenAI account credentials
3. You should see the Agent Builder dashboard

**What you'll see:**
- A list of existing agents/workflows (if any)
- A "Create" button or "Create a workflow" section

---

### Step 2: Create a New Agent

1. **Click the "Create" button** (usually a large button with a plus icon or "Create a workflow")
2. You'll be taken to the agent creation/configuration page

**What you'll see:**
- A form or interface to configure your agent
- Fields for: Name, Instructions, Model, etc.

---

### Step 3: Name Your Agent

1. **Enter a name** for your agent, for example:
   - "Filing Search Agent"
   - "SEC Filing Extractor"
   - "Financial Filing Parser"

---

### Step 4: Configure Agent Instructions

This is the **most important step**. The instructions tell the agent what to do.

1. **Find the "Instructions" field** (usually a large text area)
2. **Copy and paste** the following instructions:

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

3. **Click "Save"** or the checkmark icon to save

---

### Step 5: Configure Model Settings (Optional but Recommended)

1. **Find the "Model" dropdown** or settings section
2. **Select a model:**
   - Recommended: `gpt-4o` or `gpt-4o-mini` (faster and cheaper)
3. **Set Temperature** (if available):
   - Set to `0.1` for more deterministic, consistent responses
4. **Enable JSON mode** (if available):
   - This ensures the agent returns valid JSON

---

### Step 6: Test Your Agent

**Before saving, test your agent to make sure it works correctly.**

1. **Find the "Test" or "Playground" section** in Agent Builder
2. **Try these test queries one by one:**

   **Test 1:**
   ```
   Find Apple's 2023 10-K annual report
   ```
   **Expected output:**
   ```json
   {"company": "Apple", "filing_type": "10-K", "year": 2023}
   ```

   **Test 2:**
   ```
   Search Microsoft quarterly 2024
   ```
   **Expected output:**
   ```json
   {"company": "Microsoft", "filing_type": "10-Q", "year": 2024}
   ```

   **Test 3:**
   ```
   Get Tesla latest annual report
   ```
   **Expected output:**
   ```json
   {"company": "Tesla", "filing_type": "10-K", "year": null}
   ```

3. **Verify the output:**
   - Check that it returns valid JSON
   - Verify all three fields (`company`, `filing_type`, `year`) are present
   - If the output doesn't match, adjust the instructions and test again

---

### Step 7: Save Your Agent

1. **Click "Save" or "Create"** to finalize your agent
2. **Wait for confirmation** that the agent was created

---

### Step 8: Get Your Agent ID

**This is critical - you'll need this ID to connect your code to the agent.**

1. **After saving**, look for the **Agent ID**
2. **It will look like:** `agent_abc123xyz...` or `agent-abc123xyz...`

**Where to find it:**
- **Option A:** In the agent details/settings page
- **Option B:** In the URL when viewing the agent (look for `agent_` in the URL)
- **Option C:** In the API section or "Use this agent" section
- **Option D:** Click on your agent name to view details

3. **Copy the entire Agent ID** (including the `agent_` prefix)

**Example Agent ID format:**
```
agent_abc123def456ghi789
```

---

### Step 9: Add Agent ID to Your Project

1. **Open your project** in your code editor
2. **Navigate to the root directory** (where `package.json` is)
3. **Open or create** the `.env.local` file
4. **Add this line** (replace with your actual Agent ID):

```bash
OPENAI_AGENT_ID=agent_abc123xyz...
```

**Important:**
- No spaces around the `=`
- No quotes around the value
- Replace `agent_abc123xyz...` with your actual Agent ID

**Example `.env.local` file:**
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
SEC_USER_AGENT=FinSight Filing Search (your-email@example.com)
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_AGENT_ID=agent_abc123def456ghi789
```

5. **Save the file**

---

### Step 10: Restart Your Development Server

**This is important - environment variables are only loaded when the server starts.**

1. **Stop your development server** (press `Ctrl+C` in the terminal)
2. **Start it again:**
   ```bash
   pnpm dev
   ```
3. **Wait for it to fully start** (you'll see "Ready" message)

---

### Step 11: Test the Integration

1. **Open your browser** and go to: `http://localhost:3000/filings`
2. **In the chat interface**, try a search query:
   ```
   Find Apple's 2023 10-K annual report
   ```
3. **Check the browser console** (F12 → Console tab) for any errors
4. **Check your terminal** where the dev server is running - you should see:
   ```
   Using Agent SDK with agent ID: agent_abc123...
   ```
5. **Verify the result:**
   - The filing should be found and added to the candidates list
   - You should see a success message

---

## 🔍 Verification Checklist

After completing all steps, verify:

- [ ] Agent created in Agent Builder
- [ ] Agent returns correct JSON format when tested in Agent Builder
- [ ] Agent ID copied correctly
- [ ] `OPENAI_AGENT_ID` added to `.env.local`
- [ ] Development server restarted
- [ ] Test query works in the application
- [ ] Server logs show "Using Agent SDK with agent ID: ..."
- [ ] Filing is found and added to candidates

---

## 🐛 Troubleshooting

### Problem: "Agent ID not configured"
**Solution:**
- Check that `OPENAI_AGENT_ID` is in `.env.local`
- Make sure you restarted the server after adding it
- Check for typos in the Agent ID

### Problem: "Agent run failed"
**Solution:**
- Test the agent directly in Agent Builder first
- Check that the agent instructions are correct
- Verify the Agent ID is correct

### Problem: "Agent returned invalid format"
**Solution:**
- Go back to Agent Builder
- Test the agent with sample queries
- Adjust the instructions to be more explicit about JSON format
- Make sure the examples in instructions show the exact format needed

### Problem: Agent works in Builder but not in code
**Solution:**
- Check server logs for detailed error messages
- Verify the Agent ID is correct (no extra spaces)
- Make sure you're using the latest OpenAI SDK version
- Check that your OpenAI API key has access to Agent Builder features

### Problem: Can't find Agent ID
**Solution:**
- Look in the agent's settings/details page
- Check the URL when viewing the agent
- Look for "API" or "Use this agent" section
- Try creating a new agent if you can't find the ID

---

## 📝 Code Changes Summary

The code has already been updated to support Agent Builder! Here's what happens:

1. **If `OPENAI_AGENT_ID` is set:** Uses Agent SDK
2. **If not set or agent fails:** Falls back to Chat API (current behavior)

**No code changes needed** - just add the environment variable!

---

## 🎯 Next Steps

Once everything is working:

1. **Monitor performance** in Agent Builder dashboard
2. **Refine instructions** based on real-world queries
3. **Add guardrails** if needed (in Agent Builder settings)
4. **Consider adding tools/actions** for advanced features (optional)

---

## 📚 Additional Resources

- **OpenAI Agent Builder Docs:** https://platform.openai.com/docs/guides/agents
- **OpenAI API Reference:** https://platform.openai.com/docs/api-reference
- **Agent Builder Tutorial:** https://platform.openai.com/docs/guides/agents/getting-started

---

## 💡 Tips

1. **Start simple:** Get the basic extraction working first, then refine
2. **Test thoroughly:** Try various query formats in Agent Builder before deploying
3. **Monitor logs:** Check server logs to see which method is being used (Agent SDK vs Chat API)
4. **Keep Chat API as fallback:** The code automatically falls back if Agent SDK fails

---

## ✅ Success Criteria

You'll know it's working when:
- ✅ Server logs show "Using Agent SDK with agent ID: ..."
- ✅ Queries successfully extract company, filing_type, and year
- ✅ Filings are found and added to candidates
- ✅ No errors in browser console or server logs

---

**Need help?** Check the troubleshooting section above or review the server logs for detailed error messages.

