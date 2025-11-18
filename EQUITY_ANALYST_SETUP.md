# Equity Analyst Copilot Setup Guide

This guide explains how to set up and use the new Equity Analyst Copilot features, including model optimization capabilities.

## Database Setup

### 1. Run the Migration

Execute the new schema migration in your Supabase SQL editor:

```bash
# Run the migration file
psql -h <your-supabase-host> -U postgres -d postgres -f backend/equity_analyst_schema.sql
```

Or copy and paste the contents of `backend/equity_analyst_schema.sql` into the Supabase SQL editor.

This creates three new tables:
- `equity_analyst_runs` - Tracks each analysis run
- `equity_analyst_sections` - Stores individual analysis sections (revenue drivers, risks, etc.)
- `chat_logs` - Logs free-form chat interactions

## Environment Variables

Add the following to your `.env` file (backend):

```bash
# Model configuration (optional, defaults to gpt-4o-mini)
BASE_MODEL=gpt-4o-mini
FT_MODEL=gpt-4o-mini  # Replace with your fine-tuned model ID when available
DISTILLED_MODEL=gpt-4o-mini  # Replace with your distilled model ID when available
```

## Features

### 1. Equity Analyst Copilot

The Equity Analyst Copilot runs a fixed checklist of analyst questions:

- **Revenue Drivers**: Main revenue sources and business segments
- **Key Risks**: Operational and financial risks
- **Unit Economics**: Margins and unit economics
- **Investment Thesis**: 3-bullet bullish/bearish thesis
- **Financial Trends**: Year-over-year trends

**Usage:**
1. Select a document from the sidebar
2. Click the "Equity Analyst Copilot" tab
3. Select a model (Baseline / Fine-tuned / Distilled)
4. Click "Run full analysis"

Results are displayed in structured cards with citations.

### 2. Model Selection

The copilot supports three model types:
- **Baseline**: Default model (gpt-4o-mini)
- **Fine-tuned**: Custom fine-tuned model (configure via `FT_MODEL`)
- **Distilled**: Distilled/smaller model (configure via `DISTILLED_MODEL`)

### 3. Logging

All copilot runs are automatically logged:
- Run metadata (model, document, timestamp)
- Individual sections with answers and citations
- Response times

Chat interactions are also logged in `chat_logs` for future fine-tuning.

### 4. Fine-tuning Dataset Export

Export logged runs as OpenAI fine-tuning format (JSONL):

**API Endpoint:**
```
GET /api/export-finetune-dataset?modelName=<model>&isGoldOnly=true&limit=100
```

**Query Parameters:**
- `modelName` (optional): Filter by model name
- `isGoldOnly` (optional): Only export gold examples (default: false)
- `limit` (optional): Limit number of examples

**Example:**
```bash
curl "http://localhost:3000/api/export-finetune-dataset?isGoldOnly=true" \
  --output finetune_dataset.jsonl
```

The exported file is in OpenAI fine-tuning format:
```json
{"messages":[{"role":"system","content":"..."},{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}
```

### 5. Marking Gold Examples

To mark sections as "gold" examples for fine-tuning:

```sql
UPDATE equity_analyst_sections
SET is_gold = true
WHERE id = '<section-id>';
```

Or use the Supabase dashboard to manually mark high-quality examples.

## Evaluation Integration

The existing evaluation system can be extended to evaluate copilot runs:

1. Run evaluations with different models
2. Compare metrics across baseline, fine-tuned, and distilled models
3. Track improvements in factuality, structure adherence, and style

## Distillation Dataset Generation

A script stub is provided for generating distillation datasets:

```bash
cd backend
python generate_distillation_dataset.py
```

**TODO:** Implement the full pipeline:
- Document sampling strategy
- Synthetic question generation
- Teacher model inference
- Dataset storage

## API Endpoints

### Equity Analyst Copilot

**POST** `/api/equity-analyst/run`
```json
{
  "documentId": "uuid",
  "modelKey": "baseline" | "ft" | "distilled"
}
```

**Response:**
```json
{
  "runId": "uuid",
  "status": "completed",
  "sections": [
    {
      "id": "uuid",
      "section_type": "revenue_drivers",
      "question_text": "...",
      "model_answer": "...",
      "citations": [...],
      "response_time_ms": 1234
    }
  ]
}
```

### Dataset Export

**GET** `/api/export-finetune-dataset?modelName=<model>&isGoldOnly=true&limit=100`

Returns a JSONL file download.

## Database Schema

### equity_analyst_runs
- `id` (uuid)
- `document_id` (uuid, FK)
- `model_name` (text)
- `run_type` (text: 'baseline' | 'ft' | 'distilled')
- `status` (text: 'running' | 'completed' | 'failed')
- `created_at`, `completed_at` (timestamp)
- `metadata` (jsonb)

### equity_analyst_sections
- `id` (uuid)
- `run_id` (uuid, FK)
- `section_type` (text)
- `question_text` (text)
- `model_answer` (text)
- `citations` (jsonb)
- `response_time_ms` (integer)
- `is_gold` (boolean, default: false)
- `created_at` (timestamp)

### chat_logs
- `id` (uuid)
- `document_id` (uuid, FK)
- `user_message` (text)
- `assistant_message` (text)
- `model_name` (text)
- `citations` (jsonb)
- `response_time_ms` (integer)
- `created_at` (timestamp)

## Next Steps

1. **Run the migration** to create new tables
2. **Set environment variables** for model configuration
3. **Test the copilot** with a sample document
4. **Mark gold examples** for fine-tuning
5. **Export datasets** for model training
6. **Implement distillation pipeline** (see `generate_distillation_dataset.py`)

## Troubleshooting

**Issue:** Copilot runs fail
- Check that the document has been processed (chunks exist)
- Verify OpenAI API key is set
- Check backend logs for errors

**Issue:** Dataset export is empty
- Ensure copilot runs have been executed
- Check that `is_gold` flag is set if using `isGoldOnly=true`
- Verify database connection

**Issue:** Model selection doesn't work
- Verify environment variables are set correctly
- Check that model names are valid OpenAI model IDs
- Default models fall back to `gpt-4o-mini` if not configured

