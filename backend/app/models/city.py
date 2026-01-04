from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal
from .resource import Resources, ResourceCapacity

BaseType = Literal[
    "command_ship",
    "residential",
    "hydroponic_farm",
    "kelp_forest",
    "mining_rig",
    "oxygen_generator",
    "water_purifier",
    "power_plant",
    "comms_tower",
    "defense_platform",
    "shipyard",
    "research_lab",
    "storage_hub",
    "trade_hub",
]


class GridPosition(BaseModel):
    x: int
    y: int


class Base(BaseModel):
    id: str
    type: BaseType
    position: GridPosition
    level: int = 1
    construction_progress: int = 100  # 0-100
    is_operational: bool = True
    workers: int = 0


class GridCell(BaseModel):
    position: GridPosition
    base: Optional[Base] = None
    is_unlocked: bool = False
    depth: int = 0


class CityCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)


class City(BaseModel):
    id: str
    name: str
    player_id: str
    grid: list[list[GridCell]]
    resources: Resources = Field(default_factory=Resources)
    resource_capacity: ResourceCapacity = Field(default_factory=ResourceCapacity)
    created_at: datetime

    class Config:
        from_attributes = True


class CityUpdate(BaseModel):
    name: Optional[str] = None
    resources: Optional[Resources] = None
