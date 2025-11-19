-- Equity Analyst Copilot schema additions
-- Run this migration in your Supabase SQL editor after the base schema.sql

-- Equity Analyst Runs table
CREATE TABLE IF NOT EXISTS equity_analyst_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL, -- e.g., 'gpt-4o-mini', 'gpt-4o-mini-ft', 'gpt-4o-mini-distilled'
    run_type TEXT NOT NULL, -- 'baseline', 'ft' (fine-tuned), 'distilled'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
    metadata JSONB -- Additional metadata about the run
);

-- Equity Analyst Sections table
CREATE TABLE IF NOT EXISTS equity_analyst_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES equity_analyst_runs(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL, -- 'revenue_drivers', 'key_risks', 'unit_economics', 'investment_thesis', 'financial_trends'
    question_text TEXT NOT NULL,
    model_answer TEXT NOT NULL,
    citations JSONB, -- Array of citation objects with chunk_id, page_number, excerpt
    response_time_ms INTEGER,
    is_gold BOOLEAN DEFAULT FALSE, -- Mark gold examples for fine-tuning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat Logs table (optional, for logging free-form chat)
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    user_message TEXT NOT NULL,
    assistant_message TEXT NOT NULL,
    model_name TEXT, -- Model used for this chat
    citations JSONB, -- Citations from RAG retrieval
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_equity_runs_document_id ON equity_analyst_runs(document_id);
CREATE INDEX IF NOT EXISTS idx_equity_runs_created_at ON equity_analyst_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equity_runs_model_name ON equity_analyst_runs(model_name);
CREATE INDEX IF NOT EXISTS idx_equity_runs_run_type ON equity_analyst_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_id ON equity_analyst_sections(run_id);
CREATE INDEX IF NOT EXISTS idx_equity_sections_section_type ON equity_analyst_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_equity_sections_is_gold ON equity_analyst_sections(is_gold);
CREATE INDEX IF NOT EXISTS idx_chat_logs_document_id ON chat_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);

-- Performance optimization indexes (Phase 1)
-- Composite index for sections query with ordering
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_created 
ON equity_analyst_sections(run_id, created_at);

-- Index for aggregations on response_time_ms
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_response_time 
ON equity_analyst_sections(run_id, response_time_ms) 
WHERE response_time_ms IS NOT NULL;

-- Composite index for bulk section queries (used in N+1 fix)
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_id_response_time 
ON equity_analyst_sections(run_id, response_time_ms);

-- Enable RLS
ALTER TABLE equity_analyst_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_analyst_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Policies for equity_analyst_runs
CREATE POLICY "Allow all operations for service role" ON equity_analyst_runs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Policies for equity_analyst_sections
CREATE POLICY "Allow all operations for service role" ON equity_analyst_sections
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Policies for chat_logs
CREATE POLICY "Allow all operations for service role" ON chat_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

