"""
Analyzer Service - THIN wrapper around GPOAnalyzer for web API

This service ONLY handles:
1. Caching the GPOAnalyzer instance
2. Cache invalidation when HTML files change
3. Delegating ALL business logic to GPOAnalyzer

NO BUSINESS LOGIC HERE - all logic lives in gpo_analyzer.py (single source of truth)
"""
import sys
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import hashlib

# Add parent directory to path to import gpo_analyzer
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from gpo_analyzer import GPOAnalyzer

logger = logging.getLogger(__name__)


class AnalyzerService:
    """
    Singleton service wrapping GPOAnalyzer with caching.
    
    Design Principle: THIN WRAPPER ONLY
    - All get_*() methods are one-liners that call GPOAnalyzer
    - NO business logic, filtering, formatting, or data transformation here
    - If you need to add logic, add it to GPOAnalyzer.get_web_*() methods
    """
    
    _instance: Optional['AnalyzerService'] = None
    _analyzer: Optional[GPOAnalyzer] = None
    _html_hash: Optional[str] = None
    _last_analysis: Optional[datetime] = None
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self.html_folder: Optional[Path] = None
    
    def initialize(self, html_folder: Path) -> None:
        """Initialize with HTML folder path"""
        self.html_folder = html_folder
        logger.info(f"AnalyzerService initialized with folder: {html_folder}")
    
    def _compute_html_hash(self) -> str:
        """Compute hash of HTML files AND analyzer code for cache invalidation"""
        if not self.html_folder or not self.html_folder.exists():
            return ""
        
        hash_input = ""
        
        # Include HTML files
        html_files = sorted(self.html_folder.glob("*.html"))
        for f in html_files:
            stat = f.stat()
            hash_input += f"{f.name}:{stat.st_size}:{stat.st_mtime};"
        
        # Include the master analyzer Python file
        # This ensures cache invalidates when analyzer logic changes
        analyzer_file = Path("/app/gpo_analyzer.py")
        if analyzer_file.exists():
            stat = analyzer_file.stat()
            hash_input += f"analyzer.py:{stat.st_size}:{stat.st_mtime};"
        
        return hashlib.md5(hash_input.encode()).hexdigest()
    
    def _ensure_analyzer(self) -> GPOAnalyzer:
        """Get or create analyzer instance, with cache validation"""
        current_hash = self._compute_html_hash()
        
        # Check if we need to re-analyze (HTML files changed OR analyzer code changed)
        if self._analyzer is None or self._html_hash != current_hash:
            logger.info("Initializing/refreshing GPOAnalyzer (data or code changed)...")
            self._analyzer = GPOAnalyzer(self.html_folder, mode='executive')
            self._analyzer.parse_html_reports()
            self._analyzer.filter_active_gpos()
            self._analyzer.analyze_settings_patterns()
            self._analyzer.analyze_for_decisions()
            self._html_hash = current_hash
            self._last_analysis = datetime.now()
            logger.info(f"Analysis complete. Active GPOs: {len(self._analyzer.active_gpos)}")
        
        return self._analyzer
    
    @property
    def analyzer(self) -> GPOAnalyzer:
        """Get the analyzer instance"""
        return self._ensure_analyzer()
    
    @property
    def last_analysis_time(self) -> Optional[datetime]:
        """Get timestamp of last analysis"""
        return self._last_analysis
    
    def get_html_file_count(self) -> int:
        """Count HTML files in folder"""
        if not self.html_folder or not self.html_folder.exists():
            return 0
        return len(list(self.html_folder.glob("*.html")))
    
    def invalidate_cache(self) -> None:
        """Force cache invalidation (e.g., after file upload)"""
        self._html_hash = None
        self._analyzer = None
        logger.info("Analyzer cache invalidated")

    # =========================================================================
    # EXECUTIVE MODE - Thin wrappers calling GPOAnalyzer
    # =========================================================================
    
    def get_migration_dashboard_data(self) -> Dict[str, Any]:
        """Get Executive Dashboard data (Tab 1)"""
        try:
            logger.info("get_migration_dashboard_data: calling get_web_executive_dashboard")
            result = self.analyzer.get_web_executive_dashboard()
            logger.info(f"get_migration_dashboard_data: success, got {len(result)} keys")
            return result
        except Exception as e:
            logger.exception(f"get_migration_dashboard_data FAILED: {e}")
            raise
    
    def get_operations_summary_data(self) -> List[Dict[str, Any]]:
        """Get Operations Summary data (Tab 2)"""
        try:
            logger.info("get_operations_summary_data: calling get_web_operations_summary")
            result = self.analyzer.get_web_operations_summary()
            logger.info(f"get_operations_summary_data: success, got {len(result)} operations")
            return result
        except Exception as e:
            logger.exception(f"get_operations_summary_data FAILED: {e}")
            raise
    
    def get_risk_assessment_data(self) -> List[Dict[str, Any]]:
        """Get Risk Assessment data (Tab 3)"""
        try:
            logger.info("get_risk_assessment_data: calling get_web_risk_assessment")
            result = self.analyzer.get_web_risk_assessment()
            logger.info(f"get_risk_assessment_data: success, got {len(result)} rows")
            return result
        except Exception as e:
            logger.exception(f"get_risk_assessment_data FAILED: {e}")
            raise
    
    def get_bucket_comparison_data(self) -> List[Dict[str, Any]]:
        """Get Bucket Comparison data (Tab 4)"""
        try:
            logger.info("get_bucket_comparison_data: calling get_web_bucket_comparison")
            result = self.analyzer.get_web_bucket_comparison()
            logger.info(f"get_bucket_comparison_data: success, got {len(result)} rows")
            return result
        except Exception as e:
            logger.exception(f"get_bucket_comparison_data FAILED: {e}")
            raise

    # =========================================================================
    # DOMAIN MODE - Thin wrappers calling GPOAnalyzer
    # =========================================================================
    
    def get_available_operations(self) -> List[Dict[str, Any]]:
        """Get list of available operations with GPO counts"""
        try:
            logger.info("get_available_operations: calling get_web_available_operations")
            result = self.analyzer.get_web_available_operations()
            logger.info(f"get_available_operations: success, got {len(result)} operations")
            return result
        except Exception as e:
            logger.exception(f"get_available_operations FAILED: {e}")
            raise
    
    def get_domain_overview_data(self, operation_code: str) -> Dict[str, Any]:
        """Get Domain Overview data for a specific operation"""
        try:
            logger.info(f"get_domain_overview_data: calling for operation {operation_code}")
            result = self.analyzer.get_web_domain_overview(operation_code)
            logger.info(f"get_domain_overview_data: success")
            return result
        except Exception as e:
            logger.exception(f"get_domain_overview_data FAILED for {operation_code}: {e}")
            raise
    
    def get_domain_gpos_by_bucket(
        self, 
        operation_code: str, 
        bucket: str,
        page: int = 1,
        limit: int = 50
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Get GPOs for a specific operation filtered by bucket"""
        try:
            logger.info(f"get_domain_gpos_by_bucket: {operation_code}/{bucket} page={page}")
            result = self.analyzer.get_web_domain_gpos(operation_code, bucket, page, limit)
            logger.info(f"get_domain_gpos_by_bucket: success, got {len(result[0])} GPOs")
            return result
        except Exception as e:
            logger.exception(f"get_domain_gpos_by_bucket FAILED: {e}")
            raise
    
    def get_gpo_details(self, operation_code: str, gpo_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed information for a specific GPO"""
        try:
            logger.info(f"get_gpo_details: {operation_code}/{gpo_name}")
            result = self.analyzer.get_web_gpo_details(operation_code, gpo_name)
            logger.info(f"get_gpo_details: success")
            return result
        except Exception as e:
            logger.exception(f"get_gpo_details FAILED: {e}")
            raise

    # =========================================================================
    # MIGRATION MODE - Thin wrappers calling GPOAnalyzer
    # =========================================================================
    
    def get_migration_domains(self) -> List[Dict[str, Any]]:
        """Get list of domains available for migration analysis"""
        try:
            logger.info("get_migration_domains: calling get_migration_domains")
            result = self.analyzer.get_migration_domains()
            logger.info(f"get_migration_domains: success, got {len(result)} domains")
            return result
        except Exception as e:
            logger.exception(f"get_migration_domains FAILED: {e}")
            raise
    
    def run_migration_analysis(self, domain: str) -> Dict[str, Any]:
        """Run migration analysis for a domain"""
        try:
            logger.info(f"run_migration_analysis: analyzing {domain}")
            result = self.analyzer.run_migration_analysis(domain)
            logger.info(f"run_migration_analysis: success")
            return result
        except Exception as e:
            logger.exception(f"run_migration_analysis FAILED for {domain}: {e}")
            raise
    
    def generate_migration_excel(self, domain: str, output_path: Path) -> Dict[str, Any]:
        """Generate Excel report using web analysis (ensures consistency with UI)"""
        try:
            logger.info(f"generate_migration_excel: generating for {domain}")
            result = self.analyzer.generate_migration_excel(domain, output_path)
            logger.info(f"generate_migration_excel: success")
            return result
        except Exception as e:
            logger.exception(f"generate_migration_excel FAILED for {domain}: {e}")
            raise


# Global singleton instance
analyzer_service = AnalyzerService()
