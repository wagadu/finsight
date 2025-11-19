#!/usr/bin/env python3
"""Check ingestion status from database"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY not set in .env file")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("CHECKING INGESTION STATUS")
print("=" * 80)

# Check recent ingestions
print("\n1. Recent Ingestion Records:")
print("-" * 80)
result = supabase.table("filing_ingestions").select(
    "id, candidate_id, status, error_message, document_id, ingestion_started_at, ingestion_completed_at"
).order("ingestion_started_at", desc=True).limit(5).execute()

if result.data:
    for record in result.data:
        print(f"\nStatus: {record.get('status')}")
        print(f"Error: {record.get('error_message') or 'None'}")
        print(f"Document ID: {record.get('document_id') or 'None'}")
        print(f"Started: {record.get('ingestion_started_at')}")
        if record.get('error_message'):
            print(f"⚠️  ERROR: {record.get('error_message')}")
        print("-" * 80)
else:
    print("No ingestion records found")

# Check failed ingestions
print("\n\n2. Failed Ingestions (Last 3):")
print("-" * 80)
failed = supabase.table("filing_ingestions").select(
    "candidate_id, error_message, ingestion_started_at"
).eq("status", "failed").order("ingestion_started_at", desc=True).limit(3).execute()

if failed.data:
    for record in failed.data:
        print(f"\nCandidate ID: {record.get('candidate_id')}")
        print(f"Error: {record.get('error_message')}")
        print(f"Time: {record.get('ingestion_started_at')}")
        print("-" * 80)
else:
    print("No failed ingestions found")

# Check auto-approved candidates without successful ingestion
print("\n\n3. Auto-Approved Candidates (checking ingestion status):")
print("-" * 80)
candidates = supabase.table("filing_candidates").select(
    "id, ticker, filing_type, filing_year, status"
).eq("status", "auto_approved").order("created_at", desc=True).limit(5).execute()

if candidates.data:
    for candidate in candidates.data:
        candidate_id = candidate.get('id')
        ingestion = supabase.table("filing_ingestions").select("*").eq("candidate_id", candidate_id).order("ingestion_started_at", desc=True).limit(1).execute()
        
        print(f"\n{candidate.get('ticker')} {candidate.get('filing_type')} {candidate.get('filing_year')}")
        print(f"  Candidate ID: {candidate_id}")
        
        if ingestion.data:
            ing = ingestion.data[0]
            print(f"  Ingestion Status: {ing.get('status')}")
            if ing.get('error_message'):
                print(f"  ⚠️  ERROR: {ing.get('error_message')}")
            if ing.get('document_id'):
                print(f"  ✅ Document ID: {ing.get('document_id')}")
        else:
            print(f"  ⚠️  No ingestion record found")
        print("-" * 80)
else:
    print("No auto-approved candidates found")

print("\n" + "=" * 80)

