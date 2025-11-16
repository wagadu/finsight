# Evaluation Pipeline Setup Guide

This guide explains how to set up and use the evaluation pipeline for the FinSight RAG system.

## Overview

The evaluation pipeline allows you to:
- Run automated evaluations of the RAG system
- Track metrics like accuracy, response times, and success rates
- Store evaluation results in PostgreSQL
- Use PySpark for scalable metric computation

## Database Setup

1. **Update Supabase Schema**:
   - Open your Supabase SQL Editor
   - Run the updated `schema.sql` file (includes evaluation tables)
   - Or run just the evaluation table sections:

```sql
-- Evaluation tables are already in schema.sql
-- Just run the full schema.sql file to ensure all tables exist
```

2. **Verify Tables Created**:
   - `evaluation_runs` - Tracks evaluation run metadata
   - `evaluation_questions` - Stores individual Q&A pairs
   - `evaluation_metrics` - Aggregated metrics (can be populated by PySpark)

## Python Dependencies

Install the required dependencies:

```bash
cd backend
pip install -r requirements.txt
```

This includes:
- `pyspark` - For scalable data processing
- `numpy` - For numerical computations

## Running Evaluations

### Option 1: Using the API Endpoint

You can trigger an evaluation via the `/eval/run` endpoint:

```bash
curl -X POST http://localhost:8001/eval/run \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "your-document-id",
    "runName": "Test Evaluation",
    "questions": [
      "What was the total revenue?",
      "What was the cost of sales?",
      "What was the net income?"
    ]
  }'
```

### Option 2: Programmatic (Python)

```python
import requests

response = requests.post(
    "http://localhost:8001/eval/run",
    json={
        "documentId": "your-document-id",
        "questions": ["What was the revenue?"]
    }
)
print(response.json())
```

## Viewing Evaluation Results

### Get Summary Metrics

```bash
curl http://localhost:8001/eval/summary
```

Or access via the Next.js frontend - the evaluation summary component will automatically fetch and display metrics.

### Query Database Directly

```sql
-- Get latest evaluation run
SELECT * FROM evaluation_runs 
ORDER BY started_at DESC 
LIMIT 1;

-- Get all questions from a run
SELECT * FROM evaluation_questions 
WHERE evaluation_run_id = 'your-run-id';

-- Get metrics
SELECT * FROM evaluation_metrics 
WHERE evaluation_run_id = 'your-run-id';
```

## PySpark Pipeline

The evaluation pipeline includes a PySpark module (`evaluation_pipeline.py`) that can:

1. **Process evaluation data at scale** - Handle large batches of evaluation questions
2. **Compute aggregated metrics** - Calculate averages, success rates, etc.
3. **Store results in PostgreSQL** - Write metrics back to the database

### Using PySpark (Optional)

If PySpark is available, the pipeline will automatically use it for computation. If not, it falls back to basic Python computation.

To use PySpark:
1. Ensure PySpark is installed: `pip install pyspark`
2. The pipeline will automatically detect and use it

## Evaluation Metrics

The system tracks:
- **Total Questions**: Number of questions evaluated
- **Success Rate**: Percentage of correct answers
- **Response Time**: Average time to generate answers
- **Semantic Similarity**: If similarity scores are computed

## Next Steps

1. Run your first evaluation with a document
2. Check the results in the frontend evaluation summary component
3. Query the database to see detailed results
4. Customize evaluation questions for your use case

## Troubleshooting

- **No evaluation runs**: Make sure you've run at least one evaluation via `/eval/run`
- **Empty metrics**: Check that the evaluation completed successfully (status = 'completed')
- **PySpark errors**: The system will fall back to basic Python computation if PySpark fails

