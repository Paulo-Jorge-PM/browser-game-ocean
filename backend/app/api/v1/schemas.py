from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

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


class V1GridPosition(BaseModel):
    x: int
    y: int


class V1Base(BaseModel):
    id: str
    type: BaseType
    position: V1GridPosition
    level: int = 1
    construction_progress: int = 100
    is_operational: bool = True
    workers: int = 0
    action_id: Optional[str] = None
    construction_started_at: Optional[datetime] = None
    construction_ends_at: Optional[datetime] = None


class V1GridCell(BaseModel):
    position: V1GridPosition
    base: Optional[V1Base] = None
    is_unlocked: bool = False
    depth: int = 0


class V1Resources(BaseModel):
    population: int = 10
    food: int = 100
    oxygen: int = 100
    water: int = 100
    energy: int = 50
    minerals: int = 50
    tech_points: int = 0


class V1ResourceCapacity(BaseModel):
    population: int = 50
    food: int = 500
    oxygen: int = 500
    water: int = 500
    energy: int = 200
    minerals: int = 200
    tech_points: int = 1000


class V1City(BaseModel):
    id: str
    name: str
    player_id: str
    grid: list[list[V1GridCell]]
    resources: V1Resources = Field(default_factory=V1Resources)
    resource_capacity: V1ResourceCapacity = Field(default_factory=V1ResourceCapacity)
    created_at: datetime


class V1CityCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)


class V1CityState(BaseModel):
    city_id: str
    name: str
    grid: list[list[V1GridCell]]
    resources: V1Resources = Field(default_factory=V1Resources)
    resource_capacity: V1ResourceCapacity = Field(default_factory=V1ResourceCapacity)
    unlocked_techs: list[str] = Field(default_factory=lambda: [
        "basic_construction",
        "life_support",
        "power_generation",
        "storage_systems",
    ])
    current_research: Optional[str] = None


class V1BuildStartRequest(BaseModel):
    city_id: str
    base_type: BaseType
    position: V1GridPosition


class V1BuildCompleteRequest(BaseModel):
    city_id: str
    base_id: str
    position: V1GridPosition


class V1BootstrapResponse(BaseModel):
    city: V1CityState


class V1AdminResetResponse(BaseModel):
    status: str


class V1Player(BaseModel):
    id: str
    username: str
    email: str
    city_id: Optional[str] = None
    region: str
    country: str
    created_at: datetime
