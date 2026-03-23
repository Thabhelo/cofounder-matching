from datetime import datetime, timezone
import logging
from fastapi import APIRouter, Depends, HTTPException, Response, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from app.database import get_db
from app.models.user import User
from app.analytics import track_user_signup, track_profile_completion
from app.schemas.user import (
    UserOnboarding,
    UserUpdate,
    UserResponse,
    UserPublicResponse,
    UserSettings,
    UserSettingsUpdate,
    UserSettingsResponse,
)
from app.api.deps import get_current_user, get_clerk_user_info_from_token
from app.api.deps import verify_clerk_token
from app.services.email import send_welcome_email
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

            # Track profile completion
            try:
                track_profile_completion(
                    user_id=str(existing_user.id),
                    completion_percentage=100,
                    signup_source="onboarding_update"
                )
            except Exception as e:
                # Don't fail the request if analytics fails
                logger = logging.getLogger(__name__)
                logger.error(f"Analytics tracking failed for profile completion: {e}")

            await send_welcome_email(existing_user)
            return existing_user
        user = User(**user_dict)
        user.profile_status = "approved"
        db.add(user)
        db.commit()
        db.refresh(user)
        response.status_code = status.HTTP_201_CREATED

        # Track new user signup and profile completion
        try:
            track_user_signup(
                user_id=str(user.id),
                signup_source="onboarding",
                email_domain=user.email.split('@')[1] if user.email else None
            )
            track_profile_completion(
                user_id=str(user.id),
                completion_percentage=100,
                signup_source="onboarding"
            )
        except Exception as e:
            # Don't fail the request if analytics fails
            logger = logging.getLogger(__name__)
            logger.error(f"Analytics tracking failed for new user signup: {e}")

        await send_welcome_email(user)
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


def _get_settings(user: User) -> UserSettings:
    """Return the user's settings, merging stored values over defaults."""
    defaults = UserSettings()
    raw = user.settings or {}
    notif_data = {**defaults.notifications.model_dump(), **raw.get("notifications", {})}
    priv_data = {**defaults.privacy.model_dump(), **raw.get("privacy", {})}
    comm_data = {**defaults.communication.model_dump(), **raw.get("communication", {})}
    return UserSettings(
        notifications=notif_data,
        privacy=priv_data,
        communication=comm_data,
    )


@router.get("/me/settings", response_model=UserSettingsResponse)
async def get_user_settings(
    current_user: User = Depends(get_current_user),
):
    """Get current user's notification, privacy, and communication settings."""
    return {"settings": _get_settings(current_user)}


@router.put("/me/settings", response_model=UserSettingsResponse)
async def update_user_settings(
    settings_update: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's settings (partial update per section)."""
    merged = _get_settings(current_user).model_dump()

    if settings_update.notifications is not None:
        merged["notifications"].update(settings_update.notifications.model_dump())
    if settings_update.privacy is not None:
        merged["privacy"].update(settings_update.privacy.model_dump())
    if settings_update.communication is not None:
        merged["communication"].update(settings_update.communication.model_dump())

    from sqlalchemy.orm.attributes import flag_modified
    current_user.settings = merged
    flag_modified(current_user, "settings")
    db.commit()
    db.refresh(current_user)
    return {"settings": UserSettings(**current_user.settings)}


@router.post("/me/export", status_code=status.HTTP_200_OK)
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export all personal data for the current user (GDPR Article 20)."""
    from app.models.match import Match
    from app.models.message import Message

    matches = db.query(Match).filter(
        (Match.user_id == current_user.id) | (Match.target_user_id == current_user.id)
    ).all()

    messages = db.query(Message).filter(
        Message.sender_id == current_user.id
    ).all()

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "avatar_url": current_user.avatar_url,
            "introduction": current_user.introduction,
            "location": current_user.location,
            "location_city": current_user.location_city,
            "location_country": current_user.location_country,
            "linkedin_url": current_user.linkedin_url,
            "github_url": current_user.github_url,
            "portfolio_url": current_user.portfolio_url,
            "idea_status": current_user.idea_status,
            "commitment": current_user.commitment,
            "experience_years": current_user.experience_years,
            "areas_of_ownership": current_user.areas_of_ownership,
            "topics_of_interest": current_user.topics_of_interest,
            "profile_status": current_user.profile_status,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "settings": current_user.settings,
        "matches": [
            {
                "id": str(m.id),
                "other_user_id": str(m.target_user_id if m.user_id == current_user.id else m.user_id),
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in matches
        ],
        "messages_sent": [
            {
                "id": str(msg.id),
                "match_id": str(msg.match_id),
                "content": msg.content,
                "sent_at": msg.created_at.isoformat() if msg.created_at else None,
            }
            for msg in messages
        ],
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete (anonymize) the current user's account (GDPR Article 17).

    Anonymizes PII fields rather than hard-deleting rows so that foreign key
    references in matches and messages remain intact.
    """
    import uuid as _uuid
    anon_id = str(_uuid.uuid4())[:8]

    current_user.email = f"deleted_{anon_id}@deleted.invalid"
    current_user.name = "Deleted User"
    current_user.avatar_url = None
    current_user.introduction = None
    current_user.location = None
    current_user.location_city = None
    current_user.location_state = None
    current_user.location_country = None
    current_user.location_latitude = None
    current_user.location_longitude = None
    current_user.gender = None
    current_user.birthdate = None
    current_user.linkedin_url = None
    current_user.twitter_url = None
    current_user.instagram_url = None
    current_user.calendly_url = None
    current_user.video_intro_url = None
    current_user.github_url = None
    current_user.portfolio_url = None
    current_user.life_story = None
    current_user.hobbies = None
    current_user.impressive_accomplishment = None
    current_user.education_history = None
    current_user.employment_history = None
    current_user.settings = None
    current_user.is_active = False

    db.commit()


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

    return _apply_privacy(user)


def _apply_privacy(user: User) -> User:
    """Null-out fields that the user has hidden via privacy settings."""
    privacy = (user.settings or {}).get("privacy", {})
    if not privacy.get("show_location", True):
        user.location = None
        user.location_city = None
        user.location_country = None
    if not privacy.get("show_proof_of_work", True):
        user.github_url = None
        user.linkedin_url = None
        user.portfolio_url = None
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
    # Exclude users who have opted out of search visibility
    users = [u for u in users if (u.settings or {}).get("privacy", {}).get("search_visible", True)]
    return [_apply_privacy(u) for u in users]
