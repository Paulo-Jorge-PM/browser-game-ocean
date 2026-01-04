#!/bin/bash

# Ocean Depths - Development Startup Script
# This script starts all services in separate terminal tabs (macOS)

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🌊 Starting Ocean Depths Development Environment..."
echo "📁 Project root: $PROJECT_ROOT"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start Docker services
echo "🐳 Starting Docker services (MongoDB + Redis)..."
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d

# Wait for services to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 3

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use AppleScript to open new Terminal tabs

    # Backend tab
    osascript <<EOF
    tell application "Terminal"
        activate
        tell application "System Events" to keystroke "t" using {command down}
        delay 0.5
        do script "cd '$PROJECT_ROOT/backend' && echo '🐍 Starting Backend...' && if [ ! -d 'venv' ]; then python3 -m venv venv; fi && source venv/bin/activate && pip install -q -r requirements.txt && uvicorn app.main:socket_app --reload --host 0.0.0.0 --port 8000" in front window
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
    echo "🐍 Starting Backend..."
    cd "$PROJECT_ROOT/backend"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -q -r requirements.txt
    uvicorn app.main:socket_app --reload --host 0.0.0.0 --port 8000 > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
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
