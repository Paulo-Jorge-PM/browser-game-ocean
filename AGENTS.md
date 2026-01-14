# Repository Guidelines

## Project Structure & Module Organization
- `frontend/src` holds the React + PixiJS client: `components/` (HUD/UI), `game/` (core, entities, rendering, systems), `stores/` (Zustand), `services/`, `types/`.
- `frontend/public/assets/sprites` contains the SVG sprites (15 structure types).
- `backend/app` is the FastAPI + Socket.IO service with `api/v1`, `core`, `models`, `sockets`.
- `backend/tests` is the pytest root (add tests under `test_*.py`).
- `docker-compose.yml` defines MongoDB/Redis plus optional app containers.
- `start.sh` and `stop.sh` manage local dev orchestration.

## Build, Test, and Development Commands
- `./start.sh` runs local dev with Docker infra and local backend/frontend processes.
- `./start.sh infra` runs MongoDB + Redis only.
- `./start.sh docker` runs the full Docker stack.
- `./stop.sh` stops containers and background processes.
- Backend: `cd backend`, `poetry install`, `poetry run dev`, `poetry run pytest`.
- Frontend: `cd frontend`, `npm install`, `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.

## Coding Style & Naming Conventions
- Python 3.11: 4-space indents, Black + isort (line length 100), Ruff, mypy.
- TypeScript/React: 2-space indents, ESLint (`npm run lint`).
- Naming: Python uses snake_case; React components use PascalCase (example: `GameCanvas.tsx`).

## Testing Guidelines
- Backend tests use pytest + pytest-asyncio; keep `backend/tests/test_*.py`.
- No frontend test runner is configured; add one if you introduce UI logic that needs coverage.
- No coverage gate is enforced; call out coverage expectations in PRs if you add suites.

## Rendering & Gameplay Gotchas
- PixiJS layer order matters in `frontend/src/game/core/GameCanvas.tsx`: backgrounds first, grid above, waves on top.
- Visual effect containers must keep `eventMode = 'none'` so clicks pass through.
- React StrictMode runs effects twice; GameCanvas prevents duplicate canvases — preserve the cleanup/guards.

## Commit & Pull Request Guidelines
- Commit history uses short, sentence-case subjects (example: `Demo 1`); keep messages brief and focused.
- PRs should include a summary, verification steps, and screenshots/clips for UI changes; link issues when applicable.

## Configuration Notes
- Local infra relies on MongoDB/Redis from `docker-compose.yml`; dev defaults like `VITE_API_URL` and JWT settings live there.
- Avoid committing secrets; prefer local `.env` files if you add new configuration.
