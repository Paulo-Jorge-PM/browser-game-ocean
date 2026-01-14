from datetime import datetime, timezone
import uuid

from ..core.config import settings


def create_empty_grid(width: int, height: int) -> list[list[dict]]:
    grid = []
    for y in range(height):
        row = []
        for x in range(width):
            row.append(
                {
                    "position": {"x": x, "y": y},
                    "base": None,
                    "is_unlocked": y == 0,
                    "depth": y,
                }
            )
        grid.append(row)
    return grid


def build_new_city_document(name: str, player_id: str) -> dict:
    grid = create_empty_grid(settings.grid_default_width, settings.grid_default_height)

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

    for dx in [-1, 0, 1]:
        nx = center_x + dx
        if 0 <= nx < settings.grid_default_width:
            grid[0][nx]["is_unlocked"] = True
    if settings.grid_default_height > 1:
        grid[1][center_x]["is_unlocked"] = True

    # Default unlocked techs - Tier 1 techs that have no prerequisites and cost 0
    default_unlocked_techs = [
        "basic_construction",
        "life_support",
        "power_generation",
        "storage_systems",
    ]

    city_doc = {
        "name": name,
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
        "unlocked_techs": default_unlocked_techs,
        "current_research": None,
        "created_at": datetime.now(timezone.utc),
    }
    return city_doc


def city_doc_to_state(city_doc: dict) -> dict:
    # Default unlocked techs for existing cities without the field
    default_unlocked_techs = [
        "basic_construction",
        "life_support",
        "power_generation",
        "storage_systems",
    ]

    return {
        "city_id": str(city_doc["_id"]),
        "name": city_doc.get("name"),
        "grid": city_doc.get("grid", []),
        "resources": city_doc.get("resources", {}),
        "resource_capacity": city_doc.get("resource_capacity", {}),
        "unlocked_techs": city_doc.get("unlocked_techs", default_unlocked_techs),
        "current_research": city_doc.get("current_research"),
    }
