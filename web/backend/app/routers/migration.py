"""
Migration Mode Router - THIN wrapper for FastAPI endpoints

NO BUSINESS LOGIC HERE - all logic lives in gpo_analyzer.py
This router only handles HTTP plumbing.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path
import tempfile
import logging

from ..config import get_settings
from ..services.analyzer import analyzer_service

router = APIRouter(prefix="/migration", tags=["Migration Mode"])
logger = logging.getLogger(__name__)


# ============================================================================
# Response Models
# ============================================================================

class MigrationDomain(BaseModel):
    domain: str
    display_name: str
    domain_type: str
    gpo_count: int
    unmatched_gpos: Optional[List[str]] = None  # Only present for _UNMATCHED domain


class MigrationDomainsResponse(BaseModel):
    domains: List[MigrationDomain]
    enterprise_baseline: str


class GPOSummaryRow(BaseModel):
    priority: str
    action: str
    operation_gpo: str
    source_domain: Optional[str] = None  # Source domain (e.g., corp.alpha.com, baseline.corp)
    enterprise_standard_overlap: str
    shared_forest_overlap: str
    total_settings: int
    migrate: int
    dont_migrate: int
    review: int
    dn_path: Optional[str] = None  # DN path for Enterprise-Wide GPOs


class SettingGained(BaseModel):
    """Enterprise standard setting that operation will gain after migration."""
    category: str
    setting_key: str
    setting_name: str
    enterprise_value: str
    enterprise_gpo: str
    impact: str


class MigrationSummary(BaseModel):
    domain: str
    total_settings: int
    migrate: int
    dont_migrate: int
    review: int
    total_gpos: int
    p1_count: int
    p2_count: int
    p3_count: int
    p4_count: int
    gpo_summary: List[GPOSummaryRow] = []
    # Settings Gained - Enterprise standard settings operation will receive after migration
    settings_gained_count: int = 0
    settings_gained_by_category: dict = {}
    settings_gained: List[SettingGained] = []
    warning: Optional[str] = None


# ============================================================================
# Endpoints - Thin wrappers only
# ============================================================================

@router.get("/domains", response_model=MigrationDomainsResponse)
async def get_migration_domains():
    """Get list of domains available for migration analysis."""
    try:
        domains_data = analyzer_service.get_migration_domains()
        
        domains = [MigrationDomain(**d) for d in domains_data]
        
        return MigrationDomainsResponse(
            domains=domains,
            enterprise_baseline="baseline.corp"
        )
        
    except Exception as e:
        logger.exception("Failed to get migration domains")
        raise HTTPException(status_code=500, detail=f"Failed to get domains: {str(e)}")


@router.get("/{domain}/summary", response_model=MigrationSummary)
async def get_migration_summary(domain: str):
    """Run migration analysis and return summary for a domain."""
    try:
        result = analyzer_service.run_migration_analysis(domain)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return MigrationSummary(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Migration analysis failed for {domain}")
        raise HTTPException(status_code=500, detail=f"Migration analysis failed: {str(e)}")


@router.get("/{domain}/export")
async def export_migration_excel(domain: str, background_tasks: BackgroundTasks):
    """Generate and download migration Excel report using web analysis (consistent with UI)."""
    try:
        settings = get_settings()
        
        # Create temp file for output
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            output_path = Path(tmp.name)
        
        # Use the new web-based Excel generation (ensures consistency with UI)
        result = analyzer_service.generate_migration_excel(domain, output_path)
        
        if "error" in result:
            raise Exception(result["error"])
        
        if not output_path.exists():
            raise Exception("Output file was not created")
        
        # Clean up temp file after response
        def cleanup():
            try:
                output_path.unlink()
            except:
                pass
        background_tasks.add_task(cleanup)
        
        filename = f"{domain.replace('.', '_')}_migration_report.xlsx"
        
        return FileResponse(
            path=output_path,
            filename=filename,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Export timed out")
    except Exception as e:
        logger.exception(f"Export failed for {domain}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
