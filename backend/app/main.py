from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from .core.config import settings
from .core.database import connect_to_mongo, close_mongo_connection
from .api.v1 import router as api_router
from .sockets.manager import sio


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Startup
    await connect_to_mongo()
    print(f"Starting {settings.app_name}...")
    yield
    # Shutdown
    await close_mongo_connection()
    print("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="Underwater city builder MMO game API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": settings.app_name}


# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)


# For running with uvicorn
def create_app():
    return socket_app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
