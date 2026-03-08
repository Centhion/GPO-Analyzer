"""
Domain Mode API Router

Provides endpoints for Domain/Operation Dashboard (5 tabs):
- Tab 1: Bucket Overview
- Tab 2: Server GPOs
- Tab 3: Workstation GPOs
- Tab 4: User GPOs
- Tab 5: Review Required
- GPO Details: Settings drill-down for side panel
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List
import math

from ..services.analyzer import analyzer_service
from ..models.schemas import (
    DomainBucketOverview,
    GPORow,
    GPOListResponse,
    AvailableOperation,
    OperationsListResponse,
    GPODetails
)

router = APIRouter(prefix="/domain", tags=["Domain Mode"])


@router.get("/operations", response_model=OperationsListResponse)
async def get_available_operations():
    """
    Get list of available operations/domains for selection dropdown
    
    Returns all operations with GPO counts, sorted alphabetically
    """
    try:
        operations = analyzer_service.get_available_operations()
        total_gpos = sum(op['gpo_count'] for op in operations)
        
        return OperationsListResponse(
            operations=[AvailableOperation(**op) for op in operations],
            total_operations=len(operations),
            total_gpos=total_gpos
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/{operation_code}/overview", response_model=DomainBucketOverview)
async def get_domain_overview(operation_code: str):
    """
    Tab 1: Bucket Overview
    
    Returns summary counts by bucket type for the specified operation
    """
    try:
        data = analyzer_service.get_domain_overview_data(operation_code)
        return DomainBucketOverview(**data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/{operation_code}/server-gpos", response_model=GPOListResponse)
async def get_server_gpos(
    operation_code: str,
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page")
):
    """
    Tab 2: Server GPOs
    
    Returns GPOs linked to Server OUs - HIGH PRIORITY for migration
    """
    try:
        data, total = analyzer_service.get_domain_gpos_by_bucket(
            operation_code, "Server", page, limit
        )
        return GPOListResponse(
            data=[GPORow(**row) for row in data],
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/{operation_code}/workstation-gpos", response_model=GPOListResponse)
async def get_workstation_gpos(
    operation_code: str,
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page")
):
    """
    Tab 3: Workstation GPOs
    
    Returns GPOs linked to Computer/Workstation OUs - HIGH PRIORITY for migration
    """
    try:
        data, total = analyzer_service.get_domain_gpos_by_bucket(
            operation_code, "Workstation", page, limit
        )
        return GPOListResponse(
            data=[GPORow(**row) for row in data],
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/{operation_code}/user-gpos", response_model=GPOListResponse)
async def get_user_gpos(
    operation_code: str,
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page")
):
    """
    Tab 4: User GPOs
    
    Returns GPOs linked to User OUs - REVIEW for optimization opportunities
    """
    try:
        data, total = analyzer_service.get_domain_gpos_by_bucket(
            operation_code, "User", page, limit
        )
        return GPOListResponse(
            data=[GPORow(**row) for row in data],
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/{operation_code}/review-required", response_model=GPOListResponse)
async def get_review_required(
    operation_code: str,
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Items per page")
):
    """
    Tab 5: Review Required
    
    Returns GPOs needing manual review:
    - Mixed (linked to multiple bucket types)
    - Unknown (cannot determine bucket)
    - Domain Controller (DC configuration)
    - Domain Root (linked at domain level)
    """
    try:
        data, total = analyzer_service.get_domain_gpos_by_bucket(
            operation_code, "Review", page, limit
        )
        return GPOListResponse(
            data=[GPORow(**row) for row in data],
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/{operation_code}/gpo/{gpo_name}/details", response_model=GPODetails)
async def get_gpo_details(operation_code: str, gpo_name: str):
    """
    GPO Details - Settings drill-down for side panel
    
    Returns detailed information about a specific GPO including:
    - All configured settings with categories
    - Link locations
    - Detected issues and warnings
    - Migration readiness assessment
    """
    try:
        data = analyzer_service.get_gpo_details(operation_code, gpo_name)
        if data is None:
            raise HTTPException(
                status_code=404, 
                detail=f"GPO '{gpo_name}' not found in operation '{operation_code}'"
            )
        return GPODetails(**data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")
