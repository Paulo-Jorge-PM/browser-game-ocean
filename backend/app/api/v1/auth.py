from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from bson import ObjectId

from ...core.database import get_database
from ...core.security import get_password_hash, verify_password, create_access_token
from ...models.player import PlayerCreate, Player

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    player: Player
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=RegisterResponse)
async def register(player_data: PlayerCreate):
    db = get_database()

    # Check if email already exists
    existing = await db.players.find_one({"email": player_data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if username already exists
    existing = await db.players.find_one({"username": player_data.username})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Create player document
    player_doc = {
        "username": player_data.username,
        "email": player_data.email,
        "hashed_password": get_password_hash(player_data.password),
        "region": player_data.region,
        "country": player_data.country,
        "city_id": None,
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.players.insert_one(player_doc)
    player_id = str(result.inserted_id)

    # Create access token
    access_token = create_access_token(data={"sub": player_id})

    player = Player(
        id=player_id,
        username=player_data.username,
        email=player_data.email,
        city_id=None,
        region=player_data.region,
        country=player_data.country,
        created_at=player_doc["created_at"],
    )

    return RegisterResponse(player=player, access_token=access_token)


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    db = get_database()

    # Find player by email
    player_doc = await db.players.find_one({"email": credentials.email})
    if not player_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Verify password
    if not verify_password(credentials.password, player_doc["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Create access token
    player_id = str(player_doc["_id"])
    access_token = create_access_token(data={"sub": player_id})

    return TokenResponse(access_token=access_token)
