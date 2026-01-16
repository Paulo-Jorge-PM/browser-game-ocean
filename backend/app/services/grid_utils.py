from ..core.config import settings


def get_row_offset(grid: list[list[dict]]) -> int:
    try:
        top_world_y = grid[0][0]["position"]["y"]
    except (IndexError, KeyError, TypeError):
        return settings.grid_above_surface_rows
    return -top_world_y


def world_y_to_index(grid: list[list[dict]], world_y: int) -> int:
    return world_y + get_row_offset(grid)


def index_to_world_y(grid: list[list[dict]], index: int) -> int:
    return index - get_row_offset(grid)
