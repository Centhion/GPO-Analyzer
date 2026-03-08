"""
Executive Mode API Router

Provides endpoints for Executive Dashboard (7 tabs):
- Tab 1: Migration Dashboard
- Tab 2: Operations Summary
- Tab 3: Risk Assessment
- Tab 4: Bucket Comparison
- Tab 5-7: (Performance, Infrastructure, Roadmap - future)
"""
from fastapi import APIRouter, HTTPException
from typing import List

from ..services.analyzer import analyzer_service
from ..models.schemas import (
    MigrationDashboard,
    OperationSummary,
    RiskAssessmentRow,
    BucketComparisonRow
)

router = APIRouter(prefix="/executive", tags=["Executive Mode"])


@router.get("/dashboard", response_model=MigrationDashboard)
async def get_migration_dashboard():
    """
    Tab 1: Migration Dashboard
    
    Returns high-level metrics including:
    - Total and active GPO counts
    - Migration readiness percentage
    - Bucket distribution
    """
    try:
        data = analyzer_service.get_migration_dashboard_data()
        return MigrationDashboard(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/operations-summary", response_model=List[OperationSummary])
async def get_operations_summary():
    """
    Tab 2: Operations Summary
    
    Returns per-operation breakdown with:
    - GPO counts by bucket type
    - Migration readiness per operation
    """
    try:
        data = analyzer_service.get_operations_summary_data()
        return [OperationSummary(**op) for op in data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/risk-assessment", response_model=List[RiskAssessmentRow])
async def get_risk_assessment():
    """
    Tab 3: Risk Assessment
    
    Returns operations ranked by complexity:
    - Risk score calculation
    - HIGH/MEDIUM/LOW classification
    - Specific risk notes
    """
    try:
        data = analyzer_service.get_risk_assessment_data()
        return [RiskAssessmentRow(**row) for row in data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/bucket-comparison", response_model=List[BucketComparisonRow])
async def get_bucket_comparison():
    """
    Tab 4: Bucket Comparison
    
    Returns cross-operation bucket percentages for consistency analysis
    """
    try:
        data = analyzer_service.get_bucket_comparison_data()
        return [BucketComparisonRow(**row) for row in data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


# TODO: Tabs 5-7 (Performance Issues, Infrastructure Dependencies, Roadmap)
# These can be added in future sprints if needed
