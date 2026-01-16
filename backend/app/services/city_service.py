from datetime import datetime, timezone
import uuid

from ..core.config import settings


def create_empty_grid(width: int, height: int) -> list[list[dict]]:
    grid = []
    above_rows = settings.grid_above_surface_rows
    total_height = height + above_rows
    for row_index in range(total_height):
        row = []
        for x in range(width):
            world_y = row_index - above_rows
            row.append(
                {
                    "position": {"x": x, "y": world_y},
                    "base": None,
                    "is_unlocked": world_y <= 0,
                    "depth": world_y,
                }
            )
        grid.append(row)
    return grid


def build_new_city_document(name: str, player_id: str) -> dict:
    grid = create_empty_grid(settings.grid_default_width, settings.grid_default_height)

    surface_row_index = settings.grid_above_surface_rows
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
    grid[surface_row_index][center_x]["base"] = command_ship
    grid[surface_row_index][center_x]["is_unlocked"] = True

    for dx in [-1, 0, 1]:
        nx = center_x + dx
        if 0 <= nx < settings.grid_default_width:
            grid[surface_row_index][nx]["is_unlocked"] = True
    if settings.grid_default_height > 1:
        grid[surface_row_index + 1][center_x]["is_unlocked"] = True

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
