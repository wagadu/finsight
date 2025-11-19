"""
Filing Ingestion Bridge for FinSight Copilot

This module handles the ingestion of approved filing candidates by:
- Downloading the PDF from source URL
- Calling the existing /documents endpoint
- Recording ingestion metrics
- Linking to evaluation runs if needed
"""

import os
import io
import httpx
import asyncio
from datetime import datetime
from typing import Optional, Dict
from uuid import uuid4
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from bs4 import BeautifulSoup

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Supabase client initialization
supabase: Optional[Client] = None
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    logger.warning("SUPABASE_URL and SUPABASE_KEY not set. Database operations will fail.")

# Backend service URL for document ingestion
BACKEND_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001")


async def _find_sec_pdf_url(client: httpx.AsyncClient, html_url: str, headers: dict) -> Optional[str]:
    """
    Find the PDF URL from a SEC EDGAR HTML filing page.
    SEC filings have an index page that lists all documents.
    Many modern filings don't have PDFs - they're in XBRL/HTML format.
    
    Args:
        client: HTTP client
        html_url: URL to the HTML filing document
        headers: HTTP headers to use
        
    Returns:
        PDF URL if found, None otherwise
    """
    try:
        # Get the index page URL (replace the HTML filename with index.html)
        # Example: https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm
        # Becomes: https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/index.html
        if '/Archives/edgar/data/' in html_url:
            parts = html_url.rsplit('/', 1)
            if len(parts) == 2:
                base_url = parts[0]
                index_url = f"{base_url}/index.html"
                
                # Fetch the index page
                index_response = await client.get(index_url, headers=headers, follow_redirects=True)
                index_response.raise_for_status()
                
                # Parse HTML to find document links
                soup = BeautifulSoup(index_response.text, 'lxml')
                
                # Look for document table - SEC index pages have a table with document links
                # The table typically has rows with document descriptions and links
                pdf_links = []
                
                # Method 1: Look for links in table rows (SEC standard format)
                table_rows = soup.find_all('tr')
                for row in table_rows:
                    cells = row.find_all('td')
                    if len(cells) >= 3:  # SEC table has: Seq, Description, Document, Type, Size
                        # Look for document link in the row
                        doc_link = row.find('a', href=True)
                        if doc_link:
                            href = doc_link.get('href', '')
                            # Check if it's a PDF
                            if href.endswith('.pdf'):
                                pdf_links.append((href, doc_link.get_text(strip=True)))
                
                # Method 2: Look for any PDF links on the page
                all_links = soup.find_all('a', href=True)
                for link in all_links:
                    href = link.get('href', '')
                    if href.endswith('.pdf'):
                        if href not in [p[0] for p in pdf_links]:
                            pdf_links.append((href, link.get_text(strip=True)))
                
                # Filter for 10-K/20-F PDFs
                for href, text in pdf_links:
                    href_upper = href.upper()
                    text_upper = text.upper()
                    if any(form_type in href_upper or form_type in text_upper 
                           for form_type in ['10-K', '20-F', '10K', '20F']):
                        if href.startswith('http'):
                            return href
                        else:
                            return f"{base_url}/{href.lstrip('/')}"
                
                # If no form-specific PDF, return first PDF found
                if pdf_links:
                    href = pdf_links[0][0]
                    if href.startswith('http'):
                        return href
                    else:
                        return f"{base_url}/{href.lstrip('/')}"
        
        return None
    except Exception as e:
        logger.warning(f"Error finding PDF URL from {html_url}: {str(e)}")
        return None


async def ingest_filing_candidate(candidate_id: str) -> Optional[str]:
    """
    Ingest an approved filing candidate by downloading and processing it.
    
    Args:
        candidate_id: UUID of the filing_candidate to ingest
        
    Returns:
        document_id if successful, None otherwise
    """
    if not supabase:
        logger.error("Supabase client not initialized")
        return None
    
    try:
        # Fetch candidate details
        candidate_result = supabase.table("filing_candidates").select("*").eq("id", candidate_id).execute()
        if not candidate_result.data:
            logger.error(f"Candidate {candidate_id} not found")
            return None
        
        candidate = candidate_result.data[0]
        
        if candidate.get('status') not in ['pending', 'auto_approved']:
            logger.warning(f"Candidate {candidate_id} is not in a state for ingestion (status: {candidate.get('status')})")
            return None
        
        source_url = candidate.get('source_url')
        if not source_url:
            logger.error(f"Candidate {candidate_id} has no source_url")
            return None
        
        ticker = candidate.get('ticker', '')
        filing_type = candidate.get('filing_type', '')
        filing_year = candidate.get('filing_year', '')
        company_name = candidate.get('company_name', '')
        source = candidate.get('source', '')
        
        # Create document name
        document_name = f"{ticker} {filing_type} {filing_year} - {company_name}"
        
        # Create ingestion record
        ingestion_id = str(uuid4())
        ingestion_started_at = datetime.now()
        
        supabase.table("filing_ingestions").insert({
            "id": ingestion_id,
            "candidate_id": candidate_id,
            "status": "processing",
            "ingestion_started_at": ingestion_started_at.isoformat()
        }).execute()
        
        logger.info(f"Starting ingestion for candidate {candidate_id}: {document_name}")
        
        # Download PDF from source URL
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                # Set appropriate headers for SEC or other sources
                headers = {
                    "User-Agent": os.getenv("SEC_USER_AGENT", "FinSight Filing Scout (contact@example.com)"),
                    "Accept": "application/pdf,application/xhtml+xml,text/html,*/*"
                }
                
                # For SEC filings, if URL is HTML, find the PDF version
                if source == 'sec' and source_url.endswith('.htm'):
                    pdf_url = await _find_sec_pdf_url(client, source_url, headers)
                    if pdf_url:
                        logger.info(f"Found PDF URL: {pdf_url}")
                        source_url = pdf_url
                    else:
                        logger.warning(f"Could not find PDF for {source_url}, will try to parse HTML")
                
                response = await client.get(source_url, headers=headers, follow_redirects=True)
                response.raise_for_status()
                
                content_type = response.headers.get('content-type', '').lower()
                
                # Check if it's actually a PDF
                if 'application/pdf' in content_type or source_url.endswith('.pdf'):
                    pdf_content = response.content
                elif source_url.endswith('.htm') or 'text/html' in content_type:
                    # Try to extract PDF link from HTML or convert HTML
                    logger.warning(f"Received HTML instead of PDF from {source_url}, attempting to find PDF link")
                    pdf_url = await _find_sec_pdf_url(client, source_url, headers)
                    if pdf_url:
                        logger.info(f"Found PDF URL: {pdf_url}")
                        pdf_response = await client.get(pdf_url, headers=headers, follow_redirects=True)
                        pdf_response.raise_for_status()
                        pdf_content = pdf_response.content
                    else:
                        # Many SEC filings don't have PDFs - they're in XBRL/HTML format
                        # Extract text from HTML and process directly
                        logger.info(f"No PDF found for {source_url}, extracting text from HTML")
                        # Extract text from HTML
                        soup = BeautifulSoup(response.text, 'lxml')
                        # Remove script and style elements
                        for script in soup(["script", "style", "noscript"]):
                            script.decompose()
                        # Get text
                        html_text = soup.get_text()
                        # Clean up text
                        lines = (line.strip() for line in html_text.splitlines())
                        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                        text_content = '\n'.join(chunk for chunk in chunks if chunk)
                        
                        # Instead of uploading a file, directly create the document in the database
                        # and process it using the backend's internal functions
                        logger.info(f"Extracted {len(text_content)} characters from HTML, processing directly")
                        
                        # Import backend functions to process directly
                        try:
                            import sys
                            import importlib.util
                            # Import main module functions
                            main_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'main.py')
                            spec = importlib.util.spec_from_file_location("main", main_path)
                            main_module = importlib.util.module_from_spec(spec)
                            spec.loader.exec_module(main_module)
                            
                            chunk_text_by_pages = main_module.chunk_text_by_pages
                            generate_embedding = main_module.generate_embedding
                            
                            # Get OpenAI client from main module
                            openai_client = main_module.openai_client
                            
                            # Create document directly in database
                            doc_id = str(uuid4())
                            uploaded_at = datetime.now()
                            
                            supabase.table("documents").insert({
                                "id": doc_id,
                                "name": document_name,
                                "uploaded_at": uploaded_at.isoformat(),
                                "text_content": text_content
                            }).execute()
                            
                            # Split text into pages (simulate pages for chunking)
                            # Split by approximate page size (3000 chars per page)
                            page_size = 3000
                            pages = [text_content[i:i+page_size] for i in range(0, len(text_content), page_size)]
                            
                            # Chunk and embed
                            chunk_records = []
                            if pages and openai_client:
                                chunks = chunk_text_by_pages(pages)
                                logger.info(f"Created {len(chunks)} chunks from HTML text")
                                
                                # Generate embeddings and store chunks
                                for idx, chunk in enumerate(chunks):
                                    embedding = await generate_embedding(chunk["content"])
                                    if embedding and len(embedding) == 1536:
                                        page_num = (idx // max(1, len(chunks) // len(pages))) + 1 if pages else idx + 1
                                        chunk_records.append({
                                            "document_id": doc_id,
                                            "chunk_index": idx,
                                            "content": chunk["content"],
                                            "page_number": page_num,
                                            "embedding": embedding,
                                            "token_count": chunk.get("token_count", 0)
                                        })
                                
                                # Batch insert chunks
                                if chunk_records:
                                    batch_size = 20
                                    for i in range(0, len(chunk_records), batch_size):
                                        batch = chunk_records[i:i + batch_size]
                                        supabase.table("document_chunks").insert(batch).execute()
                                    
                                    logger.info(f"Stored {len(chunk_records)} chunks with embeddings")
                            
                            # Update ingestion record
                            ingestion_completed_at = datetime.now()
                            ingestion_duration_ms = int((ingestion_completed_at - ingestion_started_at).total_seconds() * 1000)
                            
                            chunk_count = len(chunk_records) if 'chunk_records' in locals() else 0
                            embedding_count = chunk_count
                            
                            supabase.table("filing_ingestions").update({
                                "document_id": doc_id,
                                "status": "completed",
                                "ingestion_completed_at": ingestion_completed_at.isoformat(),
                                "chunk_count": chunk_count,
                                "embedding_count": embedding_count,
                                "file_size_bytes": len(text_content),
                                "ingestion_duration_ms": ingestion_duration_ms
                            }).eq("id", ingestion_id).execute()
                            
                            # Update candidate status
                            supabase.table("filing_candidates").update({
                                "status": "ingested",
                                "status_changed_at": datetime.now().isoformat()
                            }).eq("id", candidate_id).execute()
                            
                            logger.info(f"Successfully processed HTML filing: {doc_id}")
                            
                            # Send webhook notification
                            try:
                                from agents.webhook_notifier import notify_ingestion_complete
                                await notify_ingestion_complete(
                                    candidate_id,
                                    doc_id,
                                    ticker,
                                    filing_type
                                )
                            except Exception as e:
                                logger.warning(f"Failed to send webhook notification: {str(e)}")
                            
                            return doc_id
                            
                        except ImportError:
                            # If we can't import backend functions, fall back to error
                            raise Exception(
                                f"SEC filing {source_url} is in HTML format. "
                                f"HTML processing requires backend functions. "
                                f"Error: Could not import backend processing functions."
                            )
                else:
                    pdf_content = response.content
                
                file_size = len(pdf_content)
                
                logger.info(f"Downloaded PDF: {file_size} bytes from {source_url}")
                
            except Exception as e:
                logger.error(f"Error downloading PDF from {source_url}: {str(e)}")
                supabase.table("filing_ingestions").update({
                    "status": "failed",
                    "error_message": f"Download failed: {str(e)}",
                    "ingestion_completed_at": datetime.now().isoformat()
                }).eq("id", ingestion_id).execute()
                return None
        
        # Upload to backend /documents endpoint
        try:
            # Create form data for multipart/form-data upload
            # Reset BytesIO position to start
            pdf_file = io.BytesIO(pdf_content)
            pdf_file.seek(0)
            
            files = {
                'file': (f"{document_name}.pdf", pdf_file, 'application/pdf')
            }
            data = {
                'name': document_name
            }
            
            # Call backend service
            backend_url = f"{BACKEND_SERVICE_URL}/documents"
            
            logger.info(f"Uploading to backend: {backend_url}")
            logger.info(f"File size: {file_size} bytes, Document name: {document_name}")
            
            async with httpx.AsyncClient(timeout=600.0) as client:
                # Use files and data parameters for multipart form upload
                response = await client.post(
                    backend_url,
                    files=files,
                    data=data
                )
                
                if not response.is_success:
                    try:
                        error_text = await response.aread()
                        if isinstance(error_text, bytes):
                            error_text = error_text.decode('utf-8')
                    except:
                        error_text = f"Status {response.status_code}"
                    logger.error(f"Backend returned error {response.status_code}: {error_text}")
                    raise Exception(f"Backend error {response.status_code}: {error_text}")
                
                response.raise_for_status()
                document_data = response.json()
                document_id = document_data.get('id')
                
                logger.info(f"Successfully ingested document: {document_id}")
                
        except httpx.HTTPStatusError as e:
            try:
                error_text = await e.response.aread() if hasattr(e.response, 'aread') else e.response.text
                if isinstance(error_text, bytes):
                    error_text = error_text.decode('utf-8')
            except:
                error_text = str(e)
            logger.error(f"HTTP error uploading to backend: {e.response.status_code} - {error_text}")
            supabase.table("filing_ingestions").update({
                "status": "failed",
                "error_message": f"Backend upload failed (HTTP {e.response.status_code}): {str(error_text)[:500]}",
                "ingestion_completed_at": datetime.now().isoformat()
            }).eq("id", ingestion_id).execute()
            return None
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            logger.error(f"Error uploading to backend: {str(e)}")
            logger.error(f"Traceback: {error_trace}")
            supabase.table("filing_ingestions").update({
                "status": "failed",
                "error_message": f"Backend upload failed: {str(e)}",
                "ingestion_completed_at": datetime.now().isoformat()
            }).eq("id", ingestion_id).execute()
            return None
        
        # Get document chunk count (for metrics)
        chunk_count = 0
        embedding_count = 0
        try:
            chunks_result = supabase.table("document_chunks").select("id, embedding").eq("document_id", document_id).execute()
            if chunks_result.data:
                chunk_count = len(chunks_result.data)
                embedding_count = sum(1 for chunk in chunks_result.data if chunk.get('embedding'))
        except Exception as e:
            logger.warning(f"Error fetching chunk count: {str(e)}")
        
        # Update ingestion record
        ingestion_completed_at = datetime.now()
        ingestion_duration_ms = int((ingestion_completed_at - ingestion_started_at).total_seconds() * 1000)
        
        supabase.table("filing_ingestions").update({
            "document_id": document_id,
            "status": "completed",
            "ingestion_completed_at": ingestion_completed_at.isoformat(),
            "chunk_count": chunk_count,
            "embedding_count": embedding_count,
            "file_size_bytes": file_size,
            "ingestion_duration_ms": ingestion_duration_ms
        }).eq("id", ingestion_id).execute()
        
        # Update candidate status
        supabase.table("filing_candidates").update({
            "status": "ingested",
            "status_changed_at": datetime.now().isoformat()
        }).eq("id", candidate_id).execute()
        
        logger.info(f"Ingestion completed for candidate {candidate_id} -> document {document_id}")
        
        # Send webhook notification
        try:
            from agents.webhook_notifier import notify_ingestion_complete
            await notify_ingestion_complete(
                candidate_id,
                document_id,
                ticker,
                filing_type
            )
        except Exception as e:
            logger.warning(f"Failed to send webhook notification: {str(e)}")
        
        return document_id
        
    except Exception as e:
        logger.error(f"Error ingesting candidate {candidate_id}: {str(e)}")
        # Update ingestion record as failed
        if 'ingestion_id' in locals():
            supabase.table("filing_ingestions").update({
                "status": "failed",
                "error_message": str(e),
                "ingestion_completed_at": datetime.now().isoformat()
            }).eq("id", ingestion_id).execute()
        
        # Send webhook notification for failure
        try:
            from agents.webhook_notifier import notify_ingestion_failed
            ticker = candidate.get('ticker', '') if 'candidate' in locals() else ''
            filing_type = candidate.get('filing_type', '') if 'candidate' in locals() else ''
            await notify_ingestion_failed(candidate_id, ticker, filing_type, str(e))
        except Exception as e2:
            logger.warning(f"Failed to send webhook notification: {str(e2)}")
        
        return None


async def process_approved_candidates() -> Dict:
    """
    Process all approved filing candidates that haven't been ingested yet.
    
    Returns:
        Dictionary with processing statistics
    """
    if not supabase:
        logger.error("Supabase client not initialized")
        return {"processed": 0, "succeeded": 0, "failed": 0}
    
    stats = {"processed": 0, "succeeded": 0, "failed": 0}
    
    try:
        # Fetch approved candidates that haven't been ingested
        result = supabase.table("filing_candidates").select("*").in_("status", ["auto_approved", "pending"]).execute()
        
        if not result.data:
            logger.info("No approved candidates to process")
            return stats
        
        candidates = result.data
        logger.info(f"Found {len(candidates)} approved candidates to process")
        
        for candidate in candidates:
            candidate_id = candidate.get('id')
            stats["processed"] += 1
            
            document_id = await ingest_filing_candidate(candidate_id)
            
            if document_id:
                stats["succeeded"] += 1
            else:
                stats["failed"] += 1
            
            # Small delay between ingestions
            await asyncio.sleep(1.0)
        
        logger.info(f"Processing completed. Stats: {stats}")
        
    except Exception as e:
        logger.error(f"Error processing approved candidates: {str(e)}")
    
    return stats


if __name__ == "__main__":
    # CLI entrypoint
    import argparse
    
    parser = argparse.ArgumentParser(description="FinSight Filing Ingestion Bridge")
    parser.add_argument("--candidate-id", type=str, help="Specific candidate ID to ingest")
    parser.add_argument("--process-all", action="store_true", help="Process all approved candidates")
    
    args = parser.parse_args()
    
    if args.candidate_id:
        document_id = asyncio.run(ingest_filing_candidate(args.candidate_id))
        if document_id:
            print(f"Successfully ingested: {document_id}")
        else:
            print("Ingestion failed")
    elif args.process_all:
        stats = asyncio.run(process_approved_candidates())
        print(f"Processed: {stats}")
    else:
        parser.print_help()

