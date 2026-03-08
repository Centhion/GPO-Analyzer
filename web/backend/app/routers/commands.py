"""
CLI Commands Router

Secure execution of CLI-only reports (Impact, Full).
No shell access - commands built as arrays with validated inputs.
"""

import subprocess
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.analyzer import analyzer_service
from ..config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/commands", tags=["CLI Commands"])


# ==============================================================================
# Request/Response Models
# ==============================================================================

class ImpactRequest(BaseModel):
    domain: str


class CommandResponse(BaseModel):
    success: bool
    output: str
    download_url: Optional[str] = None
    filename: Optional[str] = None
    execution_time_seconds: Optional[float] = None
    error: Optional[str] = None


# ==============================================================================
# Validation Helpers
# ==============================================================================

def get_domains_with_labels() -> list[dict]:
    """Get list of domains with display labels from analyzer service."""
    try:
        domains_data = analyzer_service.get_migration_domains()
        result = []
        for d in domains_data:
            domain_id = d.get('domain', '')
            display_name = d.get('display_name', domain_id)
            code = d.get('code', '')
            
            # Skip _ENTERPRISE_WIDE - not valid for Impact Analysis
            if domain_id == '_ENTERPRISE_WIDE':
                continue
            
            # Format label: "Full Name (CODE)"
            if code and code != display_name:
                label = f"{display_name} ({code})"
            else:
                label = display_name
            
            result.append({
                'value': domain_id,
                'label': label
            })
        
        return result
    except Exception as e:
        logger.error(f"Failed to get domains: {e}")
        return []


def get_valid_domain_values() -> list[str]:
    """Get just the domain values for validation."""
    domains = get_domains_with_labels()
    return [d['value'] for d in domains]


def sanitize_filename_part(name: str) -> str:
    """Sanitize a string for use in filename - alphanumeric, dots, dashes only."""
    return re.sub(r'[^a-zA-Z0-9.\-]', '_', name)


def generate_filename(prefix: str, domain: Optional[str] = None) -> str:
    """Generate timestamped filename."""
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    if domain:
        safe_domain = sanitize_filename_part(domain)
        return f"{prefix}_{safe_domain}_{timestamp}.xlsx"
    return f"{prefix}_{timestamp}.xlsx"


# ==============================================================================
# Endpoints
# ==============================================================================

@router.post("/impact", response_model=CommandResponse)
async def run_impact_report(request: ImpactRequest):
    """
    Run Impact Analysis for a domain.
    
    Analyzes what happens when replacing operation GPOs with enterprise standard equivalents.
    """
    settings = get_settings()
    
    # Validate domain
    valid_domains = get_valid_domain_values()
    if not valid_domains:
        return CommandResponse(
            success=False,
            output="Error: No HTML reports found.\nUpload GPOZaurr reports via the Upload page.",
            error="No HTML reports available"
        )
    
    if request.domain not in valid_domains:
        return CommandResponse(
            success=False,
            output=f"Error: Domain '{request.domain}' not found in loaded reports.\n\nAvailable domains:\n" + 
                   "\n".join(f"  - {d}" for d in valid_domains),
            error="Invalid domain"
        )
    
    # Generate filename
    filename = generate_filename("impact", request.domain)
    output_path = settings.download_folder / filename
    
    # Build command array - NO SHELL INJECTION POSSIBLE
    cmd = [
        "python", "gpo_analyzer.py",
        "--mode", "impact",
        "--domain", request.domain,
        "--html-folder", str(settings.html_folder),
        "--output", str(output_path)
    ]
    
    logger.info(f"Running impact analysis: {' '.join(cmd)}")
    
    try:
        start_time = datetime.now()
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            cwd="/app"
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        output = result.stdout
        if result.stderr:
            output += "\n" + result.stderr
        
        if result.returncode == 0 and output_path.exists():
            output += f"\n\nCompleted in {execution_time:.1f} seconds"
            
            return CommandResponse(
                success=True,
                output=output,
                download_url=f"/api/downloads/{filename}",
                filename=filename,
                execution_time_seconds=execution_time
            )
        else:
            return CommandResponse(
                success=False,
                output=output or "Command failed with no output",
                error=f"Exit code: {result.returncode}"
            )
            
    except subprocess.TimeoutExpired:
        return CommandResponse(
            success=False,
            output="Error: Command timed out after 5 minutes.\nCheck server logs for details.",
            error="Timeout"
        )
    except Exception as e:
        logger.exception("Impact command failed")
        return CommandResponse(
            success=False,
            output=f"Error: {str(e)}\nCheck server logs for details.",
            error=str(e)
        )


@router.post("/full", response_model=CommandResponse)
async def run_full_report():
    """
    Run Full Report (19-tab data dump).
    
    Complete GPO data export for data analysts.
    """
    settings = get_settings()
    
    # Check if any HTML reports exist
    html_count = analyzer_service.get_html_file_count()
    if html_count == 0:
        return CommandResponse(
            success=False,
            output="Error: No HTML reports found.\nUpload GPOZaurr reports via the Upload page.",
            error="No HTML reports available"
        )
    
    # Generate filename
    filename = generate_filename("full_report")
    output_path = settings.download_folder / filename
    
    # Build command array - NO SHELL INJECTION POSSIBLE
    cmd = [
        "python", "gpo_analyzer.py",
        "--mode", "full",
        "--html-folder", str(settings.html_folder),
        "--output", str(output_path)
    ]
    
    logger.info(f"Running full report: {' '.join(cmd)}")
    
    try:
        start_time = datetime.now()
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout for full report
            cwd="/app"
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        output = result.stdout
        if result.stderr:
            output += "\n" + result.stderr
        
        if result.returncode == 0 and output_path.exists():
            output += f"\n\nCompleted in {execution_time:.1f} seconds"
            
            return CommandResponse(
                success=True,
                output=output,
                download_url=f"/api/downloads/{filename}",
                filename=filename,
                execution_time_seconds=execution_time
            )
        else:
            return CommandResponse(
                success=False,
                output=output or "Command failed with no output",
                error=f"Exit code: {result.returncode}"
            )
            
    except subprocess.TimeoutExpired:
        return CommandResponse(
            success=False,
            output="Error: Command timed out after 10 minutes.\nCheck server logs for details.",
            error="Timeout"
        )
    except Exception as e:
        logger.exception("Full report command failed")
        return CommandResponse(
            success=False,
            output=f"Error: {str(e)}\nCheck server logs for details.",
            error=str(e)
        )


@router.get("/domains")
async def get_available_domains():
    """Get list of domains available for Impact analysis with display labels."""
    domains = get_domains_with_labels()
    return {"domains": domains}
