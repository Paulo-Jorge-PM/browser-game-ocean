# Ocean Depths - Project Documentation

An underwater city-builder browser game built with React, PixiJS 8, Zustand, and a Python FastAPI backend with MongoDB.

## Current Status (January 2026)

**Working Features:**
- Grid cells visible and clickable
- Building placement with construction progress bars
- SVG sprites for all 15 structure types
- Visual effects (waves, clouds, bubbles, parallax background)
- Resource management and production/consumption
- Backend persistence to MongoDB
- WebSocket reconnection with state recovery

**Recently Fixed Bugs:**
- Duplicate canvas issue (React StrictMode creating two PixiJS Applications)
- Grid visibility (layer ordering in PixiJS)
- Click blocking (eventMode on visual effect systems)

## Project Structure

```
browser-game-ocean/
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/          # React UI components
│   │   │   ├── hud/             # ResourceBar, ConnectionStatus
│   │   │   ├── game/            # BottomPanel, TechTreePanel, etc.
│   │   │   └── ui/              # Reusable UI components
│   │   ├── game/                # PixiJS game logic
│   │   │   ├── core/            # GameCanvas.tsx, ViewportController.ts
│   │   │   ├── entities/        # Worker.ts, Structure.ts
│   │   │   ├── rendering/       # SpriteManager.ts
│   │   │   └── systems/         # Bubbles, WaveSystem, CloudSystem, FogOfWar, ParallaxBackground
│   │   ├── stores/              # gameStore.ts (Zustand)
│   │   ├── services/            # socket.ts
│   │   └── types/               # TypeScript types
│   └── public/
│       └── assets/sprites/      # 15 SVG sprite files
│
└── backend/                     # Python FastAPI + MongoDB
    └── app/
        ├── api/v1/              # cities.py, players.py, auth.py
        ├── sockets/             # manager.py (Socket.IO handlers)
        ├── models/              # city.py, player.py, resource.py
        └── core/                # config.py, database.py, security.py
```

## Architecture

### Frontend Stack
- **React 18** with Vite
- **PixiJS 8** - 2D WebGL rendering
- **Zustand** - State management
- **Socket.IO Client** - Real-time WebSocket
- **Tailwind CSS** - Styling

### Backend Stack
- **FastAPI** - Python async web framework
- **Socket.IO (python-socketio)** - WebSocket server
- **Motor** - Async MongoDB driver
- **MongoDB** - Document database

## Critical Technical Details

### PixiJS Layer Order (GameCanvas.tsx)
The order of `addChild()` determines z-order. First added = drawn behind, last added = drawn on top.

**Current order (correct):**
1. ParallaxBackground (far behind)
2. CloudSystem (sky area)
3. BubbleSystem (water area)
4. **GridContainer** (main game - visible on top of backgrounds)
5. WaveSystem (surface waves overlay)

### Event Mode for Visual Effects
All visual effect systems have `eventMode = 'none'` on their containers to allow clicks to pass through to the grid:
- `ParallaxBackground.ts` - line 28
- `CloudSystem.ts` - line 22
- `Bubbles.ts` - line 23
- `WaveSystem.ts` - line 21
- `FogOfWar.ts` - lines 32, 37

### React StrictMode Canvas Fix (GameCanvas.tsx)
React StrictMode runs effects twice. To prevent duplicate canvases:
1. Clear existing canvases before init (lines 372-375)
2. Track `destroyed` flag for async init (line 377)
3. Check destroyed after async completes (lines 387-391)
4. Remove canvases in cleanup (lines 611-615)

### Grid Cell Click Handling
- `cellContainer.eventMode = 'static'` makes cells interactive
- Click handler at lines 170-180 in GameCanvas.tsx
- Calls `selectCell()` from gameStore

## Key Files

### Frontend Critical Files
| File | Purpose |
|------|---------|
| `src/game/core/GameCanvas.tsx` | Main PixiJS rendering, layer ordering, event handling |
| `src/game/rendering/SpriteManager.ts` | Loads SVG textures via PixiJS Assets |
| `src/stores/gameStore.ts` | Zustand state, `hydrateFromServer`, construction queue |
| `src/services/socket.ts` | Socket.IO client, reconnection, status callbacks |
| `src/App.tsx` | Entry point, loads city from API on init |
| `src/game/systems/FogOfWar.ts` | Fog overlay for unexplored depths |

### Backend Critical Files
| File | Purpose |
|------|---------|
| `backend/app/sockets/manager.py` | WebSocket events: build_base, request_city_state, update_construction |
| `backend/app/api/v1/cities.py` | REST endpoints for city CRUD |
| `backend/app/core/database.py` | MongoDB connection (Motor) |

## Structure Types (15 total)

| Type | Description | SVG File |
|------|-------------|----------|
| command_ship | Central hub, starting structure | command_ship.svg |
| residential | Population housing | residential.svg |
| hydroponic_farm | Food production | hydroponic_farm.svg |
| kelp_forest | Passive food/oxygen | kelp_forest.svg |
| mining_rig | Mineral extraction | mining_rig.svg |
| oxygen_generator | Oxygen production | oxygen_generator.svg |
| water_purifier | Water purification | water_purifier.svg |
| power_plant | Energy generation | power_plant.svg |
| comms_tower | Communication range | comms_tower.svg |
| defense_platform | Defense capabilities | defense_platform.svg |
| shipyard | Vehicle construction | shipyard.svg |
| research_lab | Tech point generation | research_lab.svg |
| storage_hub | Resource capacity increase | storage_hub.svg |
| trade_hub | Trade capabilities | trade_hub.svg |
| construction | Under-construction placeholder | construction.svg |

## Running the Project

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### MongoDB
Ensure MongoDB is running locally or set `MONGODB_URL` environment variable.

## WebSocket Events

### Client → Server
| Event | Data | Purpose |
|-------|------|---------|
| `join_city` | `{ city_id }` | Join city room for updates |
| `build_base` | `{ city_id, base, position }` | Build structure (persists to DB) |
| `request_city_state` | `{ city_id }` | Request full state (reconnection) |
| `update_construction` | `{ city_id, base_id, position, is_operational }` | Mark construction complete |

### Server → Client
| Event | Data | Purpose |
|-------|------|---------|
| `city_state` | Full city data | State hydration on reconnect |
| `base_built` | `{ city_id, base, position, timestamp }` | Confirm build success |
| `build_error` | `{ error }` | Build failed |

## Known Issues / TODO

### Immediate
1. Test full persistence flow end-to-end
2. Add city creation flow (name input, save to DB)
3. Sync construction completion to backend (call `update_construction` when done)

### Short Term
- Resource production synced server-side (server ticks)
- Multiple players/cities support
- Trade system between players

### Long Term
- Map exploration with submarines
- Deep sea creatures and events
- Tech tree expansion
- Achievement system

## Common Debugging

### Grid not visible
- Check layer order in GameCanvas.tsx initialization (~lines 384-435)
- Ensure grid container is added AFTER background systems

### Clicks not working
- Check `eventMode = 'none'` on all visual effect system containers
- Check FogOfWar graphics have `eventMode = 'none'`
- Check for duplicate canvases (React StrictMode issue)

### Duplicate canvases
- Check GameCanvas.tsx cleanup function (~lines 594-617)
- Ensure `destroyed` flag is set and checked
- Ensure container children are cleared before init

### Sprites not showing
- Check SpriteManager.loadAssets() completes before drawGrid()
- Check sprite files exist in public/assets/sprites/
- Check spriteManager.isLoaded() returns true
