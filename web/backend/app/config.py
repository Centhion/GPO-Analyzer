"""
Configuration settings for GPO Analyzer Web API
"""
from pydantic_settings import BaseSettings
from pathlib import Path
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # API Info
    api_title: str = "GPO Analyzer Web API"
    api_description: str = "Web API for GPO Cross-Domain Consolidation Analysis"
    api_version: str = "3.3.0"
    
    # Paths
    html_folder: Path = Path("/app/data/html_reports")
    download_folder: Path = Path("/app/data/downloads")
    audit_log_file: Path = Path("/app/data/audit.log")
    
    # Download TTL (cleanup old CLI-generated files)
    download_ttl_minutes: int = 60  # Files older than this are deleted
    download_cleanup_interval_minutes: int = 30  # How often to check
    
    # Pagination
    default_page_size: int = 50
    max_page_size: int = 100
    
    # Cache
    cache_ttl: int = 300  # seconds
    
    # CORS - allow all origins (internal tool)
    cors_origins: list = ["*"]
    
    # Azure AD / Entra ID Configuration
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    
    # Authentication settings
    auth_enabled: bool = True
    
    class Config:
        env_prefix = "GPO_"
    
    @property
    def azure_issuer(self) -> str:
        """Azure AD token issuer URL"""
        return f"https://login.microsoftonline.com/{self.azure_tenant_id}/v2.0"
    
    @property
    def azure_jwks_uri(self) -> str:
        """Azure AD public keys endpoint"""
        return f"https://login.microsoftonline.com/{self.azure_tenant_id}/discovery/v2.0/keys"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
