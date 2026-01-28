from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    CLERK_SECRET_KEY: str
    CLERK_PUBLISHABLE_KEY: str
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Co-Founder Matching Platform"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"  # Comma-separated list of allowed origins
    CLERK_FRONTEND_API: str = ""  # Optional: Clerk instance URL (e.g., https://your-instance.clerk.accounts.dev)

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env

    def get_clerk_jwks_url(self) -> str:
        """
        Get the Clerk JWKS URL for token verification.

        Clerk JWKS endpoints are instance-specific. The JWKS URL is:
        https://<your-instance>/.well-known/jwks.json

        We derive the instance URL from CLERK_FRONTEND_API.
        
        Reference: https://clerk.com/docs/guides/sessions/manual-jwt-verification
        """
        # If CLERK_FRONTEND_API is set, use it directly
        if self.CLERK_FRONTEND_API and self.CLERK_FRONTEND_API.strip():
            instance_url = self.CLERK_FRONTEND_API.strip().rstrip('/')
            jwks_url = f"{instance_url}/.well-known/jwks.json"
            return jwks_url
        
        # CLERK_FRONTEND_API is required to construct the JWKS URL
        raise ValueError(
            "CLERK_FRONTEND_API must be set in .env file to derive JWKS URL. "
            "Example: CLERK_FRONTEND_API=https://your-instance.clerk.accounts.dev"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
