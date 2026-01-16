"""
Action Service - Handles pending/completed action management.

This service manages the lifecycle of game actions (build, research, troops, etc.)
using an event-driven architecture where:
- Actions are started and stored with timestamps
- Frontend runs timers locally
- Frontend requests completion validation from backend
- Backend validates based on elapsed time
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from bson import ObjectId

from ..core.database import get_database
from ..core.config import settings
from ..core.base_definitions import (
    get_base_definition,
    BASE_DEFINITIONS,
    get_tech_definition,
    TECH_DEFINITIONS,
    can_research_tech,
)
from .grid_utils import world_y_to_index
from ..models.action import (
    ActionType,
    ActionData,
    PendingAction,
    CompletedAction,
    ActionCompleteResponse,
    PendingActionResponse,
)


async def start_build_action(
    city_id: str,
    player_id: str,
    base_type: str,
    position: dict[str, int],
) -> tuple[PendingAction, dict]:
    """
    Start a build action.

    Returns:
        Tuple of (pending_action, updated_resources)

    Raises:
        ValueError: If validation fails (insufficient resources, invalid position, etc.)
    """
    db = get_database()

    # Get city and validate
    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    if city_doc["player_id"] != player_id:
        raise ValueError("Not your city")

    grid = city_doc["grid"]
    x, y = position["x"], position["y"]
    grid_y = world_y_to_index(grid, y)

    # Validate position
    if not (0 <= grid_y < len(grid) and 0 <= x < len(grid[0])):
        raise ValueError("Invalid position")

    cell = grid[grid_y][x]
    if cell.get("depth", 0) < 0:
        raise ValueError("Above-surface construction locked")
    if not cell["is_unlocked"]:
        raise ValueError("Cell is locked")

    if cell["base"] is not None:
        raise ValueError("Cell already has a base")

    # Get base definition and validate resources
    if base_type not in BASE_DEFINITIONS:
        raise ValueError(f"Unknown base type: {base_type}")

    base_def = get_base_definition(base_type)
    resources = city_doc.get("resources", {})

    for resource, cost in base_def["cost"].items():
        if resources.get(resource, 0) < cost:
            raise ValueError(f"Insufficient {resource}")

    # Deduct resources
    for resource, cost in base_def["cost"].items():
        resources[resource] = resources.get(resource, 0) - cost

    # Create timestamps
    now = datetime.now(timezone.utc)
    duration = base_def["build_time_seconds"]
    end_time = now + timedelta(seconds=duration)

    # Create action record
    action_id = str(uuid.uuid4())
    base_id = str(uuid.uuid4())

    pending_action = PendingAction(
        id=action_id,
        city_id=city_id,
        player_id=player_id,
        action_type="build",
        started_at=now,
        ends_at=end_time,
        duration_seconds=duration,
        data=ActionData(
            base_type=base_type,
            position=position,
            base_id=base_id,
        ),
        status="in_progress",
        created_at=now,
    )

    # Store pending action in database
    action_doc = pending_action.model_dump()
    action_doc["_id"] = ObjectId()
    await db.pending_actions.insert_one(action_doc)

    # Place the under-construction base in the grid
    base_doc = {
        "id": base_id,
        "type": base_type,
        "position": {"x": x, "y": y},
        "level": 1,
        "construction_progress": 0,
        "is_operational": False,
        "workers": 0,
        "action_id": action_id,
        "construction_started_at": now.isoformat(),
        "construction_ends_at": end_time.isoformat(),
    }

    grid[grid_y][x]["base"] = base_doc

    # Update city in database
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {"$set": {"grid": grid, "resources": resources}},
    )

    return pending_action, resources


async def complete_action(action_id: str, player_id: str) -> ActionCompleteResponse:
    """
    Attempt to complete an action.

    Validates that enough time has elapsed and marks the action as complete.

    Returns:
        ActionCompleteResponse with status "completed", "pending", or "failed"
    """
    db = get_database()

    # Find the pending action
    action_doc = await db.pending_actions.find_one({"id": action_id})
    if not action_doc:
        return ActionCompleteResponse(
            status="failed",
            error="Action not found",
        )

    if action_doc["player_id"] != player_id:
        return ActionCompleteResponse(
            status="failed",
            error="Not your action",
        )

    if action_doc["status"] == "completed":
        return ActionCompleteResponse(
            status="completed",
            action_id=action_id,
            completed_at=action_doc.get("completed_at"),
        )

    # Parse end time
    end_time = action_doc["ends_at"]
    if isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)

    # Check if action is ready to complete
    if now < end_time:
        remaining = int((end_time - now).total_seconds())
        return ActionCompleteResponse(
            status="pending",
            remaining_seconds=max(1, remaining),  # At least 1 second
        )

    # Action is ready - complete it based on type
    action_type = action_doc["action_type"]
    data = action_doc["data"]
    city_id = action_doc["city_id"]

    if action_type == "build":
        await _complete_build_action(city_id, data)
    elif action_type == "research":
        await _complete_research_action(city_id, data)

    # Move action to completed
    completed_action = CompletedAction(
        original_action_id=action_id,
        city_id=city_id,
        player_id=player_id,
        action_type=action_type,
        started_at=action_doc["started_at"],
        completed_at=now,
        duration_seconds=action_doc["duration_seconds"],
        data=ActionData(**data),
        result={"status": "success"},
    )

    completed_doc = completed_action.model_dump()
    completed_doc["_id"] = ObjectId()
    await db.completed_actions.insert_one(completed_doc)

    # Remove from pending
    await db.pending_actions.delete_one({"id": action_id})

    return ActionCompleteResponse(
        status="completed",
        action_id=action_id,
        completed_at=now,
    )


async def _complete_build_action(city_id: str, data: dict) -> None:
    """Complete a build action - mark base as operational and unlock adjacent cells."""
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    grid = city_doc["grid"]
    position = data["position"]
    base_type = data["base_type"]
    x, y = position["x"], position["y"]
    grid_y = world_y_to_index(grid, y)
    if not (0 <= grid_y < len(grid) and 0 <= x < len(grid[0])):
        raise ValueError("Invalid position")

    cell = grid[grid_y][x]
    base = cell.get("base")

    if not base:
        raise ValueError("Base not found at position")

    # Mark as operational
    base_def = get_base_definition(base_type)
    base["construction_progress"] = 100
    base["is_operational"] = True
    base["workers"] = base_def["workers_required"]
    base["action_id"] = None
    base["construction_started_at"] = None
    base["construction_ends_at"] = None

    # Unlock adjacent cells based on connection sides
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

    # Update city
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {"$set": {"grid": grid}},
    )


async def start_research_action(
    city_id: str,
    player_id: str,
    tech_id: str,
) -> tuple[PendingAction, dict]:
    """
    Start a research action.

    Returns:
        Tuple of (pending_action, updated_resources)

    Raises:
        ValueError: If validation fails (insufficient tech points, prerequisites not met, etc.)
    """
    db = get_database()

    # Get city and validate
    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    if city_doc["player_id"] != player_id:
        raise ValueError("Not your city")

    # Get tech definition and validate
    if tech_id not in TECH_DEFINITIONS:
        raise ValueError(f"Unknown tech: {tech_id}")

    tech_def = get_tech_definition(tech_id)

    # Check prerequisites
    unlocked_techs = city_doc.get("unlocked_techs", [])
    if tech_id in unlocked_techs:
        raise ValueError("Tech already researched")

    if not can_research_tech(tech_id, unlocked_techs):
        raise ValueError("Prerequisites not met")

    # Check if already researching something
    current_research = city_doc.get("current_research")
    if current_research:
        raise ValueError("Already researching another tech")

    # Check and deduct tech points
    resources = city_doc.get("resources", {})
    tech_points = resources.get("tech_points", 0)
    if tech_points < tech_def["cost"]:
        raise ValueError(f"Insufficient tech points (need {tech_def['cost']}, have {tech_points})")

    resources["tech_points"] = tech_points - tech_def["cost"]

    # Create timestamps
    now = datetime.now(timezone.utc)
    duration = tech_def["research_time_seconds"]
    end_time = now + timedelta(seconds=duration)

    # Create action record
    action_id = str(uuid.uuid4())

    pending_action = PendingAction(
        id=action_id,
        city_id=city_id,
        player_id=player_id,
        action_type="research",
        started_at=now,
        ends_at=end_time,
        duration_seconds=duration,
        data=ActionData(
            tech_id=tech_id,
        ),
        status="in_progress",
        created_at=now,
    )

    # Store pending action in database
    action_doc = pending_action.model_dump()
    action_doc["_id"] = ObjectId()
    await db.pending_actions.insert_one(action_doc)

    # Update city with new resources and current_research
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {
            "$set": {
                "resources": resources,
                "current_research": tech_id,
            }
        },
    )

    return pending_action, resources


async def _complete_research_action(city_id: str, data: dict) -> None:
    """Complete a research action - add tech to unlocked_techs and clear current_research."""
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    tech_id = data.get("tech_id")
    if not tech_id:
        raise ValueError("Missing tech_id in research action data")

    # Add tech to unlocked_techs
    unlocked_techs = city_doc.get("unlocked_techs", [])
    if tech_id not in unlocked_techs:
        unlocked_techs.append(tech_id)

    # Update city
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {
            "$set": {
                "unlocked_techs": unlocked_techs,
                "current_research": None,
            }
        },
    )


async def sync_pending_actions(city_id: str, player_id: str) -> list[ActionCompleteResponse]:
    """
    Sync all pending actions for a city.

    Auto-completes any actions where end_time has passed.
    Called on page load / reconnect.

    Returns:
        List of completion responses for each action processed
    """
    db = get_database()

    # Get all pending actions for this city
    cursor = db.pending_actions.find({
        "city_id": city_id,
        "player_id": player_id,
        "status": "in_progress",
    })

    results = []
    async for action_doc in cursor:
        action_id = action_doc["id"]
        response = await complete_action(action_id, player_id)
        results.append(response)

    return results


async def get_pending_actions(city_id: str, player_id: str) -> list[PendingActionResponse]:
    """Get all pending actions for a city."""
    db = get_database()

    cursor = db.pending_actions.find({
        "city_id": city_id,
        "player_id": player_id,
        "status": "in_progress",
    })

    actions = []
    async for action_doc in cursor:
        actions.append(PendingActionResponse(
            action_id=action_doc["id"],
            action_type=action_doc["action_type"],
            started_at=action_doc["started_at"],
            ends_at=action_doc["ends_at"],
            duration_seconds=action_doc["duration_seconds"],
            data=ActionData(**action_doc["data"]),
            status=action_doc["status"],
        ))

    return actions


async def cancel_action(action_id: str, player_id: str) -> bool:
    """
    Cancel a pending action.

    Returns True if cancelled, False if not found or not cancellable.
    """
    db = get_database()

    action_doc = await db.pending_actions.find_one({"id": action_id})
    if not action_doc or action_doc["player_id"] != player_id:
        return False

    if action_doc["status"] != "in_progress":
        return False

    # Mark as cancelled
    await db.pending_actions.update_one(
        {"id": action_id},
        {"$set": {"status": "cancelled"}},
    )

    # For build actions, remove the base from grid
    if action_doc["action_type"] == "build":
        data = action_doc["data"]
        city_id = action_doc["city_id"]
        position = data["position"]

        city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
        if city_doc:
            grid = city_doc["grid"]
            x, y = position["x"], position["y"]
            grid_y = world_y_to_index(grid, y)
            if 0 <= grid_y < len(grid) and 0 <= x < len(grid[0]):
                grid[grid_y][x]["base"] = None

            await db.cities.update_one(
                {"_id": ObjectId(city_id)},
                {"$set": {"grid": grid}},
            )

    return True
