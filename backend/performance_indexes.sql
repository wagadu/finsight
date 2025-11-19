-- Performance optimization indexes for Phase 1
-- Run this migration in your Supabase SQL editor

-- Composite index for sections query with ordering
-- Used when fetching sections for a run ordered by created_at
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_created 
ON equity_analyst_sections(run_id, created_at);

-- Index for aggregations on response_time_ms
-- Used when calculating average response times per run
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_response_time 
ON equity_analyst_sections(run_id, response_time_ms) 
WHERE response_time_ms IS NOT NULL;

-- Composite index for bulk section queries (used in N+1 fix)
-- Used when fetching sections for multiple runs at once
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_id_response_time 
ON equity_analyst_sections(run_id, response_time_ms);

