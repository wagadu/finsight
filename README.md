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
- **Data Processing**: PySpark for evaluation pipelines (planned)

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
│   └── eval/        # Evaluation metrics (wired to Python /eval/summary)
├── layout.tsx       # Root layout with navigation
└── page.tsx         # Main application page

backend/
├── main.py              # FastAPI service with AI logic, document registry, and evaluation endpoints
├── evaluation_pipeline.py  # PySpark evaluation pipeline for scalable metric computation
├── schema.sql           # PostgreSQL schema (documents, chunks, evaluation tables)
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

components/
├── chat-input.tsx      # Message input with suggestions
├── chat-interface.tsx  # Main chat container
├── chat-thread.tsx     # Message display with evidence
├── document-list.tsx   # Sidebar document list
├── document-upload.tsx # Drag-and-drop upload
├── eval-summary.tsx    # Evaluation metrics display
└── ui/                 # shadcn/ui components
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
- **PySpark evaluation pipeline**: `evaluation_pipeline.py` provides scalable metric computation
- **Evaluation endpoints**: `GET /eval/summary` and `POST /eval/run` for RAG system evaluation

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

#### Evaluation Metrics
- **Python endpoint**: `GET /eval/summary` queries PostgreSQL for evaluation metrics
- **Evaluation runs**: `POST /eval/run` triggers automated RAG system evaluation
- **PySpark pipeline**: `evaluation_pipeline.py` provides scalable metric computation
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
- **Data Pipelines**: PySpark-ready design for scalable evaluation and metrics processing
- **Python/SQL Solution Design**: Direct SQL usage planned for performance and transparency
- **Applied LLM Usage**: Real-world OpenAI integration with structured responses
- **Consulting-style AI Solution Work**: Enterprise-ready architecture patterns for AI applications

## Features

- 📄 **Document Upload**: Drag-and-drop PDF upload with validation
- 💬 **Chat Interface**: Natural language queries with AI-powered responses
- 🔍 **Evidence Citations**: Source excerpts linked to specific document pages
- 📊 **Evaluation Metrics**: Track RAG system performance and accuracy
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

### Next.js BFF

\`\`\`env
# Optional: URL of the Python FastAPI service (defaults to http://localhost:8001)
AI_SERVICE_URL=http://localhost:8001
\`\`\`

### Future (PostgreSQL Integration)

\`\`\`env
# Database connection for future PostgreSQL integration
DATABASE_URL=postgresql://user:password@host:port/dbname
\`\`\`

## License

Internal tool - All rights reserved
