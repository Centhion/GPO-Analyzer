"""
GPO Analyzer Web API - Main Application

FastAPI wrapper around GPOAnalyzer v2.3.2 for web-based reporting.
Secured with Entra ID (Azure AD) authentication.

Version: 3.3.0
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import asyncio
import time
from pathlib import Path

from .config import get_settings
from .services.analyzer import analyzer_service
from .routers import executive, domain, upload, migration, downloads, commands
from .models.schemas import HealthResponse
from .auth import get_current_user
from .audit import setup_audit_logger

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler - runs on startup and shutdown
    """
    # Startup
    settings = get_settings()
    logger.info("=" * 60)
    logger.info("GPO ANALYZER WEB API v3.3.0")
    logger.info("=" * 60)
    
    # Setup audit logging
    setup_audit_logger()
    logger.info(f"Audit log: {settings.audit_log_file}")
    
    # Auth status
    if settings.auth_enabled:
        logger.info(f"Auth: Entra ID enabled (Tenant: {settings.azure_tenant_id[:8]}...)")
    else:
        logger.info("Auth: DISABLED (development mode)")
    
    # Ensure data directories exist
    settings.html_folder.mkdir(parents=True, exist_ok=True)
    settings.download_folder.mkdir(parents=True, exist_ok=True)
    settings.audit_log_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Initialize analyzer service
    analyzer_service.initialize(settings.html_folder)
    
    html_count = analyzer_service.get_html_file_count()
    logger.info(f"HTML folder: {settings.html_folder}")
    logger.info(f"Download folder: {settings.download_folder}")
    logger.info(f"Download TTL: {settings.download_ttl_minutes} minutes")
    logger.info(f"HTML files found: {html_count}")
    
    if html_count > 0:
        # Pre-warm the cache by running initial analysis
        logger.info("Pre-warming analyzer cache...")
        try:
            _ = analyzer_service.analyzer
            logger.info("Cache warmed successfully")
        except Exception as e:
            logger.warning(f"Cache warm failed (will retry on first request): {e}")
    else:
        logger.info("No HTML files found - upload files to begin analysis")
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(cleanup_old_downloads())
    logger.info(f"Download cleanup task started (interval: {settings.download_cleanup_interval_minutes} min)")
    
    logger.info("=" * 60)
    logger.info("API ready at http://localhost:8000")
    logger.info("=" * 60)
    
    yield
    
    # Shutdown
    logger.info("Shutting down GPO Analyzer API...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Cleanup task stopped")


async def cleanup_old_downloads():
    """
    Background task to delete expired download files.
    
    Runs periodically (default: every 30 minutes) and deletes files
    older than TTL (default: 60 minutes).
    """
    settings = get_settings()
    
    while True:
        try:
            await asyncio.sleep(settings.download_cleanup_interval_minutes * 60)
            
            now = time.time()
            ttl_seconds = settings.download_ttl_minutes * 60
            deleted_count = 0
            
            if settings.download_folder.exists():
                for f in settings.download_folder.glob("*"):
                    if f.is_file():
                        age = now - f.stat().st_mtime
                        if age > ttl_seconds:
                            try:
                                f.unlink()
                                deleted_count += 1
                                logger.info(f"Cleaned up expired download: {f.name} (age: {age/60:.1f} min)")
                            except Exception as e:
                                logger.warning(f"Failed to delete {f.name}: {e}")
            
            if deleted_count > 0:
                logger.info(f"Download cleanup complete: {deleted_count} file(s) deleted")
                
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"Download cleanup error: {e}")


# Create FastAPI app
settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
    lifespan=lifespan,
    docs_url="/docs" if not settings.auth_enabled else None,  # Disable Swagger when auth enabled
    redoc_url="/redoc" if not settings.auth_enabled else None,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers WITH auth dependency
# All API routes require authentication
auth_dependency = [Depends(get_current_user)]

app.include_router(executive.router, prefix="/api", dependencies=auth_dependency)
app.include_router(domain.router, prefix="/api", dependencies=auth_dependency)
app.include_router(upload.router, prefix="/api", dependencies=auth_dependency)
app.include_router(upload.export_router, prefix="/api", dependencies=auth_dependency)
app.include_router(migration.router, prefix="/api", dependencies=auth_dependency)
app.include_router(commands.router, prefix="/api", dependencies=auth_dependency)
app.include_router(downloads.router, prefix="/api", dependencies=auth_dependency)


# ============================================================================
# Root Endpoints (NO AUTH - for health checks and info)
# ============================================================================

@app.get("/", tags=["Root"])
async def root():
    """
    API root - returns basic info (no auth required)
    """
    return {
        "name": "GPO Analyzer API",
        "version": "3.3.0",
        "auth": "Entra ID" if settings.auth_enabled else "Disabled",
        "health": "/api/health"
    }


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint for container orchestration (no auth required)
    """
    return HealthResponse(
        status="healthy",
        version="3.3.0",
        html_files_count=analyzer_service.get_html_file_count(),
        last_analysis=analyzer_service.last_analysis_time
    )


# ============================================================================
# Run with Uvicorn (for development)
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
