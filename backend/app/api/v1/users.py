from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOnboarding, UserUpdate, UserResponse, UserPublicResponse
from app.api.deps import get_current_user, get_clerk_user_info_from_token
from app.api.deps import verify_clerk_token
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

router = APIRouter()
security = HTTPBearer()


@router.post("/onboarding", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def onboarding_user(
    user_data: UserOnboarding,
    clerk_info: dict = Depends(get_clerk_user_info_from_token),
    db: Session = Depends(get_db)
):
    """Complete user onboarding - create user profile after Clerk signup

    SECURITY: This endpoint requires a valid Clerk JWT token. User information (clerk_id, email, name, avatar)
    is extracted from the validated JWT token (not from request body/query params) to prevent account takeover
    and leverage verified OAuth provider data.

    For OAuth providers (Google/GitHub), name and email are automatically populated from the token,
    eliminating friction from re-asking for verified information.
    """
    clerk_id = clerk_info["clerk_id"]
    
    # Check if user already exists with this clerk_id
    existing_user = db.query(User).filter(User.clerk_id == clerk_id).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists. Use PUT /users/me to update profile."
        )

    # Build user data, prioritizing Clerk token data over form data for verified fields
    user_dict = user_data.model_dump(exclude_unset=True)
    user_dict["clerk_id"] = clerk_id
    
    # Use Clerk token data for name/email/avatar if not provided in form (OAuth flow)
    # This ensures we use verified OAuth provider data instead of user input
    if not user_dict.get("email"):
        if not clerk_info.get("email"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required. Please provide email in request or ensure your OAuth provider includes it."
            )
        user_dict["email"] = clerk_info["email"]
    
    if not user_dict.get("name"):
        if not clerk_info.get("name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name is required. Please provide name in request or ensure your OAuth provider includes it."
            )
        user_dict["name"] = clerk_info["name"]
    
    # Set avatar_url from Clerk if available and not provided
    if not user_dict.get("avatar_url") and clerk_info.get("avatar_url"):
        user_dict["avatar_url"] = clerk_info["avatar_url"]

    # Ensure account status fields are set (required by User model)
    user_dict.setdefault("is_active", True)
    user_dict.setdefault("is_banned", False)
    
    # Ensure previous_startups has a default (required by schema but might be missing)
    if "previous_startups" not in user_dict:
        user_dict["previous_startups"] = 0

    # Check if email is already in use (after we've set it from token)
    existing_email = db.query(User).filter(User.email == user_dict["email"]).first()
    if existing_email and existing_email.clerk_id != clerk_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already in use"
        )

    try:
        user = User(**user_dict)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except Exception as e:
        db.rollback()
        # Log the actual error for debugging (internal logging only)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating user: {str(e)}", exc_info=True)
        # Don't expose internal error details to clients - security best practice
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile. Please try again or contact support."
        )


@router.get("/debug/token")
async def debug_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Debug endpoint to inspect Clerk JWT token claims (development only)
    
    This endpoint helps diagnose OAuth/token issues by showing what claims
    are present in the JWT token. Only available in development mode.
    """
    from app.config import settings
    
    if settings.ENVIRONMENT != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debug endpoint only available in development mode"
        )
    
    token = credentials.credentials
    try:
        token_data = await verify_clerk_token(token)
        
        # Extract user info using the same logic as get_clerk_user_info_from_token
        clerk_info = await get_clerk_user_info_from_token(credentials)
        
        return {
            "token_length": len(token),
            "token_claims": {
                "all_claims": list(token_data.keys()),
                "sub": token_data.get("sub"),
                "email": token_data.get("email"),
                "primary_email": token_data.get("primary_email"),
                "email_addresses": token_data.get("email_addresses"),
                "name": token_data.get("name"),
                "given_name": token_data.get("given_name"),
                "family_name": token_data.get("family_name"),
                "picture": token_data.get("picture"),
                "image_url": token_data.get("image_url"),
                "azp": token_data.get("azp"),
                "exp": token_data.get("exp"),
                "iat": token_data.get("iat"),
            },
            "extracted_info": clerk_info,
            "raw_token_preview": token[:50] + "..." if len(token) > 50 else token
        }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Debug token error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error parsing token: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user's full profile"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    update_data = user_update.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return current_user


@router.get("/{user_id}", response_model=UserPublicResponse)
async def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Get public user profile - limited information for privacy"""
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active,
        not User.is_banned
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.get("", response_model=List[UserPublicResponse])
async def search_users(
    role_intent: str = Query(None, description="Filter by role intent"),
    stage_preference: str = Query(None, description="Filter by stage preference"),
    location: str = Query(None, description="Filter by location"),
    availability_status: str = Query(None, description="Filter by availability status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Search users with filters"""
    query = db.query(User).filter(
        User.is_active,
        not User.is_banned
    )

    if role_intent:
        query = query.filter(User.role_intent == role_intent)
    if stage_preference:
        query = query.filter(User.stage_preference == stage_preference)
    if location:
        query = query.filter(User.location.ilike(f"%{location}%"))
    if availability_status:
        query = query.filter(User.availability_status == availability_status)

    users = query.order_by(User.trust_score.desc()).offset(skip).limit(limit).all()
    return users
