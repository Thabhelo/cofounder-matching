from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOnboarding, UserUpdate, UserResponse, UserPublicResponse
from app.api.deps import get_current_user, get_clerk_user_info_from_token
from app.api.deps import verify_clerk_token
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

router = APIRouter()
security = HTTPBearer()


@router.post("/accept-behavior-agreement", response_model=UserResponse)
async def accept_behavior_agreement(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record that the user accepted the behavior agreement (required before onboarding steps)."""
    if current_user.behavior_agreement_accepted_at:
        return current_user
    current_user.behavior_agreement_accepted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/onboarding", response_model=UserResponse)
async def onboarding_user(
    user_data: UserOnboarding,
    response: Response,
    current_user: User = Depends(get_current_user),
    clerk_info: dict = Depends(get_clerk_user_info_from_token),
    db: Session = Depends(get_db),
):
    """Complete user onboarding. Creates user if new, or updates existing (e.g. after agreement).

    SECURITY: User info (clerk_id, email, name, avatar) from JWT, not request body.
    Requires behavior agreement to be accepted before profile completion.
    """
    if not current_user.behavior_agreement_accepted_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accept the behavior agreement before completing onboarding.",
        )
    clerk_id = clerk_info["clerk_id"]
    existing_user = db.query(User).filter(User.clerk_id == clerk_id).first()

    user_dict = user_data.model_dump(exclude_unset=True)
    user_dict["clerk_id"] = clerk_id

    if not user_dict.get("email"):
        if not clerk_info.get("email"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required. Please provide email in request or ensure your OAuth provider includes it.",
            )
        user_dict["email"] = clerk_info["email"]
    if not user_dict.get("name"):
        if not clerk_info.get("name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name is required. Please provide name in request or ensure your OAuth provider includes it.",
            )
        user_dict["name"] = clerk_info["name"]
    if not user_dict.get("avatar_url") and clerk_info.get("avatar_url"):
        user_dict["avatar_url"] = clerk_info["avatar_url"]

    user_dict.setdefault("is_active", True)
    user_dict.setdefault("is_banned", False)
    if "previous_startups" not in user_dict:
        user_dict["previous_startups"] = 0

    existing_email = db.query(User).filter(User.email == user_dict["email"]).first()
    if existing_email and existing_email.clerk_id != clerk_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")

    try:
        if existing_user:
            for key, value in user_dict.items():
                if hasattr(existing_user, key):
                    setattr(existing_user, key, value)
            existing_user.profile_status = "approved"
            db.commit()
            db.refresh(existing_user)
            response.status_code = status.HTTP_200_OK
            return existing_user
        user = User(**user_dict)
        user.profile_status = "approved"
        db.add(user)
        db.commit()
        db.refresh(user)
        response.status_code = status.HTTP_201_CREATED
        return user
    except IntegrityError as e:
        db.rollback()
        err_msg = str(e.orig) if e.orig else str(e)
        err_lower = err_msg.lower()
        is_email_duplicate = (
            "users_email_key" in err_msg
            or ("unique" in err_lower and "email" in err_lower)
            or ("duplicate key" in err_lower and "email" in err_lower)
        )
        if is_email_duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile. Please try again or contact support.",
        )
    except Exception as e:
        db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error saving user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile. Please try again or contact support.",
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
    import uuid
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user = db.query(User).filter(
        User.id == user_uuid,
        User.is_active,
        ~User.is_banned
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.get("", response_model=List[UserPublicResponse])
async def search_users(
    q: str = Query(None, description="Search query for name or introduction"),
    idea_status: str = Query(None, description="Filter by idea status"),
    commitment: str = Query(None, description="Filter by commitment level"),
    location: str = Query(None, description="Filter by location"),
    sort_by: str = Query("recent", description="Sort by: recent, experience"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Search users with filters and full-text search."""
    from sqlalchemy import or_

    query = db.query(User).filter(User.is_active, ~User.is_banned)

    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                User.name.ilike(search_term),
                User.introduction.ilike(search_term),
            )
        )
    if idea_status:
        query = query.filter(User.idea_status == idea_status)
    if commitment:
        query = query.filter(User.commitment == commitment)
    if location:
        query = query.filter(User.location.ilike(f"%{location}%"))

    if sort_by == "experience":
        query = query.order_by(
            User.experience_years.desc().nulls_last(),
            User.previous_startups.desc().nulls_last(),
            User.created_at.desc()
        )
    else:  # recent (default)
        query = query.order_by(User.created_at.desc())

    users = query.offset(skip).limit(limit).all()
    return users
