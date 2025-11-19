"""
CLI entrypoint for the Filing Scout agent.

Usage:
    python -m backend.agents.filing_scout --dry-run --limit 5
    python -m backend.agents.filing_scout --dry-run
    python -m backend.agents.filing_scout
"""

import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.filing_scout import run_filing_scan

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="FinSight Filing Scout Agent - Autonomous filing discovery and ingestion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (no database writes) with limit
  python -m backend.agents.filing_scout --dry-run --limit 5
  
  # Dry run (no database writes)
  python -m backend.agents.filing_scout --dry-run
  
  # Full scan (writes to database)
  python -m backend.agents.filing_scout
  
  # Full scan with limit per company
  python -m backend.agents.filing_scout --limit 10
        """
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't insert candidates into database (safe for testing)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of candidates to process per company"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("FinSight Filing Scout Agent")
    print("=" * 60)
    if args.dry_run:
        print("Mode: DRY RUN (no database writes)")
    else:
        print("Mode: PRODUCTION (will write to database)")
    if args.limit:
        print(f"Limit: {args.limit} candidates per company")
    print("=" * 60)
    print()
    
    try:
        stats = asyncio.run(run_filing_scan(dry_run=args.dry_run, limit=args.limit))
        
        print()
        print("=" * 60)
        print("Scan Results")
        print("=" * 60)
        import json
        print(json.dumps(stats, indent=2))
        print("=" * 60)
        
        if stats.get("errors", 0) > 0:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nScan interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

