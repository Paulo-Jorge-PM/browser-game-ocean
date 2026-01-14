from fastapi import APIRouter
from . import auth, cities, players, actions, dev, admin, resources

router = APIRouter(prefix="/v1")
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(cities.router, prefix="/cities", tags=["cities"])
router.include_router(players.router, prefix="/players", tags=["players"])
router.include_router(actions.router, prefix="/actions", tags=["actions"])
router.include_router(resources.router, prefix="/resources", tags=["resources"])
router.include_router(dev.router, prefix="/dev", tags=["dev"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
