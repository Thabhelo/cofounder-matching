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

    The JWKS URL is automatically derived from the CLERK_PUBLISHABLE_KEY environment variable.
    """
    jwks_url = settings.get_clerk_jwks_url()
    return PyJWKClient(jwks_url)


async def verify_clerk_token(token: str) -> dict:
    """Verify Clerk JWT token and extract user claims
    
    Clerk session tokens are JWTs that must be verified with:
    1. Signature verification using JWKS
    2. Expiration check (exp claim)
    3. Not-before check (nbf claim) 
    4. Authorized party check (azp claim) - must match allowed origins
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and verify token signature
        decoded_token = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True, "verify_nbf": True}
        )

        # Validate authorized party (azp) claim for CSRF protection (if present)
        # The azp claim should match one of the allowed CORS origins
        # Note: azp is optional - only validate if present
        azp = decoded_token.get("azp")
        if azp:
            permitted_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]
            if azp not in permitted_origins:
                if settings.ENVIRONMENT == "development":
                    logger.warning(f"Token azp '{azp}' not in permitted origins: {permitted_origins}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token origin"
                )

        return decoded_token

    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        # Log the specific error in development
        if settings.ENVIRONMENT == "development":
            logger.error(f"Invalid token error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the actual error in development for debugging
        if settings.ENVIRONMENT == "development":
            logger.error(f"Token verification failed: {type(e).__name__}: {str(e)}", exc_info=True)
        # Don't expose internal error details in production - security issue
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


async def get_clerk_user_info_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """Extract user information from Clerk JWT token.
    
    Returns a dict with:
    - clerk_id: User's Clerk ID (sub claim)
    - email: User's email address (from token or fetched from Clerk API)
    - name: User's full name (from token or fetched from Clerk API)
    - avatar_url: User's profile picture URL (if available)
    
    This is used during onboarding to populate user data from OAuth providers.
    If email/name are not in the token, we fetch them from Clerk's Backend API.
    """
    import logging
    import httpx
    logger = logging.getLogger(__name__)
    
    token = credentials.credentials
    
    # Debug logging in development
    if settings.ENVIRONMENT == "development":
        if not token:
            logger.error("No token provided in Authorization header")
        else:
            logger.debug(f"Token received (length: {len(token) if token else 0})")

    try:
        token_data = await verify_clerk_token(token)
        clerk_id = token_data.get("sub")

        if not clerk_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload - missing subject"
            )

        # Log all token claims in development for debugging
        if settings.ENVIRONMENT == "development":
            logger.debug(f"Token claims: {list(token_data.keys())}")
            logger.debug(f"Token email fields: email={token_data.get('email')}, primary_email={token_data.get('primary_email')}")
            logger.debug(f"Token name fields: name={token_data.get('name')}, given_name={token_data.get('given_name')}, family_name={token_data.get('family_name')}")

        # Extract email (Clerk provides this in the token)
        # Use explicit parentheses to ensure proper operator precedence
        email = (
            token_data.get("email") 
            or token_data.get("primary_email") 
            or (token_data.get("email_addresses", [{}])[0].get("email_address") if token_data.get("email_addresses") else None)
        )
        
        # Extract name - Clerk may provide it as "name" or as "given_name" + "family_name"
        name = token_data.get("name")
        if not name:
            given_name = token_data.get("given_name", "")
            family_name = token_data.get("family_name", "")
            name = f"{given_name} {family_name}".strip() or None
        
        # Extract avatar URL (Clerk provides this as "picture" or "image_url")
        avatar_url = token_data.get("picture") or token_data.get("image_url")

        # If email or name is missing, fetch from Clerk Backend API
        if not email or not name:
            try:
                # Use Clerk Backend API to fetch user info
                clerk_api_url = f"https://api.clerk.com/v1/users/{clerk_id}"
                headers = {
                    "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
                    "Content-Type": "application/json"
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.get(clerk_api_url, headers=headers, timeout=10.0)
                    if response.status_code == 200:
                        user_data = response.json()
                        if not email:
                            # Try multiple email fields from Clerk API response
                            email_addresses = user_data.get("email_addresses", [])
                            if email_addresses:
                                email = email_addresses[0].get("email_address")
                            if not email:
                                primary_email_id = user_data.get("primary_email_address_id")
                                if primary_email_id:
                                    for addr in email_addresses:
                                        if addr.get("id") == primary_email_id:
                                            email = addr.get("email_address")
                                            break
                        
                        if not name:
                            name = user_data.get("first_name", "") + " " + user_data.get("last_name", "")
                            name = name.strip() or user_data.get("username") or email or "User"
                        
                        if not avatar_url:
                            avatar_url = user_data.get("image_url") or user_data.get("profile_image_url")
                        
                        if settings.ENVIRONMENT == "development":
                            logger.info(f"Fetched user info from Clerk API: email={email}, name={name}")
                    else:
                        if settings.ENVIRONMENT == "development":
                            logger.warning(f"Failed to fetch user from Clerk API: {response.status_code} - {response.text}")
            except Exception as e:
                if settings.ENVIRONMENT == "development":
                    logger.error(f"Error fetching user from Clerk API: {str(e)}", exc_info=True)
                # Continue with whatever we have from token

        # Final fallback for name
        if not name:
            name = email or "User"

        return {
            "clerk_id": clerk_id,
            "email": email,
            "name": name,
            "avatar_url": avatar_url,
        }

    except HTTPException:
        raise
    except Exception as e:
        # Log the actual error in development
        if settings.ENVIRONMENT == "development":
            logger.error(f"Error extracting user info from token: {type(e).__name__}: {str(e)}", exc_info=True)
        # Don't expose internal error details
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
