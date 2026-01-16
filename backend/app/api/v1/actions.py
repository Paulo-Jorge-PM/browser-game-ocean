from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ...core.base_definitions import get_base_definition
from ...core.dev_user import get_dev_user
from ...core.database import get_database
from ...core.config import settings
from ...services.city_service import city_doc_to_state
from ...services.grid_utils import world_y_to_index
from ...services import action_service
from .schemas import V1BuildStartRequest, V1BuildCompleteRequest, V1CityState

router = APIRouter()


# New action-based request/response models
class ActionStartRequest(BaseModel):
    """Request to start an action."""

    city_id: str
    action_type: str  # "build", "upgrade", "research", etc.
    data: dict  # Action-specific data


class ActionStartResponse(BaseModel):
    """Response from starting an action."""

    action_id: str
    action_type: str
    started_at: datetime
    ends_at: datetime
    duration_seconds: int
    resources: dict[str, int]  # Updated resources after deduction


class ActionCompleteRequest(BaseModel):
    """Request to complete an action."""

    action_id: str


class ActionCompleteResponse(BaseModel):
    """Response from completing an action."""

    status: str  # "completed", "pending", "failed"
    remaining_seconds: Optional[int] = None
    error: Optional[str] = None
    action_id: Optional[str] = None
    completed_at: Optional[datetime] = None


class PendingActionsResponse(BaseModel):
    """Response listing pending actions."""

    actions: list[dict]


# ============================================
# NEW EVENT-DRIVEN ACTION ENDPOINTS
# ============================================


@router.post("/start", response_model=ActionStartResponse)
async def start_action(request: ActionStartRequest):
    """
    Start a new action.

    This is the main entry point for all time-based actions.
    Records the action with timestamps and returns info for frontend timer.
    """
    current_user = await get_dev_user()
    player_id = current_user["user_id"]

    try:
        if request.action_type == "build":
            # Build action
            base_type = request.data.get("base_type")
            position = request.data.get("position")

            if not base_type or not position:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing base_type or position for build action",
                )

            pending_action, resources = await action_service.start_build_action(
                city_id=request.city_id,
                player_id=player_id,
                base_type=base_type,
                position=position,
            )

            return ActionStartResponse(
                action_id=pending_action.id,
                action_type="build",
                started_at=pending_action.started_at,
                ends_at=pending_action.ends_at,
                duration_seconds=pending_action.duration_seconds,
                resources=resources,
            )

        elif request.action_type == "research":
            # Research action
            tech_id = request.data.get("tech_id")

            if not tech_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing tech_id for research action",
                )

            pending_action, resources = await action_service.start_research_action(
                city_id=request.city_id,
                player_id=player_id,
                tech_id=tech_id,
            )

            return ActionStartResponse(
                action_id=pending_action.id,
                action_type="research",
                started_at=pending_action.started_at,
                ends_at=pending_action.ends_at,
                duration_seconds=pending_action.duration_seconds,
                resources=resources,
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown action type: {request.action_type}",
            )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/complete", response_model=ActionCompleteResponse)
async def complete_action(request: ActionCompleteRequest):
    """
    Request to complete an action.

    Backend validates that enough time has elapsed.
    - If complete: moves action to completed, updates game state, returns success
    - If not ready: returns remaining_seconds for frontend to retry later
    """
    current_user = await get_dev_user()
    player_id = current_user["user_id"]

    result = await action_service.complete_action(
        action_id=request.action_id,
        player_id=player_id,
    )

    return ActionCompleteResponse(
        status=result.status,
        remaining_seconds=result.remaining_seconds,
        error=result.error,
        action_id=result.action_id,
        completed_at=result.completed_at,
    )


@router.get("/pending/{city_id}", response_model=PendingActionsResponse)
async def get_pending_actions(city_id: str):
    """
    Get all pending actions for a city.

    Frontend uses this to restore timers on page load.
    """
    current_user = await get_dev_user()
    player_id = current_user["user_id"]

    actions = await action_service.get_pending_actions(
        city_id=city_id,
        player_id=player_id,
    )

    return PendingActionsResponse(
        actions=[a.model_dump() for a in actions],
    )


@router.post("/cancel/{action_id}")
async def cancel_action(action_id: str):
    """
    Cancel a pending action.

    Returns refunded resources (if applicable).
    """
    current_user = await get_dev_user()
    player_id = current_user["user_id"]

    success = await action_service.cancel_action(
        action_id=action_id,
        player_id=player_id,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found or cannot be cancelled",
        )

    return {"status": "cancelled", "action_id": action_id}


# ============================================
# LEGACY BUILD ENDPOINTS (for backwards compatibility)
# ============================================


@router.post("/build/start", response_model=V1CityState)
async def start_build_action(request: V1BuildStartRequest):
    """Legacy build start endpoint - returns full city state."""
    db = get_database()
    current_user = await get_dev_user()

    city_doc = await db.cities.find_one({"_id": ObjectId(request.city_id)})
    if not city_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

    if city_doc["player_id"] != current_user["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your city")

    grid = city_doc["grid"]
    x, y = request.position.x, request.position.y
    grid_y = world_y_to_index(grid, y)

    if not (0 <= grid_y < len(grid) and 0 <= x < len(grid[0])):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid position")

    cell = grid[grid_y][x]
    if cell.get("depth", 0) < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Above-surface construction locked",
        )
    if not cell["is_unlocked"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cell is locked")

    if cell["base"] is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cell already has a base")

    base_def = get_base_definition(request.base_type)
    resources = city_doc.get("resources", {})

    for resource, cost in base_def["cost"].items():
        if resources.get(resource, 0) < cost:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient {resource}",
            )

    for resource, cost in base_def["cost"].items():
        resources[resource] = resources.get(resource, 0) - cost

    now = datetime.now(timezone.utc)
    end_time = now + timedelta(seconds=base_def["build_time_seconds"])
    base_id = str(uuid.uuid4())
    action_id = str(uuid.uuid4())

    base_doc = {
        "id": base_id,
        "type": request.base_type,
        "position": {"x": x, "y": y},
        "level": 1,
        "construction_progress": 0,
        "is_operational": False,
        "workers": 0,
        "action_id": action_id,
        "construction_started_at": now,
        "construction_ends_at": end_time,
    }

    grid[grid_y][x]["base"] = base_doc

    await db.cities.update_one(
        {"_id": ObjectId(request.city_id)},
        {"$set": {"grid": grid, "resources": resources}},
    )

    city_doc["grid"] = grid
    city_doc["resources"] = resources

    return V1CityState(**city_doc_to_state(city_doc))


@router.post("/build/complete", response_model=V1CityState)
async def complete_build_action(request: V1BuildCompleteRequest):
    db = get_database()
    current_user = await get_dev_user()

    city_doc = await db.cities.find_one({"_id": ObjectId(request.city_id)})
    if not city_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

    if city_doc["player_id"] != current_user["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your city")

    grid = city_doc["grid"]
    x, y = request.position.x, request.position.y
    grid_y = world_y_to_index(grid, y)

    if not (0 <= grid_y < len(grid) and 0 <= x < len(grid[0])):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid position")

    cell = grid[grid_y][x]
    base = cell.get("base")
    if not base or base.get("id") != request.base_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Base not found")

    if base.get("is_operational"):
        return V1CityState(**city_doc_to_state(city_doc))

    end_time = base.get("construction_ends_at")
    if not end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing construction end time")

    now = datetime.now(timezone.utc)
    if isinstance(end_time, str):
        try:
            end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid construction end time format",
            ) from exc

    if end_time.tzinfo is None or end_time.tzinfo.utcoffset(end_time) is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    if now < end_time:
        remaining = int((end_time - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Construction not complete. Remaining seconds: {remaining}",
        )

    base_def = get_base_definition(base["type"])
    base["construction_progress"] = 100
    base["is_operational"] = True
    base["workers"] = base_def["workers_required"]
    base["action_id"] = None
    base["construction_started_at"] = None
    base["construction_ends_at"] = None

    for dx, dy, side in [
        (0, -1, "top"),
        (0, 1, "bottom"),
        (-1, 0, "left"),
        (1, 0, "right"),
    ]:
        if side not in base_def["connection_sides"]:
            continue
        nx, ny = x + dx, y + dy
        adj_y = world_y_to_index(grid, ny)
        if 0 <= adj_y < len(grid) and 0 <= nx < len(grid[0]):
            grid[adj_y][nx]["is_unlocked"] = True

    await db.cities.update_one(
        {"_id": ObjectId(request.city_id)},
        {"$set": {"grid": grid}},
    )

    city_doc["grid"] = grid
    return V1CityState(**city_doc_to_state(city_doc))
