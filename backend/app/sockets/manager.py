import socketio
from datetime import datetime, timezone
from bson import ObjectId
from ..core.security import decode_token
from ..core.database import get_database

# Create Socket.IO server with heartbeat settings
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    ping_interval=25,
    ping_timeout=20,
)


@sio.event
async def connect(sid, environ, auth):
    """Handle client connection."""
    print(f"Client connected: {sid}")

    # Optional: Verify JWT token from auth
    if auth and "token" in auth:
        try:
            payload = decode_token(auth["token"])
            user_id = payload.get("sub")
            await sio.save_session(sid, {"user_id": user_id})
            print(f"Authenticated user: {user_id}")
        except Exception as e:
            print(f"Auth failed: {e}")

    await sio.emit("connected", {"sid": sid}, to=sid)


@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    print(f"Client disconnected: {sid}")


@sio.event
async def join_city(sid, data):
    """Join a city room for real-time updates."""
    city_id = data.get("city_id")
    if city_id:
        await sio.enter_room(sid, f"city:{city_id}")
        print(f"Client {sid} joined city room: {city_id}")
        await sio.emit("joined_city", {"city_id": city_id}, to=sid)


@sio.event
async def leave_city(sid, data):
    """Leave a city room."""
    city_id = data.get("city_id")
    if city_id:
        await sio.leave_room(sid, f"city:{city_id}")
        print(f"Client {sid} left city room: {city_id}")


@sio.event
async def build_base(sid, data):
    """Handle base building request via WebSocket."""
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None

    city_id = data.get("city_id")
    base_data = data.get("base")
    position = data.get("position")

    if not city_id or not base_data or not position:
        await sio.emit("build_error", {"error": "Missing required data"}, to=sid)
        return

    try:
        db = get_database()
        city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})

        if not city_doc:
            await sio.emit("build_error", {"error": "City not found"}, to=sid)
            return

        x, y = position.get("x"), position.get("y")
        grid = city_doc["grid"]

        # Validate position
        if not (0 <= y < len(grid) and 0 <= x < len(grid[0])):
            await sio.emit("build_error", {"error": "Invalid position"}, to=sid)
            return

        cell = grid[y][x]
        if not cell.get("is_unlocked"):
            await sio.emit("build_error", {"error": "Cell is locked"}, to=sid)
            return

        if cell.get("base") is not None:
            await sio.emit("build_error", {"error": "Cell already has a base"}, to=sid)
            return

        # Place the base
        grid[y][x]["base"] = base_data

        # Unlock adjacent cells
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = x + dx, y + dy
            if 0 <= ny < len(grid) and 0 <= nx < len(grid[0]):
                grid[ny][nx]["is_unlocked"] = True

        # Update city in database
        await db.cities.update_one(
            {"_id": ObjectId(city_id)},
            {"$set": {"grid": grid}},
        )

        # Broadcast success to city room
        await sio.emit(
            "base_built",
            {
                "city_id": city_id,
                "base": base_data,
                "position": position,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            room=f"city:{city_id}",
        )
        print(f"Base built and persisted: {base_data.get('type')} at ({x}, {y})")

    except Exception as e:
        print(f"Error building base: {e}")
        await sio.emit("build_error", {"error": str(e)}, to=sid)


@sio.event
async def update_construction(sid, data):
    """Handle construction progress update (completion)."""
    city_id = data.get("city_id")
    base_id = data.get("base_id")
    position = data.get("position")
    is_operational = data.get("is_operational", True)

    if not city_id or not base_id or not position:
        await sio.emit("update_error", {"error": "Missing required data"}, to=sid)
        return

    try:
        db = get_database()
        x, y = position.get("x"), position.get("y")

        # Update the base in the database
        await db.cities.update_one(
            {"_id": ObjectId(city_id)},
            {
                "$set": {
                    f"grid.{y}.{x}.base.is_operational": is_operational,
                    f"grid.{y}.{x}.base.construction_progress": 100,
                }
            },
        )

        # Broadcast to city room
        await sio.emit(
            "construction_updated",
            {
                "city_id": city_id,
                "base_id": base_id,
                "position": position,
                "is_operational": is_operational,
            },
            room=f"city:{city_id}",
        )
        print(f"Construction completed for base {base_id}")

    except Exception as e:
        print(f"Error updating construction: {e}")
        await sio.emit("update_error", {"error": str(e)}, to=sid)


@sio.event
async def request_city_state(sid, data):
    """Send full city state to client (for reconnection recovery)."""
    city_id = data.get("city_id")

    if not city_id:
        await sio.emit("state_error", {"error": "Missing city_id"}, to=sid)
        return

    try:
        db = get_database()
        city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})

        if not city_doc:
            await sio.emit("state_error", {"error": "City not found"}, to=sid)
            return

        await sio.emit(
            "city_state",
            {
                "city_id": str(city_doc["_id"]),
                "name": city_doc.get("name"),
                "grid": city_doc.get("grid", []),
                "resources": city_doc.get("resources", {}),
                "resource_capacity": city_doc.get("resource_capacity", {}),
            },
            to=sid,
        )
        print(f"Sent city state to {sid} for city {city_id}")

    except Exception as e:
        print(f"Error sending city state: {e}")
        await sio.emit("state_error", {"error": str(e)}, to=sid)


@sio.event
async def chat_message(sid, data):
    """Handle chat messages."""
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else "anonymous"

    room = data.get("room", "global")
    message = data.get("message", "")

    await sio.emit(
        "chat_message",
        {
            "user_id": user_id,
            "message": message,
            "room": room,
        },
        room=room,
    )


# Utility function to broadcast city updates
async def broadcast_city_update(city_id: str, update_type: str, data: dict):
    """Broadcast an update to all clients in a city room."""
    await sio.emit(
        "city_update",
        {"type": update_type, "data": data},
        room=f"city:{city_id}",
    )


# Utility function to broadcast resource ticks
async def broadcast_resource_tick(city_id: str, resources: dict):
    """Broadcast resource update to city room."""
    await sio.emit(
        "resource_tick",
        {"resources": resources},
        room=f"city:{city_id}",
    )
