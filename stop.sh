#!/bin/bash

# Ocean Depths - Development Stop Script

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping Ocean Depths Development Environment..."

# Stop Docker services
echo "🐳 Stopping Docker services..."
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down

# Kill background processes if PIDs exist (Linux mode)
if [ -f "$PROJECT_ROOT/.backend.pid" ]; then
    BACKEND_PID=$(cat "$PROJECT_ROOT/.backend.pid")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "🐍 Stopping Backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    rm "$PROJECT_ROOT/.backend.pid"
fi

if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PROJECT_ROOT/.frontend.pid")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "⚛️ Stopping Frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    rm "$PROJECT_ROOT/.frontend.pid"
fi

# Also try to kill any running vite or uvicorn processes for this project
pkill -f "uvicorn app.main:socket_app" 2>/dev/null || true
pkill -f "vite.*frontend" 2>/dev/null || true

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 Note: If you started with Terminal tabs on macOS, you may need to close those tabs manually."
