"""
Pydantic models for API request/response schemas
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime


# ============================================================================
# Common Models
# ============================================================================

class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    limit: int = Field(default=50, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseModel):
    """Base paginated response"""
    data: List[Any]
    total: int
    page: int
    limit: int
    total_pages: int


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    html_files_count: int
    last_analysis: Optional[datetime] = None


# ============================================================================
# Executive Mode Models
# ============================================================================

class BucketMetrics(BaseModel):
    """Bucket distribution metrics"""
    bucket: str
    count: int
    percentage: float


class MigrationDashboard(BaseModel):
    """Tab 1: Migration Dashboard data"""
    total_gpos: int
    active_gpos: int
    active_percentage: float
    migration_ready: int
    migration_ready_percentage: float
    needs_review: int
    dont_migrate: int
    bucket_distribution: List[BucketMetrics]
    domains_analyzed: int
    operations_count: int


class OperationSummary(BaseModel):
    """Single operation summary row"""
    operation: str
    full_name: str
    operation_type: str  # 'Shared Forest' or 'Standalone'
    total_gpos: int
    server: int
    workstation: int
    user: int
    mixed: int
    unknown: int
    domain_controller: int
    domain_root: int
    migrate_ready: int
    needs_review: int
    dont_migrate: int
    readiness_percentage: float


class RiskAssessmentRow(BaseModel):
    """Single risk assessment row"""
    operation: str
    full_name: str
    total_gpos: int
    risk_score: int
    risk_level: str  # 'HIGH', 'MEDIUM', 'LOW'
    mixed_count: int
    unknown_count: int
    dc_count: int
    domain_root_count: int
    risk_notes: str


class BucketComparisonRow(BaseModel):
    """Single bucket comparison row"""
    operation: str
    full_name: str
    total_gpos: int
    server_pct: float
    workstation_pct: float
    user_pct: float
    mixed_pct: float
    other_pct: float


# ============================================================================
# Domain Mode Models
# ============================================================================

class DomainBucketOverview(BaseModel):
    """Tab 1: Bucket Overview for a domain/operation"""
    operation: str
    full_name: str
    total_gpos: int
    bucket_counts: Dict[str, int]
    migration_summary: Dict[str, int]  # MIGRATE, DON'T MIGRATE, REVIEW


class GPORow(BaseModel):
    """Single GPO row for data tables - matches Excel export columns"""
    gpo_name: str
    description: Optional[str] = None
    linked_to: str  # Full DN paths
    applies_to: str  # Computer, User, Both
    settings_count: int
    size_mb: Optional[str] = None
    created: Optional[str] = None
    last_modified: Optional[str] = None
    guid: Optional[str] = None
    bucket: str
    match_type: str
    readiness: str  # Ready, Review First, Consider Splitting, Not Applicable
    optimization_note: Optional[str] = None
    # Review Required specific
    detection_reason: Optional[str] = None  # Explains why bucket was assigned
    action: Optional[str] = None  # For Review Required tab


class GPOListResponse(PaginatedResponse):
    """Paginated list of GPOs"""
    data: List[GPORow]


# ============================================================================
# Upload Models
# ============================================================================

class UploadResponse(BaseModel):
    """File upload response"""
    filename: str
    domain_detected: str
    gpo_count: int
    message: str


class AvailableOperation(BaseModel):
    """Available operation/domain for selection"""
    code: str
    full_name: str
    source_domain: str
    operation_type: str  # 'Shared Forest' or 'Standalone'
    gpo_count: int


class OperationsListResponse(BaseModel):
    """List of available operations"""
    operations: List[AvailableOperation]
    total_operations: int
    total_gpos: int


# ============================================================================
# GPO Details Models (Settings Drill-Down)
# ============================================================================

class GPOSetting(BaseModel):
    """Single GPO setting"""
    category: str
    setting_name: str
    setting_value: str


class GPOIssue(BaseModel):
    """Single GPO issue/warning"""
    severity: str  # 'warning', 'info', 'error'
    message: str
    detail: Optional[str] = None


class GPODetails(BaseModel):
    """Detailed GPO information for side panel"""
    gpo_name: str
    guid: Optional[str] = None
    description: Optional[str] = None
    applies_to: str
    bucket: str
    readiness: str
    match_type: str
    created: Optional[str] = None
    last_modified: Optional[str] = None
    # Links
    link_locations: List[str]
    # Settings
    settings: List[GPOSetting]
    settings_count: int
    # Issues detected
    issues: List[GPOIssue]
    # Additional context
    detection_reason: Optional[str] = None
    action: Optional[str] = None
