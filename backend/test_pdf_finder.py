#!/usr/bin/env python3
"""Test PDF finder function"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import os
import sys
from dotenv import load_dotenv

load_dotenv()

async def test_find_pdf():
    """Test finding PDF from SEC index page"""
    # Test with one of the failing URLs
    html_url = "https://www.sec.gov/Archives/edgar/data/789019/000095017024087843/msft-20240630.htm"
    
    # Get index URL
    parts = html_url.rsplit('/', 1)
    index_url = f"{parts[0]}/index.html"
    
    print(f"Testing index URL: {index_url}\n")
    
    headers = {
        "User-Agent": os.getenv("SEC_USER_AGENT", "FinSight Filing Scout (contact@example.com)"),
        "Accept": "text/html,application/xhtml+xml"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(index_url, headers=headers, follow_redirects=True)
            response.raise_for_status()
            
            print(f"✅ Index page loaded: {response.status_code}")
            print(f"Content length: {len(response.text)} bytes\n")
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Find all links
            links = soup.find_all('a', href=True)
            print(f"Found {len(links)} total links on index page")
            
            # Look for PDF links
            pdf_links = [link for link in links if link.get('href', '').endswith('.pdf')]
            print(f"Found {len(pdf_links)} PDF links\n")
            
            if pdf_links:
                print("PDF links found:")
                for i, link in enumerate(pdf_links[:10], 1):  # Show first 10
                    href = link.get('href', '')
                    text = link.get_text(strip=True)
                    print(f"  {i}. Text: '{text}' | Href: '{href}'")
                
                # Try to find 10-K PDF specifically
                print("\nLooking for 10-K PDF...")
                for link in pdf_links:
                    href = link.get('href', '').upper()
                    text = link.get_text(strip=True).upper()
                    if '10-K' in href or '10-K' in text or '10K' in href or '10K' in text:
                        base_url = '/'.join(index_url.split('/')[:-1])
                        full_url = f"{base_url}/{link.get('href')}"
                        print(f"✅ Found 10-K PDF: {full_url}")
                        return full_url
                
                # If no 10-K, return first PDF
                base_url = '/'.join(index_url.split('/')[:-1])
                full_url = f"{base_url}/{pdf_links[0].get('href')}"
                print(f"⚠️  No 10-K PDF found, using first PDF: {full_url}")
                return full_url
            else:
                print("❌ No PDF links found on index page")
                print("\nAll links (first 20):")
                for i, link in enumerate(links[:20], 1):
                    href = link.get('href', '')
                    text = link.get_text(strip=True)[:50]
                    print(f"  {i}. '{text}' -> '{href}'")
                return None
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

if __name__ == "__main__":
    result = asyncio.run(test_find_pdf())
    if result:
        print(f"\n✅ Success! PDF URL: {result}")
    else:
        print("\n❌ Failed to find PDF")

