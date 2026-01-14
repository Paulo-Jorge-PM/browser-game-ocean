"""
Resource API endpoints.

Handles resource synchronization between frontend and backend.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ...core.dev_user import get_dev_user
from ...services import resource_service


router = APIRouter()


class ResourceSyncRequest(BaseModel):
    """Request to sync resources with server."""

    city_id: str
    client_resources: dict[str, int]


class ResourceSyncResponse(BaseModel):
    """Response from resource sync."""

    resources: dict[str, int]
    capacity: dict[str, int]
    production_rates: dict
    last_synced_at: datetime
    drift_detected: bool
    drift_details: Optional[dict] = None


class ResourcesResponse(BaseModel):
    """Response for getting current resources."""

    resources: dict[str, int]
    capacity: dict[str, int]
    production_rates: dict
    calculated_at: str


@router.post("/sync", response_model=ResourceSyncResponse)
async def sync_resources(request: ResourceSyncRequest):
    """
    Sync resources with server.

    Frontend calls this periodically (every 30-60 seconds) to ensure
    client and server stay in sync. Server calculates expected resources
    based on elapsed time and compares with client values.

    Server values always win (source of truth). Drift detection is for
    monitoring/anti-cheat purposes.
    """
    current_user = await get_dev_user()
    player_id = current_user["user_id"]

    try:
        result = await resource_service.sync_resources(
            city_id=request.city_id,
            player_id=player_id,
            client_resources=request.client_resources,
        )

        return ResourceSyncResponse(
            resources=result.resources,
            capacity=result.capacity,
            production_rates=result.production_rates.model_dump(),
            last_synced_at=result.last_synced_at,
            drift_detected=result.drift_detected,
            drift_details=result.drift_details,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{city_id}", response_model=ResourcesResponse)
async def get_resources(city_id: str):
    """
    Get current resources for a city.

    Calculates resources based on elapsed time since last sync.
    """
    current_user = await get_dev_user()

    try:
        result = await resource_service.get_current_resources(city_id)

        return ResourcesResponse(
            resources=result["resources"],
            capacity=result["capacity"],
            production_rates=result["production_rates"],
            calculated_at=result["calculated_at"],
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
