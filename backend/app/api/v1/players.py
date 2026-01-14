from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId

from ...core.database import get_database
from ...core.security import get_current_user
from .schemas import V1Player

router = APIRouter()


@router.get("/me", response_model=V1Player)
async def get_current_player(current_user: dict = Depends(get_current_user)):
    db = get_database()
    player_id = current_user["user_id"]

    player_doc = await db.players.find_one({"_id": ObjectId(player_id)})
    if not player_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player not found",
        )

    return V1Player(
        id=str(player_doc["_id"]),
        username=player_doc["username"],
        email=player_doc["email"],
        city_id=player_doc.get("city_id"),
        region=player_doc["region"],
        country=player_doc["country"],
        created_at=player_doc["created_at"],
    )


@router.get("/{player_id}", response_model=V1Player)
async def get_player(player_id: str):
    db = get_database()

    player_doc = await db.players.find_one({"_id": ObjectId(player_id)})
    if not player_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player not found",
        )

    return V1Player(
        id=str(player_doc["_id"]),
        username=player_doc["username"],
        email=player_doc["email"],
        city_id=player_doc.get("city_id"),
        region=player_doc["region"],
        country=player_doc["country"],
        created_at=player_doc["created_at"],
    )
