# Vercel Deployment Checklist

## Environment Variables Required

Make sure these are set in Vercel (Settings → Environment Variables):

### Required for Equity Analyst Copilot:
- ✅ `AI_SERVICE_URL` - Your backend service URL (e.g., `https://your-backend.railway.app` or similar)
- ✅ `OPENAI_API_KEY` - Your OpenAI API key
- ✅ `SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_KEY` - Your Supabase service role key

### Optional (for model selection):
- `BASE_MODEL` - Default: `gpt-4o-mini`
- `FT_MODEL` - Your fine-tuned model ID (e.g., `ft:gpt-3.5-turbo-0125:org:custom:finsight-analyst:xxxxx`)
- `DISTILLED_MODEL` - Your distilled model ID

### Frontend (if using Supabase client-side):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

## Common Issues and Fixes

### 404 Error on `/api/equity-analyst/run`

**Fixed:** Added `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'` to route files.

**If still getting 404:**
1. ✅ Verify the route file exists: `app/api/equity-analyst/run/route.ts`
2. ✅ Check that the latest code is deployed (trigger a new deployment)
3. ✅ Verify `AI_SERVICE_URL` is set correctly in Vercel
4. ✅ Check Vercel build logs for any errors
5. ✅ Ensure the route file has both `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`

### "Not Found" Error

**Possible causes:**
1. **Backend service not accessible:**
   - Verify `AI_SERVICE_URL` points to your running backend
   - Check if backend service is running and accessible
   - Ensure CORS is configured on backend to allow Vercel domain

2. **Environment variable not set:**
   - Go to Vercel → Settings → Environment Variables
   - Ensure `AI_SERVICE_URL` is set for the correct environment (Production/Preview/Development)
   - Redeploy after adding variables

3. **Backend route doesn't exist:**
   - Verify backend has `/equity-analyst/run` endpoint
   - Check backend logs for errors

### Testing the Deployment

1. **Check route exists:**
   ```bash
   curl https://your-domain.vercel.app/api/equity-analyst/run \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"documentId":"test","modelKey":"baseline"}'
   ```

2. **Check environment variables:**
   - Vercel logs should show if `AI_SERVICE_URL` is accessible
   - Check backend logs to see if requests are arriving

3. **Verify backend connectivity:**
   - Ensure backend service is running
   - Check CORS settings allow Vercel domain
   - Verify backend has the `/equity-analyst/run` endpoint

## Deployment Steps

1. ✅ Push code to GitHub (main branch)
2. ✅ Vercel auto-deploys (or trigger manual deployment)
3. ✅ Set environment variables in Vercel dashboard
4. ✅ Verify deployment logs for errors
5. ✅ Test the endpoint after deployment

## Backend Requirements

Your backend (Python FastAPI) must:
- ✅ Have `/equity-analyst/run` endpoint
- ✅ Accept POST requests with `documentId` and `modelKey`
- ✅ Have CORS configured to allow Vercel domain
- ✅ Be accessible from the internet (not localhost)

## Next Steps After Fix

1. **Redeploy:** After adding runtime config, trigger a new deployment
2. **Test:** Try the "Run full analysis" button again
3. **Check logs:** If still failing, check Vercel function logs for detailed error

