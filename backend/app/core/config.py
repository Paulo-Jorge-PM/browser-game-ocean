from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Ocean Depths"
    debug: bool = True

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "ocean_depths"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    jwt_secret: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # Game settings
    resource_tick_seconds: int = 60  # How often resources update
    grid_default_width: int = 10
    grid_default_height: int = 15

    # Event-driven sync settings
    resource_sync_interval_seconds: int = 30  # How often frontend syncs with backend
    error_tolerance_seconds: int = 5  # Tolerance for resource drift (in seconds of production)
    action_complete_retry_seconds: int = 3  # Seconds to wait before retrying action completion

    # Dev profile (hardcoded user)
    dev_user_email: str = "dev@ocean.local"
    dev_user_username: str = "dev_player"
    dev_user_password: str = "dev-password"
    dev_user_region: str = "Atlantis"
    dev_user_country: str = "Ocean"
    dev_city_name: str = "Ocean Depths"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
