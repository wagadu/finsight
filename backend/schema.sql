-- Supabase/PostgreSQL schema for FinSight AI Service
-- Run this in your Supabase SQL editor to create the tables and enable vector search

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    text_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks table for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    embedding vector(1536), -- OpenAI text-embedding-3-small uses 1536 dimensions
    token_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(name);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Policies for documents table
CREATE POLICY "Allow all operations for service role" ON documents
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Policies for document_chunks table
CREATE POLICY "Allow all operations for service role" ON document_chunks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Evaluation tables for RAG system evaluation
CREATE TABLE IF NOT EXISTS evaluation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_name TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_questions INTEGER NOT NULL DEFAULT 0,
    successful_answers INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    metadata JSONB, -- Additional metadata about the run
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual evaluation questions and answers
CREATE TABLE IF NOT EXISTS evaluation_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_run_id UUID NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    expected_answer TEXT, -- Ground truth answer (optional)
    model_answer TEXT, -- Answer from the RAG system
    is_correct BOOLEAN, -- Whether the answer matches expected (or manually evaluated)
    similarity_score FLOAT, -- Semantic similarity score if available
    response_time_ms INTEGER, -- Time taken to generate answer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggregated metrics (can be populated by PySpark pipeline)
CREATE TABLE IF NOT EXISTS evaluation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_run_id UUID NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL, -- e.g., 'accuracy', 'avg_response_time', 'semantic_similarity'
    metric_value FLOAT NOT NULL,
    metric_type TEXT, -- 'percentage', 'time_ms', 'score', etc.
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    UNIQUE(evaluation_run_id, metric_name)
);

-- Create indexes for evaluation tables
CREATE INDEX IF NOT EXISTS idx_eval_runs_started_at ON evaluation_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON evaluation_runs(status);
CREATE INDEX IF NOT EXISTS idx_eval_questions_run_id ON evaluation_questions(evaluation_run_id);
CREATE INDEX IF NOT EXISTS idx_eval_questions_document_id ON evaluation_questions(document_id);
CREATE INDEX IF NOT EXISTS idx_eval_metrics_run_id ON evaluation_metrics(evaluation_run_id);

-- Enable RLS for evaluation tables
ALTER TABLE evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for evaluation tables
CREATE POLICY "Allow all operations for service role" ON evaluation_runs
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations for service role" ON evaluation_questions
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations for service role" ON evaluation_metrics
    FOR ALL
    USING (true)
    WITH CHECK (true);
