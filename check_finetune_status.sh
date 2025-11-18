#!/bin/bash
# Quick script to check fine-tuning job status

export OPENAI_API_KEY=$(grep "^OPENAI_API_KEY=" backend/.env | cut -d'=' -f2-)
JOB_ID="ftjob-QHKf9PaClLGGxHeThfNPBmPi"

python3 << EOF
from openai import OpenAI
import os

client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
job = client.fine_tuning.jobs.retrieve("${JOB_ID}")

print(f"📊 Fine-tuning Job Status")
print(f"   Job ID: {job.id}")
print(f"   Status: {job.status}")
print(f"   Model: {job.model}")

if job.fine_tuned_model:
    print(f"\n✅ Fine-tuning complete!")
    print(f"   Fine-tuned model: {job.fine_tuned_model}")
    print(f"\n📝 Update your backend/.env file:")
    print(f"   FT_MODEL={job.fine_tuned_model}")
elif job.status in ['validating_files', 'queued', 'running']:
    print(f"\n⏳ Status: {job.status}")
    if hasattr(job, 'trained_tokens') and job.trained_tokens:
        print(f"   Trained tokens: {job.trained_tokens}")
else:
    print(f"\n   Current status: {job.status}")
EOF

