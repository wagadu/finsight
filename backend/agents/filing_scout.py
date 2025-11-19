"""
Filing Scout Agent for FinSight Copilot

This module provides autonomous filing discovery and ingestion capabilities:
- Monitors SEC EDGAR for new 10-K and 20-F filings
- Scrapes AnnualReports.com for international issuers
- Deduplicates candidates against existing documents
- Queues candidates for approval/ingestion
"""

import os
import json
import hashlib
import asyncio
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from uuid import uuid4
import logging
from dotenv import load_dotenv
import httpx
from bs4 import BeautifulSoup
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "module": "%(name)s", "message": "%(message)s"}',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# SEC API configuration
SEC_BASE_URL = "https://data.sec.gov"
SEC_RATE_LIMIT_DELAY = 0.1  # 100ms between requests (10 req/sec max per SEC guidelines)
SEC_USER_AGENT = os.getenv(
    "SEC_USER_AGENT",
    "FinSight Filing Scout (contact@example.com)"  # SEC requires contact email
)

# AnnualReports.com configuration
ANNUALREPORTS_BASE_URL = "https://www.annualreports.com"
ANNUALREPORTS_SELECTOR_CONFIG = {
    "company_search": os.getenv("ANNUALREPORTS_SEARCH_SELECTOR", "input[name='search']"),
    "report_list": os.getenv("ANNUALREPORTS_REPORT_LIST_SELECTOR", ".report-list"),
    "report_link": os.getenv("ANNUALREPORTS_REPORT_LINK_SELECTOR", "a.report-link"),
    "download_link": os.getenv("ANNUALREPORTS_DOWNLOAD_SELECTOR", "a.download-pdf")
}

# Supabase client initialization
supabase: Optional[Client] = None
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    logger.warning("SUPABASE_URL and SUPABASE_KEY not set. Database operations will fail.")


class FilingScout:
    """
    Autonomous filing discovery agent that monitors SEC EDGAR and AnnualReports.com
    for new annual reports and queues them for ingestion.
    """
    
    def __init__(self, dry_run: bool = False, limit: Optional[int] = None):
        """
        Initialize the Filing Scout agent.
        
        Args:
            dry_run: If True, don't insert candidates into database
            limit: Maximum number of candidates to process per company
        """
        self.dry_run = dry_run
        self.limit = limit
        self.http_client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": SEC_USER_AGENT,
                "Accept-Encoding": "gzip, deflate",
                "Accept": "application/json"
            }
        )
        self.stats = {
            "companies_checked": 0,
            "candidates_found": 0,
            "candidates_inserted": 0,
            "duplicates_skipped": 0,
            "errors": 0
        }
    
    async def close(self):
        """Close HTTP client connections."""
        await self.http_client.aclose()
    
    def _format_cik(self, cik: str) -> str:
        """Format CIK to 10 digits with leading zeros."""
        if not cik:
            return ""
        # Remove any non-digit characters
        cik_clean = ''.join(filter(str.isdigit, str(cik)))
        # Pad to 10 digits
        return cik_clean.zfill(10)
    
    async def _fetch_sec_submissions(self, cik: str) -> Optional[Dict]:
        """
        Fetch SEC submissions JSON for a given CIK.
        Respects SEC rate limits and User-Agent requirements.
        
        Args:
            cik: SEC Central Index Key (10 digits, zero-padded)
            
        Returns:
            JSON data from SEC API or None if error
        """
        cik_formatted = self._format_cik(cik)
        if not cik_formatted:
            logger.warning(f"Invalid CIK format: {cik}")
            return None
        
        url = f"{SEC_BASE_URL}/submissions/CIK{cik_formatted}.json"
        
        try:
            # Respect SEC rate limits
            await asyncio.sleep(SEC_RATE_LIMIT_DELAY)
            
            response = await self.http_client.get(url)
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"Fetched SEC submissions for CIK {cik_formatted}: {len(data.get('filings', {}).get('recent', {}).get('form', []))} filings")
            return data
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"CIK {cik_formatted} not found in SEC database")
            else:
                logger.error(f"HTTP error fetching SEC submissions for CIK {cik_formatted}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching SEC submissions for CIK {cik_formatted}: {str(e)}")
            return None
    
    def _parse_sec_filings(self, submissions_data: Dict, filing_types: List[str] = None) -> List[Dict]:
        """
        Parse SEC submissions JSON to extract relevant filings.
        
        Args:
            submissions_data: JSON response from SEC submissions API
            filing_types: List of form types to filter (default: ['10-K', '20-F'])
            
        Returns:
            List of filing dictionaries with metadata
        """
        if filing_types is None:
            filing_types = ['10-K', '20-F']
        
        filings = []
        recent = submissions_data.get('filings', {}).get('recent', {})
        
        forms = recent.get('form', [])
        filing_dates = recent.get('filingDate', [])
        report_dates = recent.get('reportDate', [])
        accession_numbers = recent.get('accessionNumber', [])
        primary_documents = recent.get('primaryDocument', [])
        
        for idx, form_type in enumerate(forms):
            if form_type in filing_types:
                # Extract filing year from report date or filing date
                filing_date_str = filing_dates[idx] if idx < len(filing_dates) else None
                report_date_str = report_dates[idx] if idx < len(report_dates) else None
                
                # Prefer report date, fallback to filing date
                date_str = report_date_str or filing_date_str
                filing_year = None
                if date_str:
                    try:
                        filing_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                        filing_year = filing_date.year
                    except:
                        pass
                
                if not filing_year:
                    # Try to extract from current year if date parsing fails
                    filing_year = datetime.now().year
                
                accession_number = accession_numbers[idx] if idx < len(accession_numbers) else None
                primary_doc = primary_documents[idx] if idx < len(primary_documents) else None
                
                # Build SEC document URL
                if accession_number:
                    # Format: https://www.sec.gov/Archives/edgar/data/{CIK}/{accession_number}/{primary_doc}
                    cik = submissions_data.get('cik', '').lstrip('0')
                    doc_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_number.replace('-', '')}/{primary_doc}"
                else:
                    doc_url = None
                
                filings.append({
                    'form_type': form_type,
                    'filing_date': filing_date_str,
                    'report_date': report_date_str,
                    'filing_year': filing_year,
                    'accession_number': accession_number,
                    'primary_document': primary_doc,
                    'document_url': doc_url
                })
        
        return filings
    
    async def _fetch_annualreports_com(self, ticker: str, company_name: str) -> List[Dict]:
        """
        Fetch annual reports from AnnualReports.com for a given company.
        Uses HTML scraping with BeautifulSoup.
        
        Args:
            ticker: Stock ticker symbol
            company_name: Company name for search
            
        Returns:
            List of filing dictionaries with metadata
        """
        filings = []
        
        try:
            # Search for company
            search_url = f"{ANNUALREPORTS_BASE_URL}/Companies"
            search_params = {"search": company_name or ticker}
            
            await asyncio.sleep(1.0)  # Be respectful with scraping
            
            response = await self.http_client.get(search_url, params=search_params)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Find company links (heuristic: look for links containing ticker or company name)
            # This is a simplified approach - in production, you'd want more robust selectors
            company_links = soup.find_all('a', href=True)
            
            for link in company_links:
                href = link.get('href', '')
                text = link.get_text(strip=True)
                
                # Heuristic: if link text contains ticker or company name, it might be the company page
                if ticker.lower() in text.lower() or (company_name and company_name.lower() in text.lower()):
                    # Follow link to company page
                    company_url = href if href.startswith('http') else f"{ANNUALREPORTS_BASE_URL}{href}"
                    
                    try:
                        await asyncio.sleep(1.0)
                        company_page = await self.http_client.get(company_url)
                        company_page.raise_for_status()
                        
                        company_soup = BeautifulSoup(company_page.text, 'lxml')
                        
                        # Find annual report links (heuristic: look for PDF links with "annual" or year)
                        pdf_links = company_soup.find_all('a', href=True)
                        for pdf_link in pdf_links:
                            href = pdf_link.get('href', '')
                            text = pdf_link.get_text(strip=True)
                            
                            if '.pdf' in href.lower() or 'annual' in text.lower():
                                # Extract year from text or URL
                                import re
                                year_match = re.search(r'\b(20\d{2})\b', text + href)
                                filing_year = int(year_match.group(1)) if year_match else datetime.now().year
                                
                                pdf_url = href if href.startswith('http') else f"{ANNUALREPORTS_BASE_URL}{href}"
                                
                                filings.append({
                                    'form_type': 'annual-report',
                                    'filing_date': None,
                                    'report_date': None,
                                    'filing_year': filing_year,
                                    'accession_number': None,
                                    'primary_document': None,
                                    'document_url': pdf_url,
                                    'source_reliability': 'medium'  # AnnualReports.com is less reliable than SEC
                                })
                                
                                if self.limit and len(filings) >= self.limit:
                                    break
                        
                        break  # Found company, stop searching
                    except Exception as e:
                        logger.warning(f"Error fetching AnnualReports.com page {company_url}: {str(e)}")
                        continue
            
            logger.info(f"Found {len(filings)} filings on AnnualReports.com for {ticker}")
            
        except Exception as e:
            logger.error(f"Error scraping AnnualReports.com for {ticker}: {str(e)}")
        
        return filings
    
    async def _compute_sha256(self, url: str) -> Optional[str]:
        """
        Compute SHA256 checksum of a document at the given URL.
        Used for deduplication.
        
        Args:
            url: URL to the document
            
        Returns:
            SHA256 hex digest or None if error
        """
        try:
            response = await self.http_client.get(url, follow_redirects=True)
            response.raise_for_status()
            
            content = response.content
            sha256 = hashlib.sha256(content).hexdigest()
            return sha256
            
        except Exception as e:
            logger.warning(f"Error computing SHA256 for {url}: {str(e)}")
            return None
    
    async def _check_duplicate(self, sha256: Optional[str], accession_number: Optional[str], 
                              cik: Optional[str], filing_type: str, filing_year: int) -> bool:
        """
        Check if a filing is a duplicate by comparing against:
        1. Existing documents (by name pattern)
        2. Existing filing_candidates (by checksum, accession number, or CIK+type+year)
        
        Args:
            sha256: SHA256 checksum of the filing
            accession_number: SEC accession number
            cik: SEC CIK
            filing_type: Type of filing (10-K, 20-F, etc.)
            filing_year: Filing year
            
        Returns:
            True if duplicate, False otherwise
        """
        if not supabase:
            return False
        
        try:
            # Check by SHA256 checksum
            if sha256:
                result = supabase.table("filing_candidates").select("id").eq("sha256_checksum", sha256).execute()
                if result.data:
                    return True
            
            # Check by accession number (SEC)
            if accession_number:
                result = supabase.table("filing_candidates").select("id").eq("accession_number", accession_number).execute()
                if result.data:
                    return True
            
            # Check by CIK + filing_type + filing_year
            if cik:
                result = supabase.table("filing_candidates").select("id").eq("cik", cik).eq("filing_type", filing_type).eq("filing_year", filing_year).execute()
                if result.data:
                    return True
            
            # Check existing documents by name pattern (heuristic)
            # Look for documents with similar names (e.g., "AAPL 10-K 2023")
            if cik and filing_type and filing_year:
                name_pattern = f"%{filing_type}%{filing_year}%"
                result = supabase.table("documents").select("id").ilike("name", name_pattern).execute()
                if result.data:
                    # Additional check: could be enhanced with fuzzy matching
                    logger.info(f"Potential duplicate document found by name pattern: {name_pattern}")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking for duplicates: {str(e)}")
            return False
    
    async def _insert_candidate(self, watchlist_entry: Dict, filing: Dict, sha256: Optional[str] = None) -> bool:
        """
        Insert a filing candidate into the database.
        
        Args:
            watchlist_entry: Entry from filing_watchlist table
            filing: Filing metadata dictionary
            sha256: SHA256 checksum of the filing (optional)
            
        Returns:
            True if inserted successfully, False otherwise
        """
        if self.dry_run:
            logger.info(f"[DRY RUN] Would insert candidate: {filing.get('form_type')} {filing.get('filing_year')} for {watchlist_entry.get('ticker')}")
            return True
        
        if not supabase:
            logger.error("Supabase client not initialized")
            return False
        
        try:
            # Parse filing date
            filing_date = None
            if filing.get('filing_date'):
                try:
                    filing_date = datetime.strptime(filing['filing_date'], '%Y-%m-%d').date().isoformat()
                except:
                    pass
            
            candidate_data = {
                "watchlist_id": watchlist_entry.get('id'),
                "ticker": watchlist_entry.get('ticker'),
                "cik": watchlist_entry.get('cik'),
                "company_name": watchlist_entry.get('company_name'),
                "source": watchlist_entry.get('source', 'sec'),
                "source_url": filing.get('document_url', ''),
                "filing_type": filing.get('form_type'),
                "filing_year": filing.get('filing_year'),
                "filing_date": filing_date,
                "accession_number": filing.get('accession_number'),
                "sha256_checksum": sha256,
                "status": "pending",
                "metadata": {
                    "primary_document": filing.get('primary_document'),
                    "report_date": filing.get('report_date'),
                    "source_reliability": filing.get('source_reliability', 'high' if watchlist_entry.get('source') == 'sec' else 'medium')
                }
            }
            
            result = supabase.table("filing_candidates").insert(candidate_data).execute()
            
            if result.data:
                logger.info(f"Inserted candidate: {candidate_data['ticker']} {candidate_data['filing_type']} {candidate_data['filing_year']}")
                return True
            else:
                logger.warning(f"Failed to insert candidate: {candidate_data}")
                return False
                
        except Exception as e:
            # Check if it's a unique constraint violation (duplicate)
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                logger.info(f"Duplicate candidate skipped: {watchlist_entry.get('ticker')} {filing.get('form_type')} {filing.get('filing_year')}")
                self.stats["duplicates_skipped"] += 1
                return False
            else:
                logger.error(f"Error inserting candidate: {str(e)}")
                self.stats["errors"] += 1
                return False
    
    async def _process_company(self, watchlist_entry: Dict) -> int:
        """
        Process a single company from the watchlist.
        
        Args:
            watchlist_entry: Entry from filing_watchlist table
            
        Returns:
            Number of new candidates found
        """
        ticker = watchlist_entry.get('ticker')
        cik = watchlist_entry.get('cik')
        company_name = watchlist_entry.get('company_name')
        source = watchlist_entry.get('source', 'sec')
        
        logger.info(f"Processing company: {ticker} ({company_name}) from {source}")
        self.stats["companies_checked"] += 1
        
        candidates_found = 0
        
        try:
            if source == 'sec' and cik:
                # Fetch SEC submissions
                submissions_data = await self._fetch_sec_submissions(cik)
                if not submissions_data:
                    return 0
                
                # Parse filings
                filings = self._parse_sec_filings(submissions_data)
                
                # Process each filing
                for filing in filings[:self.limit] if self.limit else filings:
                    # Compute checksum for deduplication
                    doc_url = filing.get('document_url')
                    sha256 = None
                    if doc_url:
                        sha256 = await self._compute_sha256(doc_url)
                    
                    # Check for duplicates
                    is_duplicate = await self._check_duplicate(
                        sha256,
                        filing.get('accession_number'),
                        cik,
                        filing.get('form_type'),
                        filing.get('filing_year')
                    )
                    
                    if is_duplicate:
                        self.stats["duplicates_skipped"] += 1
                        continue
                    
                    # Insert candidate
                    if await self._insert_candidate(watchlist_entry, filing, sha256):
                        candidates_found += 1
                        self.stats["candidates_found"] += 1
                        self.stats["candidates_inserted"] += 1
                        
                        # Send webhook notification for high-priority companies
                        if watchlist_entry.get('priority', 0) >= 8:
                            try:
                                from agents.webhook_notifier import notify_high_priority_filing
                                await notify_high_priority_filing(
                                    ticker,
                                    company_name,
                                    filing.get('form_type'),
                                    filing.get('filing_year')
                                )
                            except Exception as e:
                                logger.warning(f"Failed to send webhook notification: {str(e)}")
                
            elif source == 'annualreports':
                # Fetch from AnnualReports.com
                filings = await self._fetch_annualreports_com(ticker, company_name)
                
                # Process each filing
                for filing in filings[:self.limit] if self.limit else filings:
                    # Compute checksum
                    doc_url = filing.get('document_url')
                    sha256 = None
                    if doc_url:
                        sha256 = await self._compute_sha256(doc_url)
                    
                    # Check for duplicates
                    is_duplicate = await self._check_duplicate(
                        sha256,
                        None,  # No accession number for AnnualReports
                        None,  # May not have CIK
                        filing.get('form_type'),
                        filing.get('filing_year')
                    )
                    
                    if is_duplicate:
                        self.stats["duplicates_skipped"] += 1
                        continue
                    
                    # Insert candidate
                    if await self._insert_candidate(watchlist_entry, filing, sha256):
                        candidates_found += 1
                        self.stats["candidates_found"] += 1
                        self.stats["candidates_inserted"] += 1
            
            # Update last_polled_at timestamp
            if not self.dry_run and supabase:
                supabase.table("filing_watchlist").update({
                    "last_polled_at": datetime.now().isoformat()
                }).eq("id", watchlist_entry.get('id')).execute()
            
        except Exception as e:
            logger.error(f"Error processing company {ticker}: {str(e)}")
            self.stats["errors"] += 1
        
        return candidates_found
    
    async def run_scan(self) -> Dict:
        """
        Run a full scan of all active companies in the watchlist.
        
        Returns:
            Dictionary with scan statistics
        """
        if not supabase:
            logger.error("Supabase client not initialized")
            return self.stats
        
        logger.info("Starting filing scan...")
        
        try:
            # Fetch active watchlist entries
            result = supabase.table("filing_watchlist").select("*").eq("is_active", True).order("priority", desc=True).execute()
            
            if not result.data:
                logger.warning("No active companies in watchlist")
                return self.stats
            
            watchlist_entries = result.data
            logger.info(f"Found {len(watchlist_entries)} active companies in watchlist")
            
            # Process each company
            for entry in watchlist_entries:
                await self._process_company(entry)
                # Small delay between companies to be respectful
                await asyncio.sleep(0.5)
            
            logger.info(f"Scan completed. Stats: {json.dumps(self.stats, indent=2)}")
            
        except Exception as e:
            logger.error(f"Error during scan: {str(e)}")
            self.stats["errors"] += 1
        
        return self.stats


async def run_filing_scan(dry_run: bool = False, limit: Optional[int] = None) -> Dict:
    """
    Main entrypoint for running a filing scan.
    
    Args:
        dry_run: If True, don't insert candidates into database
        limit: Maximum number of candidates to process per company
        
    Returns:
        Dictionary with scan statistics
    """
    scout = FilingScout(dry_run=dry_run, limit=limit)
    try:
        stats = await scout.run_scan()
        return stats
    finally:
        await scout.close()


if __name__ == "__main__":
    # CLI entrypoint
    import argparse
    
    parser = argparse.ArgumentParser(description="FinSight Filing Scout Agent")
    parser.add_argument("--dry-run", action="store_true", help="Don't insert candidates into database")
    parser.add_argument("--limit", type=int, help="Maximum number of candidates per company")
    
    args = parser.parse_args()
    
    stats = asyncio.run(run_filing_scan(dry_run=args.dry_run, limit=args.limit))
    print(json.dumps(stats, indent=2))

