from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://rcm_user:changeme@localhost:5432/road_crack_db"
    redis_url: str = "redis://localhost:6379/0"

    ai_provider: str = "mock"
    ai_confidence_threshold: float = 0.60

    jwt_secret: str = "change_this_secret_key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 10

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
