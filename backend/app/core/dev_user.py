from datetime import datetime, timezone
from bson import ObjectId

from .config import settings
from .database import get_database
from .security import get_password_hash


async def get_or_create_dev_player() -> dict:
    db = get_database()
    player = await db.players.find_one({"email": settings.dev_user_email})
    if player:
        return player

    player_doc = {
        "username": settings.dev_user_username,
        "email": settings.dev_user_email,
        "hashed_password": get_password_hash(settings.dev_user_password),
        "region": settings.dev_user_region,
        "country": settings.dev_user_country,
        "city_id": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.players.insert_one(player_doc)
    player_doc["_id"] = result.inserted_id
    return player_doc


async def get_dev_user() -> dict:
    player = await get_or_create_dev_player()
    return {"user_id": str(player["_id"])}


async def get_dev_player_id() -> ObjectId:
    player = await get_or_create_dev_player()
    return player["_id"]
