from fastapi import APIRouter
from . import auth, cities, players

router = APIRouter(prefix="/v1")
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(cities.router, prefix="/cities", tags=["cities"])
router.include_router(players.router, prefix="/players", tags=["players"])
