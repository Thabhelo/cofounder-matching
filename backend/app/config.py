from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    CLERK_SECRET_KEY: str
    CLERK_PUBLISHABLE_KEY: str
    CLERK_FRONTEND_API: str  # e.g., "https://clerk.your-app.lcl.dev" or your Clerk instance URL
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Co-Founder Matching Platform"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"  # Comma-separated list of allowed origins

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
