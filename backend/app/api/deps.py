from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from functools import lru_cache
import jwt
from jwt import PyJWKClient

from app.database import get_db
from app.models.user import User
from app.config import settings

security = HTTPBearer()


@lru_cache(maxsize=1)
def get_jwks_client() -> PyJWKClient:
    """Get cached JWKS client for Clerk token verification.

    The JWKS client is cached to avoid repeated network calls to fetch the JWKS keys.
    Clerk rotates keys infrequently, so caching is safe and improves performance.
    """
    jwks_url = f"{settings.CLERK_FRONTEND_API}/.well-known/jwks.json"
    return PyJWKClient(jwks_url)


async def verify_clerk_token(token: str) -> dict:
    """Verify Clerk JWT token and extract user claims"""
    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        decoded_token = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True}
        )

        return decoded_token

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        # Don't expose internal error details - security issue
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    except Exception:
        # Don't expose internal error details - security issue
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user from Clerk token"""
    token = credentials.credentials

    try:
        token_data = await verify_clerk_token(token)
        clerk_id = token_data.get("sub")

        if not clerk_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload - missing subject"
            )

        user = db.query(User).filter(User.clerk_id == clerk_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found. Please complete onboarding first."
            )

        if user.is_banned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is banned"
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )

        return user

    except HTTPException:
        raise
    except Exception:
        # Don't expose internal error details
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if token is provided, otherwise return None"""
    if not credentials:
        return None

    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


async def get_clerk_id_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """Verify Clerk token and extract clerk_id without requiring user to exist in database.

    This is used for onboarding flow where user doesn't exist in database yet.
    """
    token = credentials.credentials

    try:
        token_data = await verify_clerk_token(token)
        clerk_id = token_data.get("sub")

        if not clerk_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload - missing subject"
            )

        return clerk_id

    except HTTPException:
        raise
    except Exception:
        # Don't expose internal error details
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
