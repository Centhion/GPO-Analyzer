"""
Audit Logging for GPO Analyzer

Logs all authenticated requests with user, IP, timestamp, and action.
Format: JSON for easy parsing and SIEM integration.
"""
import logging
from datetime import datetime, timezone
from pathlib import Path
import json
import socket
from typing import Optional

from fastapi import Request

from .config import get_settings

# Separate logger for audit trail
audit_logger = logging.getLogger("audit")


def setup_audit_logger() -> logging.Logger:
    """Configure audit log file handler."""
    settings = get_settings()
    
    # Ensure log directory exists
    log_path = Path(settings.audit_log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Create file handler
    handler = logging.FileHandler(log_path)
    handler.setLevel(logging.INFO)
    
    # Simple format - we'll write JSON ourselves
    formatter = logging.Formatter('%(message)s')
    handler.setFormatter(formatter)
    
    # Configure logger
    audit_logger.handlers = []  # Remove any existing handlers
    audit_logger.addHandler(handler)
    audit_logger.setLevel(logging.INFO)
    audit_logger.propagate = False  # Don't bubble up to root logger
    
    return audit_logger


def resolve_hostname(ip: str) -> str:
    """Attempt reverse DNS lookup for IP address."""
    if not ip or ip == "unknown":
        return ""
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return hostname
    except (socket.herror, socket.gaierror, socket.timeout):
        return ""


def log_access(
    request: Request,
    user_email: str,
    user_name: str,
    user_id: str,
    status_code: int = 200,
    error: Optional[str] = None
) -> None:
    """
    Log an authenticated request to audit log.
    
    Log entry format (JSON):
    {
        "timestamp": "2025-12-22T14:32:05Z",
        "user": "jdoe@example.com",
        "user_name": "Jane Doe",
        "user_id": "abc-123-def",
        "ip": "10.99.19.50",
        "hostname": "DESKTOP-JDOE.corp.example.com",
        "user_agent": "Chrome/143 Win10",
        "method": "GET",
        "path": "/api/migration/domains",
        "query": "domain=alpha",
        "status": 200,
        "error": null
    }
    """
    ip = request.client.host if request.client else "unknown"
    
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user_email,
        "user_name": user_name,
        "user_id": user_id,
        "ip": ip,
        "hostname": resolve_hostname(ip),
        "user_agent": request.headers.get("user-agent", "")[:200],  # Truncate long UA strings
        "method": request.method,
        "path": request.url.path,
        "query": str(request.query_params) if request.query_params else "",
        "status": status_code,
        "error": error,
    }
    
    audit_logger.info(json.dumps(entry))


class AuditMiddleware:
    """
    Middleware to automatically log all API requests.
    
    Usage: Add to FastAPI app middleware stack.
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Process request normally
        await self.app(scope, receive, send)
