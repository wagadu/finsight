# Quick Deployment Fix

## The Problem
Your Vercel frontend is trying to connect to `localhost:8001`, which doesn't exist in production.

## The Solution
You need to:
1. **Deploy your Python backend** to a hosting service
2. **Set the `AI_SERVICE_URL` environment variable** in Vercel

## Fastest Option: Railway (5 minutes)

1. Go to https://railway.app and sign up/login
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `finsight` repository
4. Click "Add Service" → "GitHub Repo" → Select `finsight`
5. In the service settings:
   - **Root Directory**: Set to `backend`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Go to "Variables" tab and add:
   ```
   OPENAI_API_KEY=your_key_here
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   ALLOWED_ORIGINS=http://localhost:3000,https://finsight.jonasbuilds.ai
   ```
7. Railway will auto-deploy and give you a URL like `https://your-app.railway.app`

## Configure Vercel

1. Go to your Vercel project → Settings → Environment Variables
2. Add:
   - **Name**: `AI_SERVICE_URL`
   - **Value**: Your Railway URL (e.g., `https://your-app.railway.app`)
   - **Environment**: Select all (Production, Preview, Development)
3. Save and redeploy

## Test

1. Visit your deployed site: `https://finsight.jonasbuilds.ai`
2. Try uploading a document
3. Check Vercel logs if there are still errors

## Alternative: Render.com

Same process but on Render.com:
- Create Web Service
- Connect GitHub repo
- Set root directory to `backend`
- Add environment variables
- Use the provided URL in Vercel

