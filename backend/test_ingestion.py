"""
Test script to diagnose ingestion issues.
Run this to test ingestion of a specific candidate.
"""

import asyncio
import sys
import os
from dotenv import load_dotenv

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agents.filing_ingestion import ingest_filing_candidate

async def test_ingestion(candidate_id: str):
    """Test ingestion of a specific candidate."""
    print(f"Testing ingestion for candidate: {candidate_id}")
    print("=" * 60)
    
    try:
        document_id = await ingest_filing_candidate(candidate_id)
        if document_id:
            print(f"✅ SUCCESS: Document created with ID: {document_id}")
            return True
        else:
            print("❌ FAILED: No document ID returned")
            return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_ingestion.py <candidate_id>")
        print("\nTo get a candidate_id, check the filing_candidates table in Supabase")
        sys.exit(1)
    
    candidate_id = sys.argv[1]
    result = asyncio.run(test_ingestion(candidate_id))
    sys.exit(0 if result else 1)

