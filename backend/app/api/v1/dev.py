from typing import Optional
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter
from pydantic import BaseModel

from ...core.config import settings
from ...core.database import get_database
from ...core.dev_user import get_or_create_dev_player
from ...services.city_service import build_new_city_document, city_doc_to_state
from ...services import action_service, resource_service
from .schemas import V1BootstrapResponse, V1CityState

router = APIRouter()


class SyncConfig(BaseModel):
    """Configuration for frontend sync behavior."""

    resource_sync_interval_seconds: int
    error_tolerance_seconds: int
    action_complete_retry_seconds: int


class BootstrapResponseV2(BaseModel):
    """Enhanced bootstrap response with sync config."""

    city: V1CityState
    pending_actions: list[dict]
    sync_config: SyncConfig
    production_rates: Optional[dict] = None


@router.get("/bootstrap", response_model=V1BootstrapResponse)
async def bootstrap_dev_city():
    """Legacy bootstrap endpoint - returns only city state."""
    db = get_database()
    player = await get_or_create_dev_player()
    player_id = str(player["_id"])

    city_doc = None
    if player.get("city_id"):
        city_doc = await db.cities.find_one({"_id": ObjectId(player["city_id"])})
        if not city_doc:
            await db.players.update_one(
                {"_id": ObjectId(player_id)},
                {"$set": {"city_id": None}},
            )

    if not city_doc:
        new_city_doc = build_new_city_document(settings.dev_city_name, player_id)
        result = await db.cities.insert_one(new_city_doc)
        city_id = str(result.inserted_id)
        await db.players.update_one(
            {"_id": ObjectId(player_id)},
            {"$set": {"city_id": city_id}},
        )
        new_city_doc["_id"] = result.inserted_id
        city_doc = new_city_doc

    return V1BootstrapResponse(city=V1CityState(**city_doc_to_state(city_doc)))


@router.get("/bootstrap/v2", response_model=BootstrapResponseV2)
async def bootstrap_dev_city_v2():
    """
    Enhanced bootstrap endpoint for event-driven architecture.

    This endpoint:
    1. Auto-completes any expired pending actions
    2. Recalculates resources based on elapsed time
    3. Returns pending actions for frontend timer restoration
    4. Returns sync configuration
    5. Returns production rates
    """
    db = get_database()
    player = await get_or_create_dev_player()
    player_id = str(player["_id"])

    city_doc = None
    if player.get("city_id"):
        city_doc = await db.cities.find_one({"_id": ObjectId(player["city_id"])})
        if not city_doc:
            await db.players.update_one(
                {"_id": ObjectId(player_id)},
                {"$set": {"city_id": None}},
            )

    if not city_doc:
        new_city_doc = build_new_city_document(settings.dev_city_name, player_id)
        result = await db.cities.insert_one(new_city_doc)
        city_id = str(result.inserted_id)
        await db.players.update_one(
            {"_id": ObjectId(player_id)},
            {"$set": {"city_id": city_id}},
        )
        new_city_doc["_id"] = result.inserted_id
        city_doc = new_city_doc

    city_id = str(city_doc["_id"])

    # Auto-complete any expired pending actions
    await action_service.sync_pending_actions(city_id, player_id)

    # Get remaining pending actions
    pending_actions = await action_service.get_pending_actions(city_id, player_id)

    # Recalculate resources based on elapsed time
    resources_data = await resource_service.get_current_resources(city_id)

    # Update city doc with recalculated resources for response
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {
            "$set": {
                "resources": resources_data["resources"],
                "resources_last_synced_at": datetime.fromisoformat(resources_data["calculated_at"]),
            }
        },
    )

    # Refresh city doc
    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})

    return BootstrapResponseV2(
        city=V1CityState(**city_doc_to_state(city_doc)),
        pending_actions=[a.model_dump() for a in pending_actions],
        sync_config=SyncConfig(
            resource_sync_interval_seconds=settings.resource_sync_interval_seconds,
            error_tolerance_seconds=settings.error_tolerance_seconds,
            action_complete_retry_seconds=settings.action_complete_retry_seconds,
        ),
        production_rates=resources_data["production_rates"],
    )
