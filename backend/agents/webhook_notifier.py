"""
Webhook notification module for filing agent events.
Sends notifications to Slack, Discord, or custom webhooks when important events occur.
"""

import os
import json
import httpx
import asyncio
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

# Webhook configuration
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
CUSTOM_WEBHOOK_URL = os.getenv("FILING_AGENT_WEBHOOK_URL")
WEBHOOK_ENABLED = os.getenv("FILING_AGENT_WEBHOOK_ENABLED", "false").lower() == "true"


async def send_webhook_notification(
    event_type: str,
    title: str,
    message: str,
    data: Optional[Dict] = None,
    priority: str = "info"
) -> bool:
    """
    Send a webhook notification for filing agent events.
    
    Args:
        event_type: Type of event (e.g., 'new_filing', 'ingestion_complete', 'ingestion_failed')
        title: Notification title
        message: Notification message
        data: Additional data to include
        priority: Priority level ('info', 'warning', 'error')
        
    Returns:
        True if notification sent successfully, False otherwise
    """
    if not WEBHOOK_ENABLED:
        return False
    
    payload = {
        "event_type": event_type,
        "title": title,
        "message": message,
        "priority": priority,
        "timestamp": asyncio.get_event_loop().time(),
        "data": data or {}
    }
    
    # Try Slack webhook
    if SLACK_WEBHOOK_URL:
        try:
            slack_payload = {
                "text": title,
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": title
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": message
                        }
                    }
                ]
            }
            
            if data:
                fields = []
                for key, value in data.items():
                    fields.append({
                        "type": "mrkdwn",
                        "text": f"*{key}*: {value}"
                    })
                slack_payload["blocks"].append({
                    "type": "section",
                    "fields": fields
                })
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(SLACK_WEBHOOK_URL, json=slack_payload)
                response.raise_for_status()
                logger.info(f"Sent Slack notification: {event_type}")
                return True
        except Exception as e:
            logger.warning(f"Failed to send Slack notification: {str(e)}")
    
    # Try Discord webhook
    if DISCORD_WEBHOOK_URL:
        try:
            color_map = {
                "info": 0x3498db,
                "warning": 0xf39c12,
                "error": 0xe74c3c
            }
            
            discord_payload = {
                "embeds": [{
                    "title": title,
                    "description": message,
                    "color": color_map.get(priority, 0x3498db),
                    "fields": [
                        {"name": k, "value": str(v), "inline": True}
                        for k, v in (data or {}).items()
                    ],
                    "timestamp": payload["timestamp"]
                }]
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(DISCORD_WEBHOOK_URL, json=discord_payload)
                response.raise_for_status()
                logger.info(f"Sent Discord notification: {event_type}")
                return True
        except Exception as e:
            logger.warning(f"Failed to send Discord notification: {str(e)}")
    
    # Try custom webhook
    if CUSTOM_WEBHOOK_URL:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(CUSTOM_WEBHOOK_URL, json=payload)
                response.raise_for_status()
                logger.info(f"Sent custom webhook notification: {event_type}")
                return True
        except Exception as e:
            logger.warning(f"Failed to send custom webhook notification: {str(e)}")
    
    return False


async def notify_new_filing(ticker: str, company_name: str, filing_type: str, filing_year: int, source: str):
    """Notify about a new filing candidate discovered."""
    await send_webhook_notification(
        event_type="new_filing",
        title="New Filing Discovered",
        message=f"Found {filing_type} {filing_year} for {ticker} ({company_name})",
        data={
            "Ticker": ticker,
            "Company": company_name,
            "Filing Type": filing_type,
            "Year": str(filing_year),
            "Source": source
        },
        priority="info"
    )


async def notify_ingestion_complete(candidate_id: str, document_id: str, ticker: str, filing_type: str):
    """Notify about successful ingestion."""
    await send_webhook_notification(
        event_type="ingestion_complete",
        title="Filing Ingested Successfully",
        message=f"Successfully ingested {filing_type} for {ticker}",
        data={
            "Candidate ID": candidate_id,
            "Document ID": document_id,
            "Ticker": ticker,
            "Filing Type": filing_type
        },
        priority="info"
    )


async def notify_ingestion_failed(candidate_id: str, ticker: str, filing_type: str, error: str):
    """Notify about failed ingestion."""
    await send_webhook_notification(
        event_type="ingestion_failed",
        title="Filing Ingestion Failed",
        message=f"Failed to ingest {filing_type} for {ticker}: {error}",
        data={
            "Candidate ID": candidate_id,
            "Ticker": ticker,
            "Filing Type": filing_type,
            "Error": error
        },
        priority="error"
    )


async def notify_high_priority_filing(ticker: str, company_name: str, filing_type: str, filing_year: int):
    """Notify about a high-priority filing (e.g., from a watchlist company with high priority)."""
    await send_webhook_notification(
        event_type="high_priority_filing",
        title="High-Priority Filing Discovered",
        message=f"New {filing_type} {filing_year} for high-priority company {ticker}",
        data={
            "Ticker": ticker,
            "Company": company_name,
            "Filing Type": filing_type,
            "Year": str(filing_year)
        },
        priority="warning"
    )

