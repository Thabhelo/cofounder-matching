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
    CLERK_WEBHOOK_SECRET: str = ""  # Optional: Clerk webhook signing secret (from Dashboard → Webhooks → endpoint)
    ADMIN_CLERK_IDS: str = ""  # Comma-separated Clerk user IDs allowed to access admin/moderation endpoints
    RESEND_API_KEY: str = ""  # Optional: Resend API key for transactional emails
    EMAIL_FROM: str = ""  # Optional: From address for notification emails
    FRONTEND_URL: str = "http://localhost:3000"
    SENTRY_DSN: str = ""  # Optional: Sentry DSN for error tracking
    SENTRY_ENVIRONMENT: str = ""  # Optional: Sentry environment (defaults to ENVIRONMENT)
    SENTRY_TRACES_SAMPLE_RATE: float = 1.0  # Performance monitoring sample rate (0.0 to 1.0)
    POSTHOG_API_KEY: str = ""  # Optional: PostHog API key for analytics
    POSTHOG_HOST: str = "https://app.posthog.com"  # PostHog instance host

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

            # Auto-correct development domains to production domains in production environment
            if self.ENVIRONMENT == "production" and "clerk.accounts.dev" in instance_url:
                instance_url = instance_url.replace("clerk.accounts.dev", "clerk.accounts.com")
                print(f"WARNING: Auto-corrected development Clerk domain to production domain: {instance_url}")

            jwks_url = f"{instance_url}/.well-known/jwks.json"
            return jwks_url

        # CLERK_FRONTEND_API is required to construct the JWKS URL
        raise ValueError(
            "CLERK_FRONTEND_API must be set in .env file to derive JWKS URL. "
            f"Example for {self.ENVIRONMENT}: CLERK_FRONTEND_API=https://your-instance.clerk.accounts.{'com' if self.ENVIRONMENT == 'production' else 'dev'}"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
