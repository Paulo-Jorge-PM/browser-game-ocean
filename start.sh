#!/bin/bash

# Ocean Depths - Development Startup Script
# Supports multiple modes:
#   ./start.sh           - Local dev (Poetry + npm, Docker for databases only)
#   ./start.sh docker    - Full Docker stack
#   ./start.sh infra     - Infrastructure only (databases)

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-local}"

echo "🌊 Starting Ocean Depths Development Environment..."
echo "📁 Project root: $PROJECT_ROOT"
echo "🔧 Mode: $MODE"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# ============================================
# Infrastructure Only Mode
# ============================================
if [[ "$MODE" == "infra" ]]; then
    echo "🐳 Starting infrastructure services only (MongoDB + Redis)..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d mongodb redis
    echo "✅ Infrastructure ready!"
    echo "   MongoDB: localhost:27017"
    echo "   Redis:   localhost:6379"
    exit 0
fi

# ============================================
# Full Docker Mode
# ============================================
if [[ "$MODE" == "docker" ]]; then
    echo "🐳 Starting full Docker stack..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" --profile app up -d --build

    echo ""
    echo "✅ All services starting in Docker!"
    echo ""
    echo "📍 Services:"
    echo "   Frontend:  http://localhost:5173"
    echo "   Backend:   http://localhost:8000"
    echo "   API Docs:  http://localhost:8000/docs"
    echo "   MongoDB:   localhost:27017"
    echo "   Redis:     localhost:6379"
    echo ""
    echo "📋 Logs: docker-compose logs -f"
    echo "🛑 Stop:  docker-compose --profile app down"
    exit 0
fi

# ============================================
# Local Development Mode (default)
# ============================================

# Start Docker services (databases only)
echo "🐳 Starting Docker services (MongoDB + Redis)..."
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d mongodb redis

# Wait for services to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 3

# Check for Poetry
if ! command -v poetry &> /dev/null; then
    echo "📦 Poetry not found. Installing..."
    curl -sSL https://install.python-poetry.org | python3 -
    export PATH="$HOME/.local/bin:$PATH"
fi

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use AppleScript to open new Terminal tabs

    # Backend tab
    osascript <<EOF
    tell application "Terminal"
        activate
        tell application "System Events" to keystroke "t" using {command down}
        delay 0.5
        do script "cd '$PROJECT_ROOT/backend' && echo '🐍 Starting Backend with Poetry...' && poetry install --no-interaction && poetry run uvicorn app.main:socket_app --reload --host 0.0.0.0 --port 8000" in front window
    end tell
EOF

    # Frontend tab
    osascript <<EOF
    tell application "Terminal"
        tell application "System Events" to keystroke "t" using {command down}
        delay 0.5
        do script "cd '$PROJECT_ROOT/frontend' && echo '⚛️ Starting Frontend...' && npm install && npm run dev" in front window
    end tell
EOF

    echo ""
    echo "✅ All services starting in separate Terminal tabs!"
    echo ""
    echo "📍 Services:"
    echo "   Frontend:  http://localhost:5173"
    echo "   Backend:   http://localhost:8000"
    echo "   API Docs:  http://localhost:8000/docs"
    echo "   MongoDB:   localhost:27017"
    echo "   Redis:     localhost:6379"
    echo ""
    echo "🛑 To stop: Run ./stop.sh or close the terminal tabs and run 'docker-compose down'"

else
    # Linux/other - use simple background processes with output
    echo "Starting services in background..."

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Backend
    echo "🐍 Starting Backend with Poetry..."
    cd "$PROJECT_ROOT/backend"
    poetry install --no-interaction
    poetry run uvicorn app.main:socket_app --reload --host 0.0.0.0 --port 8000 > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"

    # Frontend
    echo "⚛️ Starting Frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm install --silent
    npm run dev > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "   Frontend PID: $FRONTEND_PID"

    # Save PIDs for stop script
    echo "$BACKEND_PID" > "$PROJECT_ROOT/.backend.pid"
    echo "$FRONTEND_PID" > "$PROJECT_ROOT/.frontend.pid"

    echo ""
    echo "✅ All services started!"
    echo ""
    echo "📍 Services:"
    echo "   Frontend:  http://localhost:5173"
    echo "   Backend:   http://localhost:8000"
    echo "   API Docs:  http://localhost:8000/docs"
    echo ""
    echo "📋 Logs:"
    echo "   Backend:  tail -f $PROJECT_ROOT/logs/backend.log"
    echo "   Frontend: tail -f $PROJECT_ROOT/logs/frontend.log"
    echo ""
    echo "🛑 To stop: Run ./stop.sh"
fi
