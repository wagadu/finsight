-- Filing Agent schema for FinSight Copilot
-- Run this migration in your Supabase SQL editor after the base schema.sql

-- Enum for filing candidate status
CREATE TYPE filing_status AS ENUM (
    'pending',
    'auto_approved',
    'rejected',
    'ingested',
    'failed'
);

-- Enum for filing source reliability
CREATE TYPE source_reliability AS ENUM (
    'high',
    'medium',
    'low'
);

-- Watchlist table: Companies to monitor for new filings
CREATE TABLE IF NOT EXISTS filing_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    cik TEXT, -- SEC CIK (Central Index Key) - 10 digits, zero-padded
    company_name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'sec', -- 'sec' or 'annualreports'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- Higher priority = checked more frequently
    last_polled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB, -- Additional metadata (e.g., AnnualReports.com company ID)
    UNIQUE(ticker, cik, source)
);

-- Filing candidates table: Discovered filings awaiting approval/ingestion
CREATE TABLE IF NOT EXISTS filing_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID REFERENCES filing_watchlist(id) ON DELETE SET NULL,
    ticker TEXT NOT NULL,
    cik TEXT,
    company_name TEXT NOT NULL,
    source TEXT NOT NULL, -- 'sec' or 'annualreports'
    source_url TEXT NOT NULL,
    filing_type TEXT NOT NULL, -- '10-K', '20-F', 'annual-report', etc.
    filing_year INTEGER NOT NULL,
    filing_date DATE,
    accession_number TEXT, -- SEC accession number (e.g., '0001234567-23-000001')
    sha256_checksum TEXT, -- SHA256 hash of the filing PDF for deduplication
    status filing_status NOT NULL DEFAULT 'pending',
    status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewer_id TEXT, -- Optional: user ID who approved/rejected
    reviewer_note TEXT, -- Optional: note from reviewer
    rejection_reason TEXT, -- Reason if rejected
    auto_approved_at TIMESTAMP WITH TIME ZONE, -- Timestamp if auto-approved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB, -- Additional metadata (e.g., file size, page count, source reliability)
    UNIQUE(source, accession_number, filing_year) -- Prevent duplicates
);

-- Filing ingestions table: Track successful ingestion events
CREATE TABLE IF NOT EXISTS filing_ingestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES filing_candidates(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    ingestion_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ingestion_completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    error_message TEXT,
    chunk_count INTEGER,
    embedding_count INTEGER,
    file_size_bytes BIGINT,
    ingestion_duration_ms INTEGER,
    evaluation_run_id UUID REFERENCES evaluation_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB -- Additional metrics (e.g., processing time per chunk)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_watchlist_ticker ON filing_watchlist(ticker);
CREATE INDEX IF NOT EXISTS idx_watchlist_cik ON filing_watchlist(cik);
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON filing_watchlist(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_watchlist_last_polled ON filing_watchlist(last_polled_at);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON filing_candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_ticker ON filing_candidates(ticker);
CREATE INDEX IF NOT EXISTS idx_candidates_cik ON filing_candidates(cik);
CREATE INDEX IF NOT EXISTS idx_candidates_source ON filing_candidates(source);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON filing_candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_cik_type_year ON filing_candidates(cik, filing_type, filing_year);
CREATE INDEX IF NOT EXISTS idx_candidates_checksum ON filing_candidates(sha256_checksum);
CREATE INDEX IF NOT EXISTS idx_candidates_watchlist_id ON filing_candidates(watchlist_id);

CREATE INDEX IF NOT EXISTS idx_ingestions_candidate_id ON filing_ingestions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ingestions_document_id ON filing_ingestions(document_id);
CREATE INDEX IF NOT EXISTS idx_ingestions_status ON filing_ingestions(status);
CREATE INDEX IF NOT EXISTS idx_ingestions_started_at ON filing_ingestions(ingestion_started_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE filing_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE filing_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE filing_ingestions ENABLE ROW LEVEL SECURITY;

-- Policies for filing_watchlist table
CREATE POLICY "Allow all operations for service role" ON filing_watchlist
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Policies for filing_candidates table
CREATE POLICY "Allow all operations for service role" ON filing_candidates
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Policies for filing_ingestions table
CREATE POLICY "Allow all operations for service role" ON filing_ingestions
    FOR ALL
    USING (true)
    WITH CHECK (true);

