"""
Upload API Router

Handles HTML file uploads and Excel exports
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path
from typing import List
import shutil
import tempfile
import re

from ..config import get_settings
from ..services.analyzer import analyzer_service

router = APIRouter(prefix="/upload", tags=["File Management"])


def _cleanup_temp_file(path: Path):
    """Background task to clean up temp files after response is sent"""
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass  # Ignore cleanup errors


@router.post("/html")
async def upload_html_file(file: UploadFile = File(...)):
    """
    Upload a single GPOZaurr HTML report
    
    The file will be saved to the html_reports folder and trigger cache invalidation
    """
    settings = get_settings()
    
    # Validate file
    if not file.filename.endswith('.html'):
        raise HTTPException(
            status_code=400, 
            detail="Only HTML files are accepted"
        )
    
    try:
        # Save file
        upload_path = settings.html_folder / file.filename
        
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Invalidate analyzer cache to pick up new file
        analyzer_service.invalidate_cache()
        
        # Try to extract domain name from file
        domain_name = _extract_domain_from_file(upload_path)
        
        return {
            "filename": file.filename,
            "domain_detected": domain_name,
            "message": f"File uploaded successfully. Domain '{domain_name}' will be included in next analysis."
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/html/batch")
async def upload_multiple_html_files(files: List[UploadFile] = File(...)):
    """
    Upload multiple GPOZaurr HTML reports at once
    """
    settings = get_settings()
    results = []
    
    for file in files:
        if not file.filename.endswith('.html'):
            results.append({
                "filename": file.filename,
                "status": "skipped",
                "message": "Not an HTML file"
            })
            continue
        
        try:
            upload_path = settings.html_folder / file.filename
            
            with open(upload_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            domain_name = _extract_domain_from_file(upload_path)
            
            results.append({
                "filename": file.filename,
                "status": "success",
                "domain_detected": domain_name
            })
        
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "message": str(e)
            })
    
    # Invalidate cache after all uploads
    analyzer_service.invalidate_cache()
    
    success_count = sum(1 for r in results if r['status'] == 'success')
    
    return {
        "total_files": len(files),
        "successful": success_count,
        "results": results,
        "message": f"{success_count} of {len(files)} files uploaded successfully"
    }


@router.get("/files")
async def list_html_files():
    """
    List all HTML files currently in the reports folder
    """
    settings = get_settings()
    
    if not settings.html_folder.exists():
        return {"files": [], "count": 0}
    
    files = []
    for f in settings.html_folder.glob("*.html"):
        stat = f.stat()
        files.append({
            "filename": f.name,
            "size_kb": round(stat.st_size / 1024, 1),
            "modified": stat.st_mtime
        })
    
    files.sort(key=lambda x: x['filename'])
    
    return {
        "files": files,
        "count": len(files)
    }


@router.delete("/files/{filename}")
async def delete_html_file(filename: str):
    """
    Delete an HTML file from the reports folder
    """
    settings = get_settings()
    file_path = settings.html_folder / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not filename.endswith('.html'):
        raise HTTPException(status_code=400, detail="Can only delete HTML files")
    
    try:
        file_path.unlink()
        analyzer_service.invalidate_cache()
        
        return {"message": f"File '{filename}' deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


def _extract_domain_from_file(file_path: Path) -> str:
    """Extract domain name from HTML file content"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read(10000)  # Read first 10KB
            
            match = re.search(r'"DomainName":\s*"([^"]+)"', content)
            if match:
                return match.group(1)
    except:
        pass
    
    # Fallback to filename
    return file_path.stem


# ============================================================================
# Export Endpoints
# ============================================================================

export_router = APIRouter(prefix="/export", tags=["Export"])


@export_router.get("/executive")
async def export_executive_excel(background_tasks: BackgroundTasks):
    """
    Generate and download Executive mode Excel report
    """
    try:
        # Create temp file for Excel
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            tmp_path = Path(tmp.name)
        
        # Generate Excel using existing GPOAnalyzer method
        analyzer = analyzer_service.analyzer
        
        # Create a fresh analyzer in executive mode for export
        from gpo_analyzer import GPOAnalyzer
        settings = get_settings()
        
        export_analyzer = GPOAnalyzer(settings.html_folder, mode='executive')
        export_analyzer.parse_html_reports()
        export_analyzer.filter_active_gpos()
        export_analyzer.analyze_settings_patterns()
        export_analyzer.analyze_for_decisions()
        export_analyzer.generate_excel_report(tmp_path)
        
        # Schedule cleanup after response is sent
        background_tasks.add_task(_cleanup_temp_file, tmp_path)
        
        return FileResponse(
            tmp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="GPO_Executive_Report.xlsx"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@export_router.get("/domain/{operation_code}")
async def export_domain_excel(operation_code: str, background_tasks: BackgroundTasks):
    """
    Generate and download Domain mode Excel report for specific operation
    """
    try:
        # Create temp file for Excel
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            tmp_path = Path(tmp.name)
        
        # Generate Excel using existing GPOAnalyzer method
        from gpo_analyzer import GPOAnalyzer, LOCATION_MAPPING
        settings = get_settings()
        
        # Determine if it's an operation code or domain name
        if operation_code.upper() in LOCATION_MAPPING:
            export_analyzer = GPOAnalyzer(
                settings.html_folder, 
                mode='domain', 
                operation=operation_code.upper()
            )
        else:
            export_analyzer = GPOAnalyzer(
                settings.html_folder, 
                mode='domain', 
                target_domain=operation_code
            )
        
        export_analyzer.parse_html_reports()
        export_analyzer.filter_active_gpos()
        export_analyzer.analyze_settings_patterns()
        export_analyzer.analyze_for_decisions()
        export_analyzer.generate_excel_report(tmp_path)
        
        # Schedule cleanup after response is sent
        background_tasks.add_task(_cleanup_temp_file, tmp_path)
        
        return FileResponse(
            tmp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"GPO_{operation_code}_Report.xlsx"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/refresh")
async def refresh_analyzer():
    """
    Force re-analysis of all HTML files
    
    Use this after updating the analyzer code (gpo_analyzer_v2_2_8.py)
    to pick up new logic without restarting the container.
    """
    try:
        # Invalidate cache
        analyzer_service.invalidate_cache()
        
        # Force re-analysis by accessing analyzer property
        analyzer = analyzer_service.analyzer
        
        return {
            "status": "success",
            "message": "Analyzer cache cleared and data re-analyzed",
            "active_gpos": len(analyzer.active_gpos) if hasattr(analyzer, 'active_gpos') else 0,
            "timestamp": analyzer_service.last_analysis_time.isoformat() if analyzer_service.last_analysis_time else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refresh failed: {str(e)}")


@router.get("/debug/detection-reasons")
async def debug_detection_reasons():
    """
    Debug endpoint to verify detection reasons are being generated.
    Returns detection reasons for first 5 Review Required GPOs.
    """
    try:
        # Get first available operation
        operations = analyzer_service.get_available_operations()
        if not operations:
            return {"error": "No operations available"}
        
        first_op = operations[0]['code']
        
        # Get Review Required GPOs
        data, total = analyzer_service.get_domain_gpos_by_bucket(first_op, 'review', page=1, limit=5)
        
        # Extract just the relevant fields
        debug_data = []
        for gpo in data:
            debug_data.append({
                "gpo_name": gpo.get('gpo_name'),
                "bucket": gpo.get('bucket'),
                "detection_reason": gpo.get('detection_reason'),
                "linked_to": gpo.get('linked_to', '')[:100] + '...' if gpo.get('linked_to') else ''
            })
        
        return {
            "operation": first_op,
            "total_review_gpos": total,
            "sample_gpos": debug_data,
            "message": "If detection_reason is populated above, the backend is working correctly."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Debug failed: {str(e)}")
