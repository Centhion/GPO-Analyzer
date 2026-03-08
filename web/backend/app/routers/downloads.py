"""
Downloads Router - Serves CLI-generated files for browser download

Files saved to /app/data/downloads/ by CLI commands can be downloaded
via URL. A background task automatically cleans up files older than TTL.

Security:
- Strict filename validation (no path traversal)
- Files served from dedicated downloads folder only
- Internal network tool - not for public internet exposure
"""

import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/downloads", tags=["Downloads"])


@router.get("/{filename}")
async def download_file(filename: str):
    """
    Download a CLI-generated file.
    
    Files are automatically deleted after TTL (default: 60 minutes).
    """
    settings = get_settings()
    
    # Security: prevent path traversal attacks
    if ".." in filename or "/" in filename or "\\" in filename:
        logger.warning(f"Path traversal attempt blocked: {filename}")
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Additional validation: only allow expected extensions
    allowed_extensions = {'.xlsx', '.csv', '.json', '.log', '.txt'}
    file_ext = Path(filename).suffix.lower()
    if file_ext not in allowed_extensions:
        logger.warning(f"Blocked file with disallowed extension: {filename}")
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    file_path = settings.download_folder / filename
    
    if not file_path.exists():
        raise HTTPException(
            status_code=404, 
            detail="File not found or expired (files are deleted after 60 minutes)"
        )
    
    # Determine media type
    media_types = {
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.log': 'text/plain',
        '.txt': 'text/plain',
    }
    media_type = media_types.get(file_ext, 'application/octet-stream')
    
    logger.info(f"Serving download: {filename}")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type
    )
