from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class PlayerBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr


class PlayerCreate(PlayerBase):
    password: str = Field(..., min_length=6)
    region: str = "atlantic"
    country: str = "international"


class Player(PlayerBase):
    id: str
    city_id: Optional[str] = None
    region: str
    country: str
    created_at: datetime

    class Config:
        from_attributes = True


class PlayerInDB(Player):
    hashed_password: str
