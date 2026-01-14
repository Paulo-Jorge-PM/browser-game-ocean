from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId

from ...core.database import get_database
from ...core.security import get_current_user
from ...services.city_service import build_new_city_document
from .schemas import V1City, V1CityCreate, V1Base

router = APIRouter()


@router.post("/", response_model=V1City)
async def create_city(
    city_data: V1CityCreate,
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

    city_doc = build_new_city_document(city_data.name, player_id)

    result = await db.cities.insert_one(city_doc)
    city_id = str(result.inserted_id)

    # Update player with city_id
    await db.players.update_one(
        {"_id": ObjectId(player_id)},
        {"$set": {"city_id": city_id}},
    )

    return V1City(id=city_id, **city_doc)


@router.get("/{city_id}", response_model=V1City)
async def get_city(city_id: str):
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="City not found",
        )

    return V1City(id=str(city_doc["_id"]), **{k: v for k, v in city_doc.items() if k != "_id"})


@router.post("/{city_id}/bases")
async def build_base(
    city_id: str,
    base: V1Base,
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
