-- SQL Queries for Reviewing and Marking Gold Examples
-- Run these in your Supabase SQL Editor

-- ============================================
-- 1. VIEW ALL BASELINE RUNS AND SECTIONS
-- ============================================
-- See all your baseline runs with preview of answers
SELECT 
  ear.id as run_id,
  ear.created_at as run_date,
  d.name as document_name,
  COUNT(eas.id) as total_sections,
  COUNT(CASE WHEN eas.is_gold = true THEN 1 END) as gold_count
FROM equity_analyst_runs ear
JOIN documents d ON ear.document_id = d.id
LEFT JOIN equity_analyst_sections eas ON eas.run_id = ear.id
WHERE ear.run_type = 'baseline'
GROUP BY ear.id, ear.created_at, d.name
ORDER BY ear.created_at DESC;

-- ============================================
-- 2. DETAILED VIEW OF ALL SECTIONS
-- ============================================
-- Review each section with full details
SELECT 
  eas.id as section_id,
  ear.id as run_id,
  d.name as document_name,
  eas.section_type,
  eas.question_text,
  LEFT(eas.model_answer, 150) as answer_preview,
  eas.is_gold,
  eas.response_time_ms,
  jsonb_array_length(COALESCE(eas.citations, '[]'::jsonb)) as citation_count,
  ear.created_at
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
JOIN documents d ON ear.document_id = d.id
WHERE ear.run_type = 'baseline'
ORDER BY ear.created_at DESC, eas.section_type;

-- ============================================
-- 3. VIEW FULL ANSWER FOR A SPECIFIC SECTION
-- ============================================
-- Replace 'section-id-here' with actual section ID
SELECT 
  eas.id,
  eas.section_type,
  eas.question_text,
  eas.model_answer,
  eas.citations,
  eas.is_gold,
  d.name as document_name
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
JOIN documents d ON ear.document_id = d.id
WHERE eas.id = 'section-id-here';

-- ============================================
-- 4. MARK SECTIONS AS GOLD (INDIVIDUAL)
-- ============================================
-- Replace section IDs with actual IDs from your review
UPDATE equity_analyst_sections
SET is_gold = true
WHERE id IN (
  'section-id-1',
  'section-id-2',
  'section-id-3'
  -- Add more IDs as needed
);

-- ============================================
-- 5. MARK ALL SECTIONS FROM A RUN AS GOLD
-- ============================================
-- Replace 'run-id-here' with actual run ID
UPDATE equity_analyst_sections
SET is_gold = true
WHERE run_id = 'run-id-here';

-- ============================================
-- 6. MARK BY SECTION TYPE (BULK)
-- ============================================
-- Mark all "revenue_drivers" sections as gold
UPDATE equity_analyst_sections eas
SET is_gold = true
FROM equity_analyst_runs ear
WHERE eas.run_id = ear.id
  AND ear.run_type = 'baseline'
  AND eas.section_type = 'revenue_drivers';

-- ============================================
-- 7. UNMARK GOLD (IF YOU MADE A MISTAKE)
-- ============================================
UPDATE equity_analyst_sections
SET is_gold = false
WHERE id = 'section-id-here';

-- ============================================
-- 8. COUNT GOLD EXAMPLES BY SECTION TYPE
-- ============================================
SELECT 
  eas.section_type,
  COUNT(*) as total_sections,
  COUNT(CASE WHEN eas.is_gold = true THEN 1 END) as gold_sections,
  ROUND(100.0 * COUNT(CASE WHEN eas.is_gold = true THEN 1 END) / COUNT(*), 1) as gold_percentage
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
WHERE ear.run_type = 'baseline'
GROUP BY eas.section_type
ORDER BY eas.section_type;

-- ============================================
-- 9. EXPORT READY CHECK
-- ============================================
-- Check if you have enough gold examples for fine-tuning
SELECT 
  COUNT(*) as total_gold_examples,
  COUNT(DISTINCT eas.section_type) as unique_section_types,
  COUNT(DISTINCT ear.document_id) as unique_documents
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
WHERE eas.is_gold = true
  AND ear.run_type = 'baseline';

-- ============================================
-- 10. COMPARE BASELINE VS FINE-TUNED (AFTER STEP 5)
-- ============================================
-- Compare answers from same document and question
SELECT 
  ear.run_type,
  ear.model_name,
  eas.section_type,
  LEFT(eas.model_answer, 200) as answer_preview,
  eas.response_time_ms,
  jsonb_array_length(COALESCE(eas.citations, '[]'::jsonb)) as citation_count,
  ear.created_at
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
WHERE ear.document_id = 'your-document-id'
  AND eas.section_type = 'revenue_drivers'  -- Change section type as needed
ORDER BY ear.run_type, ear.created_at DESC;

-- ============================================
-- 11. QUALITY METRICS
-- ============================================
-- Analyze answer quality indicators
SELECT 
  ear.run_type,
  AVG(LENGTH(eas.model_answer)) as avg_answer_length,
  AVG(eas.response_time_ms) as avg_response_time,
  AVG(jsonb_array_length(COALESCE(eas.citations, '[]'::jsonb))) as avg_citations,
  COUNT(*) as total_sections
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
GROUP BY ear.run_type;

