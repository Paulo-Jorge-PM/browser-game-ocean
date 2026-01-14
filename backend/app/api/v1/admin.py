from bson import ObjectId
from fastapi import APIRouter

from ...core.database import get_database
from ...core.dev_user import get_or_create_dev_player
from .schemas import V1AdminResetResponse

router = APIRouter()


@router.post("/reset", response_model=V1AdminResetResponse)
async def reset_dev_city():
    db = get_database()
    player = await get_or_create_dev_player()
    player_id = str(player["_id"])

    if player.get("city_id"):
        await db.cities.delete_one({"_id": ObjectId(player["city_id"])})
        await db.players.update_one(
            {"_id": ObjectId(player_id)},
            {"$set": {"city_id": None}},
        )

    return V1AdminResetResponse(status="ok")
