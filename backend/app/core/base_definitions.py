from typing import Literal, TypedDict

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

ConnectionSide = Literal["top", "bottom", "left", "right"]


class BaseDefinition(TypedDict):
    build_time_seconds: int
    workers_required: int
    cost: dict[str, int]
    production: dict[str, int]  # Resources produced per minute
    consumption: dict[str, int]  # Resources consumed per minute
    connection_sides: list[ConnectionSide]
    storage_bonus: dict[str, int]  # Capacity bonus (for storage_hub)


BASE_DEFINITIONS: dict[BaseType, BaseDefinition] = {
    "command_ship": {
        "build_time_seconds": 0,
        "workers_required": 5,
        "cost": {},
        "production": {"energy": 50, "minerals": 50, "food": 50, "oxygen": 50, "water": 50, "tech_points": 50},
        "consumption": {},
        "connection_sides": ["bottom", "left", "right"],
        "storage_bonus": {},
    },
    "residential": {
        "build_time_seconds": 30,
        "workers_required": 2,
        "cost": {"minerals": 50, "energy": 20},
        "production": {"population": 20},
        "consumption": {"energy": 5, "oxygen": 10, "water": 10, "food": 15},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
    "hydroponic_farm": {
        "build_time_seconds": 45,
        "workers_required": 3,
        "cost": {"minerals": 30, "energy": 15},
        "production": {"food": 25},
        "consumption": {"energy": 8, "water": 5},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
    "kelp_forest": {
        "build_time_seconds": 20,
        "workers_required": 1,
        "cost": {"minerals": 20},
        "production": {"food": 10, "oxygen": 15},
        "consumption": {},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
    "mining_rig": {
        "build_time_seconds": 60,
        "workers_required": 5,
        "cost": {"minerals": 40, "energy": 30},
        "production": {"minerals": 20},
        "consumption": {"energy": 15},
        "connection_sides": ["top", "left", "right"],
        "storage_bonus": {},
    },
    "oxygen_generator": {
        "build_time_seconds": 40,
        "workers_required": 2,
        "cost": {"minerals": 35, "energy": 25},
        "production": {"oxygen": 30},
        "consumption": {"energy": 12, "water": 5},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
    "water_purifier": {
        "build_time_seconds": 40,
        "workers_required": 2,
        "cost": {"minerals": 35, "energy": 25},
        "production": {"water": 35},
        "consumption": {"energy": 10},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
    "power_plant": {
        "build_time_seconds": 90,
        "workers_required": 4,
        "cost": {"minerals": 60},
        "production": {"energy": 50},
        "consumption": {"minerals": 2},
        "connection_sides": ["top", "left", "right"],
        "storage_bonus": {},
    },
    "comms_tower": {
        "build_time_seconds": 60,
        "workers_required": 2,
        "cost": {"minerals": 80, "energy": 40},
        "production": {},
        "consumption": {"energy": 20},
        "connection_sides": ["bottom"],
        "storage_bonus": {},
    },
    "defense_platform": {
        "build_time_seconds": 90,
        "workers_required": 6,
        "cost": {"minerals": 100, "energy": 50},
        "production": {},
        "consumption": {"energy": 25},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
    "shipyard": {
        "build_time_seconds": 120,
        "workers_required": 8,
        "cost": {"minerals": 120, "energy": 60},
        "production": {},
        "consumption": {"energy": 30, "minerals": 5},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
    "research_lab": {
        "build_time_seconds": 75,
        "workers_required": 4,
        "cost": {"minerals": 80, "energy": 50},
        "production": {"tech_points": 10},
        "consumption": {"energy": 20},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
    "storage_hub": {
        "build_time_seconds": 30,
        "workers_required": 1,
        "cost": {"minerals": 40, "energy": 20},
        "production": {},
        "consumption": {"energy": 5},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {"food": 100, "oxygen": 100, "water": 100, "energy": 50, "minerals": 50},
    },
    "trade_hub": {
        "build_time_seconds": 120,
        "workers_required": 5,
        "cost": {"minerals": 150, "energy": 80},
        "production": {},
        "consumption": {"energy": 25},
        "connection_sides": ["top", "bottom", "left", "right"],
        "storage_bonus": {},
    },
}


def get_base_definition(base_type: BaseType) -> BaseDefinition:
    if base_type not in BASE_DEFINITIONS:
        raise ValueError(f"Unknown base type: {base_type}")
    return BASE_DEFINITIONS[base_type]


# Tech tree definitions
class TechDefinition(TypedDict):
    name: str
    description: str
    cost: int  # Tech points required
    research_time_seconds: int
    prerequisites: list[str]
    unlocks: list[str]  # Base types or features unlocked
    tier: int
    category: str  # 'infrastructure', 'military', 'exploration', 'economy'


TECH_DEFINITIONS: dict[str, TechDefinition] = {
    # Tier 1 - Basic (unlocked by default, cost 0)
    "basic_construction": {
        "name": "Basic Construction",
        "description": "Fundamental underwater construction techniques.",
        "cost": 0,
        "research_time_seconds": 0,
        "prerequisites": [],
        "unlocks": ["residential", "hydroponic_farm", "kelp_forest", "mining_rig"],
        "tier": 1,
        "category": "infrastructure",
    },
    "life_support": {
        "name": "Life Support Systems",
        "description": "Essential systems for underwater survival.",
        "cost": 0,
        "research_time_seconds": 0,
        "prerequisites": [],
        "unlocks": ["oxygen_generator", "water_purifier"],
        "tier": 1,
        "category": "infrastructure",
    },
    "power_generation": {
        "name": "Power Generation",
        "description": "Harness thermal energy from ocean vents.",
        "cost": 0,
        "research_time_seconds": 0,
        "prerequisites": [],
        "unlocks": ["power_plant"],
        "tier": 1,
        "category": "infrastructure",
    },
    "storage_systems": {
        "name": "Storage Systems",
        "description": "Efficient resource storage solutions.",
        "cost": 0,
        "research_time_seconds": 0,
        "prerequisites": [],
        "unlocks": ["storage_hub"],
        "tier": 1,
        "category": "economy",
    },

    # Tier 2 - Advanced
    "advanced_research": {
        "name": "Advanced Research",
        "description": "Establish dedicated research facilities.",
        "cost": 50,
        "research_time_seconds": 120,
        "prerequisites": ["basic_construction", "power_generation"],
        "unlocks": ["research_lab"],
        "tier": 2,
        "category": "infrastructure",
    },
    "telecommunications": {
        "name": "Telecommunications",
        "description": "Long-range underwater communication systems.",
        "cost": 80,
        "research_time_seconds": 180,
        "prerequisites": ["advanced_research"],
        "unlocks": ["comms_tower"],
        "tier": 2,
        "category": "infrastructure",
    },
    "defense_systems": {
        "name": "Defense Systems",
        "description": "Protect your city from threats.",
        "cost": 100,
        "research_time_seconds": 240,
        "prerequisites": ["advanced_research"],
        "unlocks": ["defense_platform"],
        "tier": 2,
        "category": "military",
    },
    "naval_construction": {
        "name": "Naval Construction",
        "description": "Build underwater vessels for exploration and combat.",
        "cost": 120,
        "research_time_seconds": 300,
        "prerequisites": ["defense_systems"],
        "unlocks": ["shipyard"],
        "tier": 2,
        "category": "military",
    },

    # Tier 3 - Expert
    "trade_routes": {
        "name": "Trade Routes",
        "description": "Establish trade connections with other cities.",
        "cost": 150,
        "research_time_seconds": 360,
        "prerequisites": ["telecommunications"],
        "unlocks": ["trade_hub"],
        "tier": 3,
        "category": "economy",
    },
    "deep_exploration": {
        "name": "Deep Exploration",
        "description": "Explore the deepest parts of the ocean.",
        "cost": 200,
        "research_time_seconds": 420,
        "prerequisites": ["naval_construction"],
        "unlocks": [],
        "tier": 3,
        "category": "exploration",
    },
    "artifact_analysis": {
        "name": "Artifact Analysis",
        "description": "Study pre-war artifacts to unlock ancient knowledge.",
        "cost": 180,
        "research_time_seconds": 400,
        "prerequisites": ["deep_exploration"],
        "unlocks": [],
        "tier": 3,
        "category": "exploration",
    },
    "advanced_weapons": {
        "name": "Advanced Weapons",
        "description": "Develop powerful weapons for city defense.",
        "cost": 250,
        "research_time_seconds": 480,
        "prerequisites": ["naval_construction", "artifact_analysis"],
        "unlocks": [],
        "tier": 3,
        "category": "military",
    },

    # Tier 4 - Master
    "world_government": {
        "name": "World Government",
        "description": "Participate in global politics and diplomacy.",
        "cost": 300,
        "research_time_seconds": 600,
        "prerequisites": ["trade_routes", "telecommunications"],
        "unlocks": [],
        "tier": 4,
        "category": "economy",
    },
    "quantum_communications": {
        "name": "Quantum Communications",
        "description": "Instant secure communication across the globe.",
        "cost": 400,
        "research_time_seconds": 720,
        "prerequisites": ["world_government"],
        "unlocks": [],
        "tier": 4,
        "category": "infrastructure",
    },
}


def get_tech_definition(tech_id: str) -> TechDefinition:
    if tech_id not in TECH_DEFINITIONS:
        raise ValueError(f"Unknown tech: {tech_id}")
    return TECH_DEFINITIONS[tech_id]


def can_research_tech(tech_id: str, unlocked_techs: list[str]) -> bool:
    """Check if a tech can be researched given current unlocked techs."""
    if tech_id not in TECH_DEFINITIONS:
        return False
    if tech_id in unlocked_techs:
        return False
    tech = TECH_DEFINITIONS[tech_id]
    return all(prereq in unlocked_techs for prereq in tech["prerequisites"])
