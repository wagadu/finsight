# Deployment Guide

This guide explains how to deploy FinSight Copilot to production.

## Architecture Overview

FinSight Copilot uses a microservices architecture:
- **Frontend**: Next.js deployed on Vercel
- **Backend**: Python FastAPI service (needs separate deployment)
- **Database**: Supabase (PostgreSQL)

## Step 1: Deploy Python FastAPI Backend

The backend needs to be deployed separately. Here are recommended options:

### Option A: Railway (Recommended - Easy Setup)

1. Go to [Railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Add a new service → "Deploy from GitHub repo"
5. Select the `backend/` directory
6. Set environment variables:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_KEY` - Your Supabase service role key
7. Railway will auto-detect Python and install dependencies
8. Set the start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
9. Railway will provide a URL like `https://your-app.railway.app`

### Option B: Render

1. Go to [Render.com](https://render.com)
2. Create a new "Web Service"
3. Connect your GitHub repository
4. Set:
   - **Root Directory**: `backend`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (same as Railway)
6. Render will provide a URL like `https://your-app.onrender.com`

### Option C: Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. In the `backend/` directory, run: `fly launch`
3. Follow the prompts
4. Set environment variables: `fly secrets set OPENAI_API_KEY=xxx SUPABASE_URL=xxx SUPABASE_KEY=xxx`
5. Deploy: `fly deploy`

## Step 2: Configure Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:
   - **Name**: `AI_SERVICE_URL`
   - **Value**: Your deployed backend URL (e.g., `https://your-app.railway.app`)
   - **Environment**: Production, Preview, Development (select all)
4. Save and redeploy your Vercel application

## Step 3: Update CORS in Backend

Make sure your backend allows requests from your Vercel domain:

In `backend/main.py`, update the CORS middleware:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://finsight.jonasbuilds.ai",  # Your Vercel domain
        "https://your-vercel-app.vercel.app"  # Your Vercel app URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Or use environment variable:

```python
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Step 4: Verify Deployment

1. Check backend health: Visit `https://your-backend-url/health`
2. Check Vercel logs for any connection errors
3. Test document upload in your deployed app

## Troubleshooting

### "fetch failed" errors
- Verify `AI_SERVICE_URL` is set correctly in Vercel
- Check that your backend is accessible (not behind a firewall)
- Verify CORS is configured correctly

### Backend not starting
- Check backend logs in your hosting platform
- Verify all environment variables are set
- Ensure `requirements.txt` includes all dependencies

### Database connection issues
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are set
- Check Supabase dashboard for connection limits
- Ensure your backend IP is allowed (if using IP restrictions)

## Environment Variables Checklist

### Backend (Python FastAPI)
- [ ] `OPENAI_API_KEY`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_KEY`
- [ ] `ALLOWED_ORIGINS` (optional, for CORS)

### Frontend (Vercel)
- [ ] `AI_SERVICE_URL` (points to your deployed backend)

## Quick Deploy Commands

### Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Render
```bash
# Use Render dashboard or CLI
render deploy
```

### Fly.io
```bash
fly launch
fly secrets set OPENAI_API_KEY=xxx SUPABASE_URL=xxx SUPABASE_KEY=xxx
fly deploy
```

