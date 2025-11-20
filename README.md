# FinSight Copilot

An internal tool for financial document analysis powered by LLM-based RAG (Retrieval-Augmented Generation).

## Overview

FinSight Copilot allows users to upload financial documents (PDFs), chat with them using natural language queries, and receive AI-powered answers with evidence citations from the source documents.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (BFF layer) → Python FastAPI microservice
- **Database**: PostgreSQL via Supabase with pgvector for embeddings
- **Storage**: Supabase Storage for large file uploads (bypasses Vercel 4.5MB limit)
- **Edge Functions**: Supabase Edge Functions for file processing
- **AI/ML**: OpenAI models for LLM chat + embeddings for RAG
- **Data Processing**: PySpark for evaluation pipelines (implemented with automatic fallback)

## Getting Started

### Installation

\`\`\`bash
# Install Next.js dependencies
npm install
# or
pnpm install

# Install Python backend dependencies
cd backend
pip install -r requirements.txt
# or
pip3 install -r requirements.txt

# Note: PySpark is included in requirements.txt but requires Java 8 or 11
# If PySpark is not available, the evaluation pipeline will automatically
# fall back to basic Python computation
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

\`\`\`
app/
├── api/              # Next.js API routes (BFF layer)
│   ├── chat/        # Chat endpoint (proxies to Python /chat)
│   ├── documents/   # Document endpoints (proxies to Python /documents)
│   ├── eval/        # Evaluation metrics (wired to Python /eval/summary)
│   ├── filings/     # Filing management endpoints
│   │   ├── route.ts           # List filing candidates
│   │   ├── search/route.ts    # Natural language filing search
│   │   └── [id]/              # Approve/reject individual filings
│   └── equity-analyst/  # Equity analyst copilot endpoints
├── filings/         # Filing candidates management page
├── layout.tsx       # Root layout with navigation
└── page.tsx         # Main application page

backend/
├── main.py              # FastAPI service with AI logic, document registry, and evaluation endpoints
├── evaluation_pipeline.py  # PySpark evaluation pipeline for scalable metric computation
├── agents/              # Autonomous agents
│   ├── filing_scout.py      # Discovers new filings from SEC and AnnualReports.com
│   ├── filing_ingestion.py   # Ingests approved filings into RAG system
│   └── webhook_notifier.py   # Sends notifications for filing events
├── schema.sql           # PostgreSQL schema (documents, chunks, evaluation tables)
├── filing_agent_schema.sql  # Filing agent specific schema (watchlist, candidates, ingestions)
├── storage_setup.sql    # Supabase Storage bucket and RLS policies
├── requirements.txt     # Python dependencies
├── SUPABASE_SETUP.md    # Supabase setup guide
├── RAG_SETUP.md        # RAG setup guide
├── EVALUATION_SETUP.md  # Evaluation pipeline setup guide
└── EDGE_FUNCTION_SETUP.md  # Edge Function setup guide for large file uploads

supabase/
└── functions/
    ├── upload-document/  # Edge Function for processing uploaded documents
    └── _shared/         # Shared utilities (CORS headers)

docs/
├── filing_agent.md              # Filing agent documentation
├── FILING_SEARCH_SETUP.md       # Filing search chat setup guide
├── FILING_SEARCH_ARCHITECTURE.md # Filing search architecture
├── AGENT_BUILDER_SETUP.md       # OpenAI Agent Builder setup
├── AGENT_BUILDER_STEP_BY_STEP.md # Step-by-step Agent Builder guide
├── WORKFLOW_API_LIMITATIONS.md  # Workflow API limitations and workarounds
├── QUICK_START_FILING_AGENT.md  # Quick start for filing agent
└── TROUBLESHOOTING_INGESTION.md # Troubleshooting guide

components/
├── chat-input.tsx         # Message input with suggestions
├── chat-interface.tsx       # Main chat container
├── chat-thread.tsx         # Message display with evidence
├── document-list.tsx      # Sidebar document list
├── document-upload.tsx    # Drag-and-drop upload
├── eval-summary.tsx       # Evaluation metrics display
├── filing-search-chat.tsx # Natural language filing search interface
├── equity-analyst-copilot.tsx  # Equity analyst copilot interface
└── ui/                    # shadcn/ui components
\`\`\`

## Backend Integration

### Architecture Overview

This project uses a **microservices-style architecture** with Next.js as the frontend and Backend-for-Frontend (BFF), and a separate Python FastAPI microservice handling AI logic and data.

#### Next.js API Routes (BFF Layer)

The Next.js API routes (`/api/documents/*`, `/api/chat`, `/api/eval/summary`) act as a **Backend-for-Frontend (BFF)** layer that:
- Receives requests from the frontend
- Proxies requests to the Python FastAPI microservice
- Transforms responses to match frontend expectations
- Handles error responses and logging

#### Python FastAPI Microservice

A separate `backend/` FastAPI service (`backend/main.py`) that:
- **Owns AI logic and document metadata**: Manages document registry and AI processing
- **Calls the OpenAI API for chat**: Integrates with OpenAI Chat Completions API for LLM responses
- **Stores data in PostgreSQL/Supabase**: Documents, chunks, and evaluation results stored in SQL
- **PySpark evaluation pipeline**: `evaluation_pipeline.py` provides scalable metric computation with automatic fallback to basic Python
- **Evaluation endpoints**: `GET /eval/summary` and `POST /eval/run` for RAG system evaluation
- **Database integration**: Can read evaluation data from Supabase/PostgreSQL for reprocessing and batch operations

### Current Implementation

#### Document Management
- **Supabase Storage**: Files are uploaded directly to Supabase Storage (bypasses Vercel's 4.5MB limit, supports up to 50MB)
- **Edge Function processing**: Supabase Edge Function handles file processing and calls Python backend
- **PostgreSQL/Supabase storage**: Document metadata and content are stored in Supabase (PostgreSQL)
- **PDF parsing**: PDFs are parsed and text content is extracted and stored
- **RAG with embeddings**: Documents are automatically chunked and embedded using OpenAI embeddings
- **Upload progress**: Real-time upload progress tracking for better UX
- **Vector search**: Semantic search finds relevant document chunks using cosine similarity
- **Endpoints**: `POST /documents` (create with PDF parsing and chunking), `GET /documents` (list all)

#### Chat Functionality
- **RAG Implementation**: Uses Retrieval-Augmented Generation with semantic search
- **OpenAI Integration**: Uses OpenAI Chat Completions API with GPT models
- **Semantic Search**: Finds relevant document chunks using vector similarity
- **Citations**: Provides page references and excerpts for answers
- **System Prompt**: Configured as "FinSight Copilot" for financial analysts
- **Temperature**: Set to 0.2 for consistent, focused responses

#### Filing Search Chat
- **Natural Language Processing**: Uses OpenAI to extract company, filing type, and year from queries
- **SEC EDGAR Integration**: Direct integration with SEC API to search for filings
- **Company Resolution**: Automatically resolves company names/tickers to CIK (Central Index Key)
- **Automatic Candidate Creation**: Found filings are automatically added to the candidates list
- **Agent Builder Support**: Optional integration with OpenAI Agent Builder workflows
- **Smart Fallback**: Automatically falls back to Chat API if Agent Builder is unavailable

#### Evaluation Metrics
- **Python endpoint**: `GET /eval/summary` queries PostgreSQL for evaluation metrics
- **Evaluation runs**: `POST /eval/run` triggers automated RAG system evaluation
- **PySpark pipeline**: `evaluation_pipeline.py` provides scalable metric computation with automatic fallback
  - Uses PySpark DataFrames for aggregations when available
  - Automatically falls back to basic Python computation if PySpark is unavailable
  - Computes metrics: accuracy, success rate, average response time, semantic similarity scores, document-level statistics
- **Database integration**: Can read evaluation data from Supabase/PostgreSQL for reprocessing existing runs
- **Database storage**: Evaluation results stored in `evaluation_runs`, `evaluation_questions`, and `evaluation_metrics` tables

### Local Development Setup

1. **Start the Python FastAPI service**:
   ```bash
   cd backend
   uvicorn main:app --reload --port 8001
   ```

2. **Start the Next.js app**:
   ```bash
   npm run dev
   ```

3. **Access the application**:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8001](http://localhost:8001)
   - API Docs: [http://localhost:8001/docs](http://localhost:8001/docs)

### Technology Choices Rationale

This architecture demonstrates:
- **Microservices**: Separation of concerns between frontend (Next.js) and backend (FastAPI)
- **Data Pipelines**: PySpark implementation for scalable evaluation and metrics processing with automatic fallback
- **Python/SQL Solution Design**: Direct SQL usage with Supabase/PostgreSQL for performance and transparency
- **Applied LLM Usage**: Real-world OpenAI integration with structured responses
- **Consulting-style AI Solution Work**: Enterprise-ready architecture patterns for AI applications

## Features

- 📄 **Document Upload**: Drag-and-drop PDF upload with validation
- 💬 **Chat Interface**: Natural language queries with AI-powered responses
- 🔍 **Evidence Citations**: Source excerpts linked to specific document pages
- 📊 **Evaluation Metrics**: Track RAG system performance and accuracy
- 🤖 **Autonomous Filing Agent**: Automatically discovers and ingests annual reports from SEC EDGAR and AnnualReports.com
- 🔎 **Filing Search Chat**: Natural language search for SEC filings - ask in plain language to find and add 10-K/annual reports
- 🧠 **OpenAI Agent Builder Integration**: Optional integration with OpenAI Agent Builder workflows for advanced query processing
- 🎨 **Clean UI**: Professional internal tool design with shadcn/ui components

## Environment Variables

### Python FastAPI Service (`backend/`)

Create a `.env` file in the `backend/` directory:

\`\`\`bash
cd backend
cp .env.example .env
# Then edit .env and add your actual keys
\`\`\`

Or create `backend/.env` manually with:

\`\`\`env
# Required: OpenAI API key for chat functionality
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Required: Supabase configuration for database
# Get these from your Supabase project: https://supabase.com/dashboard
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here

# Filing Agent Configuration (optional)
# SEC API requires a User-Agent with contact email per their guidelines
SEC_USER_AGENT=FinSight Filing Scout (your-email@example.com)

# Webhook Notifications (optional)
FILING_AGENT_WEBHOOK_ENABLED=false
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
# OR
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
# OR
FILING_AGENT_WEBHOOK_URL=https://your-custom-webhook.com/endpoint
\`\`\`

#### Setting up Supabase Database

1. **Create a Supabase project** at https://supabase.com
2. **Run the schema SQL**: In your Supabase dashboard, go to SQL Editor and run the SQL from `backend/schema.sql`
3. **Set up Storage**: Run the SQL from `backend/storage_setup.sql` to create the documents bucket
4. **Get your credentials**: 
   - Go to Project Settings → API
   - Copy the "Project URL" (SUPABASE_URL)
   - Copy the "anon public" key (SUPABASE_KEY) - use this for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy the "service_role" key (SUPABASE_SERVICE_ROLE_KEY) - keep this secret!
5. **Add to `.env`**: Add all values to your `backend/.env` file
6. **Add to `.env.local`**: Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to your Next.js `.env.local` file

#### Setting up Supabase Edge Function

See `backend/EDGE_FUNCTION_SETUP.md` for detailed instructions on:
- Deploying the Edge Function
- Setting environment variables
- Testing large file uploads

#### PySpark Setup (Optional)

The evaluation pipeline uses PySpark for scalable metric computation. PySpark is included in `requirements.txt` but requires:
- **Java 8 or 11**: PySpark requires Java to be installed on your system
- **Automatic fallback**: If PySpark is not available, the system automatically falls back to basic Python computation

To verify PySpark is working:
```bash
cd backend
python -c "from pyspark.sql import SparkSession; print('PySpark is available')"
```

If you see an error, PySpark will not be used, but the evaluation pipeline will still work using basic Python computation.

### Next.js BFF

\`\`\`env
# Optional: URL of the Python FastAPI service (defaults to http://localhost:8001)
AI_SERVICE_URL=http://localhost:8001

# Required for Filing Agent API routes: Supabase service role key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# OR use SUPABASE_KEY if it's the service role key

# Required for Filing Search Chat: OpenAI API key
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini

# Optional: OpenAI Agent Builder integration
# Get workflow ID from https://platform.openai.com/agent-builder
OPENAI_AGENT_ID=wf_...  # or agent_... for agents

# Required for SEC API: User-Agent with contact email
SEC_USER_AGENT=FinSight Filing Search (your-email@example.com)
\`\`\`

## Filing Agent

The FinSight Filing Agent autonomously monitors SEC EDGAR and AnnualReports.com for new annual reports, queues them for review, and ingests approved filings into the RAG system.

### Quick Start

1. **Run the database migration**: Execute `backend/filing_agent_schema.sql` in your Supabase SQL editor
2. **Add companies to watchlist**: Insert companies into `filing_watchlist` table
3. **Run the agent**: `python -m backend.agents.filing_scout --dry-run` (test) or `python -m backend.agents.filing_scout` (production)
4. **Review candidates**: Navigate to `/filings` in the app to review and approve candidates

For detailed documentation, see [docs/filing_agent.md](docs/filing_agent.md).

## Filing Search Chat

A new feature that allows users to search for SEC filings using natural language queries directly from the `/filings` page.

### Features

- **Natural Language Search**: Ask questions like "Find Apple's 2023 10-K annual report" or "Search Microsoft quarterly 2024"
- **Automatic Extraction**: Uses OpenAI to extract company name, filing type, and year from queries
- **SEC Integration**: Automatically searches SEC EDGAR database for matching filings
- **Direct Integration**: Found filings are automatically added to the filing candidates list
- **OpenAI Agent Builder Support**: Optional integration with Agent Builder workflows (see below)

### Usage

1. Navigate to `/filings` page
2. Use the chat interface at the top of the page
3. Enter queries like:
   - "Find Apple's 2023 10-K annual report"
   - "Search Microsoft quarterly 2024"
   - "Get Tesla latest annual report"
4. The system will automatically find and add the filing to candidates

For detailed setup instructions, see [docs/FILING_SEARCH_SETUP.md](docs/FILING_SEARCH_SETUP.md).

## OpenAI Agent Builder Integration

The filing search feature supports optional integration with OpenAI Agent Builder workflows for advanced query processing.

### Current Status

- **Workflow Support**: The code attempts to use Agent Builder workflows when `OPENAI_AGENT_ID` is configured
- **Automatic Fallback**: If workflows are not accessible via REST API, the system automatically falls back to Chat API with equivalent instructions
- **Seamless Experience**: The fallback is transparent and produces identical results

### Setup (Optional)

1. **Create a workflow in Agent Builder**: Go to https://platform.openai.com/agent-builder
2. **Configure instructions**: Use the instructions from [docs/AGENT_BUILDER_SETUP.md](docs/AGENT_BUILDER_SETUP.md)
3. **Get workflow ID**: Copy the workflow ID (starts with `wf_`)
4. **Add to environment**: Add `OPENAI_AGENT_ID=wf_...` to `.env.local`
5. **Restart server**: The system will automatically use the workflow if available

**Note**: Workflows may not be accessible via REST API yet. The system will automatically use Chat API with equivalent instructions, which produces the same results.

For detailed step-by-step instructions, see:
- [docs/AGENT_BUILDER_STEP_BY_STEP.md](docs/AGENT_BUILDER_STEP_BY_STEP.md) - Complete setup guide
- [docs/AGENT_BUILDER_SETUP.md](docs/AGENT_BUILDER_SETUP.md) - Technical reference
- [docs/WORKFLOW_API_LIMITATIONS.md](docs/WORKFLOW_API_LIMITATIONS.md) - Current limitations and workarounds

### Future (PostgreSQL Integration)

\`\`\`env
# Database connection for future PostgreSQL integration
DATABASE_URL=postgresql://user:password@host:port/dbname
\`\`\`

## License

Internal tool - All rights reserved
