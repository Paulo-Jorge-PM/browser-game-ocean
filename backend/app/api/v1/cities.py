from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from bson import ObjectId
import uuid

from ...core.database import get_database
from ...core.security import get_current_user
from ...core.config import settings
from ...models.city import City, CityCreate, GridCell, GridPosition, Base

router = APIRouter()


def create_empty_grid(width: int, height: int) -> list[list[dict]]:
    """Create an empty grid with only the surface row unlocked."""
    grid = []
    for y in range(height):
        row = []
        for x in range(width):
            cell = {
                "position": {"x": x, "y": y},
                "base": None,
                "is_unlocked": y == 0,  # Only surface is unlocked
                "depth": y,
            }
            row.append(cell)
        grid.append(row)
    return grid


@router.post("/", response_model=City)
async def create_city(
    city_data: CityCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    player_id = current_user["user_id"]

    # Check if player already has a city
    player = await db.players.find_one({"_id": ObjectId(player_id)})
    if player and player.get("city_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player already has a city",
        )

    # Create the grid
    grid = create_empty_grid(settings.grid_default_width, settings.grid_default_height)

    # Place command ship at center of surface
    center_x = settings.grid_default_width // 2
    command_ship = {
        "id": str(uuid.uuid4()),
        "type": "command_ship",
        "position": {"x": center_x, "y": 0},
        "level": 1,
        "construction_progress": 100,
        "is_operational": True,
        "workers": 5,
    }
    grid[0][center_x]["base"] = command_ship
    grid[0][center_x]["is_unlocked"] = True

    # Unlock adjacent cells
    for dx in [-1, 0, 1]:
        nx = center_x + dx
        if 0 <= nx < settings.grid_default_width:
            grid[0][nx]["is_unlocked"] = True
    if settings.grid_default_height > 1:
        grid[1][center_x]["is_unlocked"] = True

    # Create city document
    city_doc = {
        "name": city_data.name,
        "player_id": player_id,
        "grid": grid,
        "resources": {
            "population": 10,
            "food": 100,
            "oxygen": 100,
            "water": 100,
            "energy": 50,
            "minerals": 50,
            "tech_points": 0,
        },
        "resource_capacity": {
            "population": 50,
            "food": 500,
            "oxygen": 500,
            "water": 500,
            "energy": 200,
            "minerals": 200,
            "tech_points": 1000,
        },
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.cities.insert_one(city_doc)
    city_id = str(result.inserted_id)

    # Update player with city_id
    await db.players.update_one(
        {"_id": ObjectId(player_id)},
        {"$set": {"city_id": city_id}},
    )

    return City(id=city_id, **city_doc)


@router.get("/{city_id}", response_model=City)
async def get_city(city_id: str):
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="City not found",
        )

    return City(id=str(city_doc["_id"]), **{k: v for k, v in city_doc.items() if k != "_id"})


@router.post("/{city_id}/bases")
async def build_base(
    city_id: str,
    base: Base,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="City not found",
        )

    if city_doc["player_id"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your city",
        )

    x, y = base.position.x, base.position.y
    grid = city_doc["grid"]

    # Validate position
    if not (0 <= y < len(grid) and 0 <= x < len(grid[0])):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid position",
        )

    cell = grid[y][x]
    if not cell["is_unlocked"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cell is locked",
        )

    if cell["base"] is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cell already has a base",
        )

    # Place the base
    grid[y][x]["base"] = base.model_dump()

    # Unlock adjacent cells
    for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
        nx, ny = x + dx, y + dy
        if 0 <= ny < len(grid) and 0 <= nx < len(grid[0]):
            grid[ny][nx]["is_unlocked"] = True

    # Update city
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {"$set": {"grid": grid}},
    )

    return {"status": "ok", "base": base}
