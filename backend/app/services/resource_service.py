"""
Resource Service - Handles resource calculation and synchronization.

Resources are calculated based on:
1. Production from operational buildings
2. Consumption from operational buildings
3. Time elapsed since last sync

The server is the source of truth. Frontend calculates locally for smooth UI,
but syncs with backend periodically to prevent drift/cheating.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from bson import ObjectId

from ..core.database import get_database
from ..core.config import settings
from ..core.base_definitions import BASE_DEFINITIONS, get_base_definition


# Default resource values
DEFAULT_RESOURCES = {
    "population": 10,
    "food": 100,
    "oxygen": 100,
    "water": 100,
    "energy": 50,
    "minerals": 50,
    "tech_points": 0,
}

DEFAULT_CAPACITY = {
    "population": 50,
    "food": 500,
    "oxygen": 500,
    "water": 500,
    "energy": 200,
    "minerals": 200,
    "tech_points": 1000,
}

RESOURCE_KEYS = ["population", "food", "oxygen", "water", "energy", "minerals", "tech_points"]


class ProductionRates(BaseModel):
    """Production and consumption rates per minute."""

    production: dict[str, float]
    consumption: dict[str, float]
    net: dict[str, float]  # production - consumption


class ResourceSyncResult(BaseModel):
    """Result of a resource sync operation."""

    resources: dict[str, int]
    capacity: dict[str, int]
    production_rates: ProductionRates
    last_synced_at: datetime
    drift_detected: bool = False
    drift_details: Optional[dict[str, dict]] = None


async def calculate_production_rates(city_id: str) -> ProductionRates:
    """
    Calculate production and consumption rates from operational buildings.

    Returns rates per MINUTE.
    """
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    production = {k: 0.0 for k in RESOURCE_KEYS}
    consumption = {k: 0.0 for k in RESOURCE_KEYS}

    grid = city_doc.get("grid", [])

    for row in grid:
        for cell in row:
            base = cell.get("base")
            if not base or not base.get("is_operational"):
                continue

            base_type = base.get("type")
            if base_type not in BASE_DEFINITIONS:
                continue

            base_def = get_base_definition(base_type)

            # Add production
            for resource, rate in base_def.get("production", {}).items():
                if resource in production:
                    production[resource] += rate

            # Add consumption
            for resource, rate in base_def.get("consumption", {}).items():
                if resource in consumption:
                    consumption[resource] += rate

    # Add population-based consumption (must match frontend!)
    # Frontend: gameStore.ts:552-556
    resources = city_doc.get("resources", {})
    population = resources.get("population", DEFAULT_RESOURCES["population"])
    consumption["food"] += population * 0.5
    consumption["oxygen"] += population * 0.3
    consumption["water"] += population * 0.2

    # Calculate net rates
    net = {k: production[k] - consumption[k] for k in RESOURCE_KEYS}

    return ProductionRates(
        production=production,
        consumption=consumption,
        net=net,
    )


async def calculate_capacity(city_id: str) -> dict[str, int]:
    """
    Calculate total resource capacity including storage hub bonuses.
    """
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    # Start with default capacity
    capacity = dict(DEFAULT_CAPACITY)

    grid = city_doc.get("grid", [])

    for row in grid:
        for cell in row:
            base = cell.get("base")
            if not base or not base.get("is_operational"):
                continue

            base_type = base.get("type")
            if base_type not in BASE_DEFINITIONS:
                continue

            base_def = get_base_definition(base_type)

            # Add storage bonuses
            for resource, bonus in base_def.get("storage_bonus", {}).items():
                if resource in capacity:
                    capacity[resource] += bonus

    return capacity


async def calculate_resources_at_time(
    city_id: str,
    at_time: Optional[datetime] = None,
) -> dict[str, int]:
    """
    Calculate what resources should be at a given time.

    Based on last synced values + production rates * elapsed time.
    """
    if at_time is None:
        at_time = datetime.now(timezone.utc)

    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    resources = city_doc.get("resources", dict(DEFAULT_RESOURCES))
    capacity = await calculate_capacity(city_id)

    # Get last synced time
    last_synced = city_doc.get("resources_last_synced_at")
    if last_synced is None:
        # No previous sync, use current resources as-is
        return resources

    if isinstance(last_synced, str):
        last_synced = datetime.fromisoformat(last_synced.replace("Z", "+00:00"))
    if last_synced.tzinfo is None:
        last_synced = last_synced.replace(tzinfo=timezone.utc)

    # Calculate elapsed time in minutes
    elapsed = (at_time - last_synced).total_seconds() / 60.0

    if elapsed <= 0:
        return resources

    # Get production rates
    rates = await calculate_production_rates(city_id)

    # Apply rates to resources
    new_resources = {}
    for resource in RESOURCE_KEYS:
        if resource == "population":
            # Population handled separately below
            new_resources[resource] = resources.get(resource, 0)
        else:
            current = resources.get(resource, 0)
            net_rate = rates.net.get(resource, 0)
            new_value = current + (net_rate * elapsed)

            # Clamp to 0 and capacity
            new_value = max(0, min(new_value, capacity.get(resource, 1000)))
            new_resources[resource] = int(new_value)

    # Population growth/decline logic (must match frontend!)
    # Frontend: gameStore.ts:587-601
    population = new_resources.get("population", 10)
    food = new_resources.get("food", 0)
    oxygen = new_resources.get("oxygen", 0)
    water = new_resources.get("water", 0)

    has_food = food > population
    has_oxygen = oxygen > population * 0.5
    has_water = water > population * 0.3

    if has_food and has_oxygen and has_water:
        # Growth: 0.01 per minute
        growth_rate = 0.01 * elapsed
        population = min(population + growth_rate, capacity.get("population", 50))
    elif not has_food or not has_oxygen or not has_water:
        # Decline: 0.05 per minute
        decline_rate = 0.05 * elapsed
        population = max(1, population - decline_rate)

    new_resources["population"] = int(population)

    return new_resources


async def sync_resources(
    city_id: str,
    player_id: str,
    client_resources: dict[str, int],
) -> ResourceSyncResult:
    """
    Sync resources with client.

    1. Calculate expected resources based on time elapsed
    2. Compare with client values
    3. Use server values (with tolerance check for drift detection)
    4. Update database with new sync timestamp
    """
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    if city_doc["player_id"] != player_id:
        raise ValueError("Not your city")

    now = datetime.now(timezone.utc)

    # Calculate what resources should be
    expected_resources = await calculate_resources_at_time(city_id, now)
    capacity = await calculate_capacity(city_id)
    rates = await calculate_production_rates(city_id)

    # Calculate tolerance (5 seconds worth of production for each resource)
    tolerance_seconds = settings.error_tolerance_seconds
    tolerance = {}
    for resource in RESOURCE_KEYS:
        # Tolerance is based on net rate per second * tolerance seconds
        net_per_second = abs(rates.net.get(resource, 0)) / 60.0
        tolerance[resource] = int(net_per_second * tolerance_seconds) + 1  # +1 for rounding

    # Check for drift
    drift_detected = False
    drift_details = {}

    for resource in RESOURCE_KEYS:
        client_val = client_resources.get(resource, 0)
        expected_val = expected_resources.get(resource, 0)
        diff = abs(client_val - expected_val)
        resource_tolerance = tolerance.get(resource, 5)

        if diff > resource_tolerance:
            drift_detected = True
            drift_details[resource] = {
                "client": client_val,
                "expected": expected_val,
                "difference": diff,
                "tolerance": resource_tolerance,
            }

    # Always use server-calculated values (server is source of truth)
    final_resources = expected_resources

    # Update city with new resources and sync timestamp
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {
            "$set": {
                "resources": final_resources,
                "resources_last_synced_at": now,
            }
        },
    )

    return ResourceSyncResult(
        resources=final_resources,
        capacity=capacity,
        production_rates=rates,
        last_synced_at=now,
        drift_detected=drift_detected,
        drift_details=drift_details if drift_detected else None,
    )


async def get_current_resources(city_id: str) -> dict:
    """
    Get current resources calculated based on elapsed time.

    Also returns production rates and capacity.
    """
    now = datetime.now(timezone.utc)
    resources = await calculate_resources_at_time(city_id, now)
    capacity = await calculate_capacity(city_id)
    rates = await calculate_production_rates(city_id)

    return {
        "resources": resources,
        "capacity": capacity,
        "production_rates": rates.model_dump(),
        "calculated_at": now.isoformat(),
    }


async def deduct_resources(city_id: str, costs: dict[str, int]) -> dict[str, int]:
    """
    Deduct resources from a city.

    First syncs resources to current time, then deducts.

    Raises ValueError if insufficient resources.
    """
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    now = datetime.now(timezone.utc)

    # Calculate current resources
    resources = await calculate_resources_at_time(city_id, now)

    # Check if we have enough
    for resource, cost in costs.items():
        if resources.get(resource, 0) < cost:
            raise ValueError(f"Insufficient {resource}")

    # Deduct
    for resource, cost in costs.items():
        resources[resource] = resources.get(resource, 0) - cost

    # Update
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {
            "$set": {
                "resources": resources,
                "resources_last_synced_at": now,
            }
        },
    )

    return resources


async def add_resources(city_id: str, amounts: dict[str, int]) -> dict[str, int]:
    """
    Add resources to a city (e.g., from completed action rewards).

    Respects capacity limits.
    """
    db = get_database()

    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    if not city_doc:
        raise ValueError("City not found")

    now = datetime.now(timezone.utc)

    # Calculate current resources
    resources = await calculate_resources_at_time(city_id, now)
    capacity = await calculate_capacity(city_id)

    # Add resources, capping at capacity
    for resource, amount in amounts.items():
        current = resources.get(resource, 0)
        cap = capacity.get(resource, 1000)
        resources[resource] = min(current + amount, cap)

    # Update
    await db.cities.update_one(
        {"_id": ObjectId(city_id)},
        {
            "$set": {
                "resources": resources,
                "resources_last_synced_at": now,
            }
        },
    )

    return resources
