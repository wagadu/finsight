# Model Optimization Workflow

This guide walks you through the complete workflow from baseline runs to fine-tuned models.

## Current Status ✅

You've completed:
- ✅ Run 2x Baseline model analyses
- ✅ Data is logged in `equity_analyst_runs` and `equity_analyst_sections`

## Step-by-Step Workflow

### Step 1: Review and Mark Gold Examples

Review your baseline runs and mark high-quality examples for fine-tuning.

**Option A: Via Supabase Dashboard**
1. Go to your Supabase dashboard
2. Navigate to `equity_analyst_sections` table
3. Review the `model_answer` column for each section
4. Mark high-quality answers by setting `is_gold = true` for those rows

**Option B: Via SQL**
```sql
-- View all sections from your baseline runs
SELECT 
  eas.id,
  eas.section_type,
  eas.question_text,
  LEFT(eas.model_answer, 100) as answer_preview,
  eas.is_gold,
  ear.model_name,
  ear.created_at
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
WHERE ear.run_type = 'baseline'
ORDER BY ear.created_at DESC, eas.section_type;

-- Mark specific sections as gold (replace with actual IDs)
UPDATE equity_analyst_sections
SET is_gold = true
WHERE id IN (
  'section-id-1',
  'section-id-2',
  -- Add more IDs
);

-- Or mark all sections from a specific run as gold
UPDATE equity_analyst_sections
SET is_gold = true
WHERE run_id = 'your-run-id';
```

**What to look for:**
- ✅ Accurate financial data extraction
- ✅ Proper citations with page numbers
- ✅ Well-structured answers
- ✅ Professional equity analyst tone
- ✅ Complete answers (not truncated)

### Step 2: Export Fine-Tuning Dataset

Export your gold examples in OpenAI fine-tuning format.

**Via Browser/API:**
```bash
# Export all gold examples
curl "http://localhost:3000/api/export-finetune-dataset?isGoldOnly=true" \
  --output finetune_dataset.jsonl

# Or export all baseline examples (if you want to use all, not just gold)
curl "http://localhost:3000/api/export-finetune-dataset?modelName=gpt-4o-mini" \
  --output finetune_dataset.jsonl

# Limit to first 100 examples
curl "http://localhost:3000/api/export-finetune-dataset?isGoldOnly=true&limit=100" \
  --output finetune_dataset.jsonl
```

**Verify the export:**
```bash
# Check number of examples
wc -l finetune_dataset.jsonl

# Preview first example
head -n 1 finetune_dataset.jsonl | python -m json.tool
```

The file should contain JSONL format like:
```json
{
  "messages": [
    {"role": "system", "content": "You are an Equity Analyst Copilot..."},
    {"role": "user", "content": "What are the main revenue drivers?\n\nRelevant context:\n..."},
    {"role": "assistant", "content": "The main revenue drivers..."}
  ]
}
```

### Step 3: Fine-Tune Model with OpenAI

Upload and fine-tune your model using OpenAI's API.

**Prerequisites:**
- OpenAI API key with fine-tuning access
- At least 10 examples (OpenAI minimum), but 50+ recommended

**Upload training file:**
```bash
# Using OpenAI CLI
openai api fine_tunes.create \
  -t finetune_dataset.jsonl \
  -m gpt-4o-mini \
  --suffix "finsight-analyst"

# Or using Python
python -c "
from openai import OpenAI
client = OpenAI()

# Upload file
with open('finetune_dataset.jsonl', 'rb') as f:
    file = client.files.create(file=f, purpose='fine-tune')

# Create fine-tuning job
job = client.fine_tuning.jobs.create(
    training_file=file.id,
    model='gpt-4o-mini',
    suffix='finsight-analyst'
)
print(f'Job ID: {job.id}')
print(f'Status: {job.status}')
"
```

**Monitor fine-tuning:**
```bash
# Check status
openai api fine_tunes.get -i ft-job-xxxxx

# Or in Python
job = client.fine_tuning.jobs.retrieve('ft-job-xxxxx')
print(f'Status: {job.status}')
print(f'Fine-tuned model: {job.fine_tuned_model}')
```

**Wait for completion:**
- Fine-tuning typically takes 10-60 minutes depending on dataset size
- You'll receive an email when complete
- The `fine_tuned_model` field will contain your model ID (e.g., `ft:gpt-4o-mini-org:custom:suffix:xxxxx`)

### Step 4: Configure Fine-Tuned Model

Update your environment variables to use the fine-tuned model.

**Update `.env` file (backend):**
```bash
BASE_MODEL=gpt-4o-mini
FT_MODEL=ft:gpt-4o-mini-org:custom:finsight-analyst:xxxxx  # Your fine-tuned model ID
DISTILLED_MODEL=gpt-4o-mini  # Keep as baseline for now
```

**Restart backend:**
```bash
# Restart your Python FastAPI service
# The new FT_MODEL will be used when you select "Fine-tuned" in the UI
```

### Step 5: Run Fine-Tuned Model and Compare

Test your fine-tuned model on the same documents.

1. **In the UI:**
   - Select the same document you used for baseline
   - Choose "Fine-tuned" from the model dropdown
   - Click "Run full analysis"
   - Compare results side-by-side

2. **Compare Results:**
   ```sql
   -- Compare baseline vs fine-tuned answers for same question
   SELECT 
     ear.run_type,
     ear.model_name,
     eas.section_type,
     eas.question_text,
     LEFT(eas.model_answer, 200) as answer_preview,
     eas.response_time_ms,
     eas.is_gold
   FROM equity_analyst_sections eas
   JOIN equity_analyst_runs ear ON eas.run_id = ear.id
   WHERE eas.section_type = 'revenue_drivers'
     AND ear.document_id = 'your-document-id'
   ORDER BY ear.run_type, ear.created_at DESC;
   ```

### Step 6: Set Up Evaluation Pipeline

Create a systematic evaluation to compare models.

**Option A: Use Existing Evaluation Endpoint**
```bash
# Run evaluation with baseline model (default)
curl -X POST http://localhost:8001/eval/run \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "your-document-id",
    "runName": "Baseline Evaluation",
    "questions": [
      "What are the main revenue drivers?",
      "What are the key risks?",
      "What are the unit economics and margins?",
      "Provide a 3-bullet investment thesis.",
      "What are the notable financial trends?"
    ]
  }'
```

**Option B: Create Custom Evaluation Script**
Create a script to systematically compare models:

```python
# backend/compare_models.py
import requests
import json

BASE_URL = "http://localhost:8001"
DOCUMENT_ID = "your-document-id"

# Questions to evaluate
QUESTIONS = [
    "What are the main revenue drivers?",
    "What are the key risks?",
    "What are the unit economics and margins?",
    "Provide a 3-bullet investment thesis.",
    "What are the notable financial trends?"
]

def run_copilot_analysis(model_key):
    """Run equity analyst copilot with specified model"""
    response = requests.post(
        f"{BASE_URL}/equity-analyst/run",
        json={
            "documentId": DOCUMENT_ID,
            "modelKey": model_key
        }
    )
    return response.json()

# Run baseline
print("Running baseline...")
baseline_result = run_copilot_analysis("baseline")
print(f"Baseline run ID: {baseline_result['runId']}")

# Run fine-tuned
print("Running fine-tuned...")
ft_result = run_copilot_analysis("ft")
print(f"Fine-tuned run ID: {ft_result['runId']}")

# Compare results
print("\n=== Comparison ===")
for i, question in enumerate(QUESTIONS):
    baseline_section = next(
        (s for s in baseline_result['sections'] if s['question_text'] == question),
        None
    )
    ft_section = next(
        (s for s in ft_result['sections'] if s['question_text'] == question),
        None
    )
    
    if baseline_section and ft_section:
        print(f"\nQuestion: {question[:50]}...")
        print(f"Baseline time: {baseline_section['response_time_ms']}ms")
        print(f"Fine-tuned time: {ft_section['response_time_ms']}ms")
```

### Step 7: Analyze Results

Query the database to compare model performance:

```sql
-- Compare response times
SELECT 
  ear.run_type,
  COUNT(*) as total_sections,
  AVG(eas.response_time_ms) as avg_response_time,
  MIN(eas.response_time_ms) as min_time,
  MAX(eas.response_time_ms) as max_time
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
WHERE ear.document_id = 'your-document-id'
GROUP BY ear.run_type;

-- Compare answer lengths (quality indicator)
SELECT 
  ear.run_type,
  eas.section_type,
  AVG(LENGTH(eas.model_answer)) as avg_answer_length,
  COUNT(*) as count
FROM equity_analyst_sections eas
JOIN equity_analyst_runs ear ON eas.run_id = ear.id
WHERE ear.document_id = 'your-document-id'
GROUP BY ear.run_type, eas.section_type
ORDER BY eas.section_type, ear.run_type;
```

### Step 8: Iterate and Improve

1. **Mark more gold examples** from fine-tuned model outputs
2. **Export updated dataset** with more examples
3. **Fine-tune again** with larger dataset
4. **Compare iterations** to track improvements

## Quick Reference Commands

```bash
# 1. View baseline runs
# (Use Supabase dashboard or SQL)

# 2. Export dataset
curl "http://localhost:3000/api/export-finetune-dataset?isGoldOnly=true" \
  --output finetune_dataset.jsonl

# 3. Fine-tune model
openai api fine_tunes.create -t finetune_dataset.jsonl -m gpt-4o-mini --suffix "finsight-analyst"

# 4. Update .env with model ID
# FT_MODEL=ft:gpt-4o-mini-org:custom:finsight-analyst:xxxxx

# 5. Restart backend and test in UI
```

## Next: Distillation (Optional)

Once you have a good fine-tuned model, you can:
1. Use it as a "teacher" model
2. Generate distillation dataset (see `generate_distillation_dataset.py`)
3. Train a smaller "student" model
4. Compare performance vs size trade-offs

## Troubleshooting

**Issue: Not enough examples for fine-tuning**
- OpenAI requires minimum 10 examples
- Mark more sections as gold
- Or export all baseline examples (remove `isGoldOnly=true`)

**Issue: Fine-tuning job fails**
- Check file format (must be valid JSONL)
- Verify each example has system/user/assistant messages
- Check OpenAI API quota and limits

**Issue: Fine-tuned model performs worse**
- Review your gold examples - may need better curation
- Try with more examples
- Check if fine-tuning completed successfully

