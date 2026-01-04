# Ocean Depths - Project Documentation

An underwater city-builder browser game built with React, PixiJS 8, Zustand, and a Python FastAPI backend with MongoDB.

## Project Structure

```
browser-game-ocean/
├── frontend/                    # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/          # React UI components
│   │   │   ├── hud/             # HUD components (ResourceBar, ConnectionStatus)
│   │   │   ├── game/            # Game panels (BottomPanel, TechTree, etc.)
│   │   │   └── ui/              # Reusable UI components
│   │   ├── game/                # PixiJS game logic
│   │   │   ├── core/            # GameCanvas, main rendering
│   │   │   ├── entities/        # Game entities (workers, etc.)
│   │   │   ├── grid/            # Grid management
│   │   │   ├── rendering/       # SpriteManager, visual effects
│   │   │   └── systems/         # Game systems (bubbles, waves, clouds)
│   │   ├── stores/              # Zustand state management
│   │   ├── services/            # Socket service, API
│   │   ├── types/               # TypeScript types
│   │   └── assets/              # Static assets
│   └── public/
│       └── assets/sprites/      # SVG sprite images (15 structure types)
│
└── backend/                     # Python FastAPI + MongoDB
    └── app/
        ├── api/v1/              # REST endpoints (cities, players, auth)
        ├── sockets/             # Socket.IO WebSocket handlers
        ├── models/              # Pydantic models
        └── core/                # Config, database, security
```

## Architecture

### Frontend Stack
- **React 18** - UI framework
- **PixiJS 8** - 2D WebGL rendering for game canvas
- **Zustand** - State management
- **Socket.IO Client** - Real-time WebSocket communication
- **Tailwind CSS** - Styling

### Backend Stack
- **FastAPI** - Python async web framework
- **Socket.IO (python-socketio)** - WebSocket server
- **Motor** - Async MongoDB driver
- **MongoDB** - Document database for persistence

## Completed Features

### Visual Systems (Phase 1)
- [x] Grid-based cell rendering with depth-based darkening
- [x] SVG sprite loading for all 15 structure types
- [x] Construction progress bars with real-time animation
- [x] Wave system with animated surface waves
- [x] Cloud system for sky parallax
- [x] Parallax background layers
- [x] Bubble system (rising bubbles)
- [x] Fog of war for locked cells
- [x] Worker entities with movement animations
- [x] Viewport controller with scroll/zoom

### State Management
- [x] Zustand store for game state
- [x] Resource production/consumption calculations
- [x] Construction queue with timed completion
- [x] Tech tree unlocking system
- [x] Grid cell unlock logic based on connections

### Backend Persistence (Phase 2 - Just Completed)
- [x] MongoDB integration for city state
- [x] `build_base` WebSocket event persists to database
- [x] `request_city_state` event for state recovery
- [x] `update_construction` event for construction completion
- [x] Heartbeat configuration (ping_interval=25, ping_timeout=20)

### Frontend Sync (Phase 2 - Just Completed)
- [x] `hydrateFromServer` action for state restoration
- [x] City ID stored in localStorage
- [x] App loads city from API on init
- [x] Socket reconnection recovery with state sync
- [x] ConnectionStatus component with visual feedback

## Structure Types

| Type | Icon | Description |
|------|------|-------------|
| command_ship | Ship | Central hub, starting structure |
| residential | Houses | Population housing |
| hydroponic_farm | Plant | Food production |
| kelp_forest | Seaweed | Passive food/oxygen |
| mining_rig | Pick | Mineral extraction |
| oxygen_generator | Bubbles | Oxygen production |
| water_purifier | Droplet | Water purification |
| power_plant | Lightning | Energy generation |
| comms_tower | Antenna | Communication range |
| defense_platform | Shield | Defense capabilities |
| shipyard | Anchor | Vehicle construction |
| research_lab | Flask | Tech point generation |
| storage_hub | Boxes | Resource capacity increase |
| trade_hub | Arrows | Trade capabilities |

## Key Files

### Frontend
- `src/game/core/GameCanvas.tsx` - Main PixiJS rendering loop
- `src/game/rendering/SpriteManager.ts` - SVG texture loading
- `src/stores/gameStore.ts` - Zustand state with `hydrateFromServer`
- `src/services/socket.ts` - Socket.IO client with reconnection
- `src/App.tsx` - Entry point, loads city from API

### Backend
- `backend/app/sockets/manager.py` - WebSocket event handlers
- `backend/app/api/v1/cities.py` - City REST endpoints
- `backend/app/core/database.py` - MongoDB connection

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

## Next Steps / Future Work

### Immediate
1. Test full persistence flow end-to-end
2. Add city creation flow (name input, save to DB)
3. Sync construction completion to backend

### Short Term
- Resource production synced server-side
- Multiple players/cities support
- Trade system between players
- Combat/defense mechanics

### Long Term
- Map exploration with submarines
- Deep sea creatures and events
- Tech tree expansion
- Achievement system
