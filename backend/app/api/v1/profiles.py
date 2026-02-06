from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List
import uuid

from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.schemas.user import UserPublicResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/discover", response_model=List[UserPublicResponse])
async def discover_profiles(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Discover profiles to browse - excludes already saved/skipped profiles"""
    # Get IDs of profiles user has already interacted with
    interacted_matches = db.query(Match.target_user_id).filter(
        Match.user_id == current_user.id,
        Match.status.in_(["saved", "dismissed", "viewed"])
    ).all()
    interacted_ids = [match[0] for match in interacted_matches]

    # Get profiles excluding current user and already interacted profiles
    query = db.query(User).filter(
        User.is_active,
        ~User.is_banned,
        User.id != current_user.id
    )
    
    if interacted_ids:
        query = query.filter(~User.id.in_(interacted_ids))

    # Filter by complementary role_intent (founder looks for cofounder, etc.)
    if current_user.role_intent == "founder":
        query = query.filter(User.role_intent == "cofounder")
    elif current_user.role_intent == "cofounder":
        query = query.filter(User.role_intent == "founder")

    profiles = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return profiles


@router.get("/count", response_model=dict)
async def get_profile_counts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get counts for dashboard summary cards"""
    # Count profiles available to discover
    interacted_matches = db.query(Match.target_user_id).filter(
        Match.user_id == current_user.id,
        Match.status.in_(["saved", "dismissed", "viewed"])
    ).all()
    interacted_ids = [match[0] for match in interacted_matches]

    discover_query = db.query(User).filter(
        User.is_active,
        ~User.is_banned,
        User.id != current_user.id
    )
    
    if interacted_ids:
        discover_query = discover_query.filter(~User.id.in_(interacted_ids))

    if current_user.role_intent == "founder":
        discover_query = discover_query.filter(User.role_intent == "cofounder")
    elif current_user.role_intent == "cofounder":
        discover_query = discover_query.filter(User.role_intent == "founder")

    discover_count = discover_query.count()

    # Count saved profiles
    saved_count = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.status == "saved"
    ).count()

    # Count matches (where intro was requested/accepted)
    matches_count = db.query(Match).filter(
        or_(
            and_(Match.user_id == current_user.id, Match.intro_requested_at.isnot(None)),
            and_(Match.target_user_id == current_user.id, Match.intro_accepted_at.isnot(None))
        ),
        Match.intro_accepted_at.is_(None)  # Not yet connected
    ).count()

    return {
        "discover_count": discover_count,
        "saved_count": saved_count,
        "matches_count": matches_count
    }


@router.post("/{profile_id}/save", status_code=status.HTTP_201_CREATED)
async def save_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a profile for later"""
    try:
        target_user_id = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile ID")

    if target_user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot save your own profile")

    target_user = db.query(User).filter(User.id == target_user_id, User.is_active).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    # Check if match already exists
    existing_match = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.target_user_id == target_user_id
    ).first()

    if existing_match:
        existing_match.status = "saved"
        db.commit()
        return {"message": "Profile saved", "match_id": str(existing_match.id)}
    else:
        # Create new match with status 'saved' (no score yet since algorithm not implemented)
        new_match = Match(
            user_id=current_user.id,
            target_user_id=target_user_id,
            match_score=0,  # Will be calculated when matching algorithm is implemented
            status="saved"
        )
        db.add(new_match)
        db.commit()
        db.refresh(new_match)
        return {"message": "Profile saved", "match_id": str(new_match.id)}


@router.post("/{profile_id}/skip", status_code=status.HTTP_201_CREATED)
async def skip_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Skip/dismiss a profile"""
    try:
        target_user_id = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile ID")

    if target_user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot skip your own profile")

    target_user = db.query(User).filter(User.id == target_user_id, User.is_active).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    # Check if match already exists
    existing_match = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.target_user_id == target_user_id
    ).first()

    if existing_match:
        existing_match.status = "dismissed"
        db.commit()
        return {"message": "Profile skipped", "match_id": str(existing_match.id)}
    else:
        # Create new match with status 'dismissed'
        new_match = Match(
            user_id=current_user.id,
            target_user_id=target_user_id,
            match_score=0,
            status="dismissed"
        )
        db.add(new_match)
        db.commit()
        db.refresh(new_match)
        return {"message": "Profile skipped", "match_id": str(new_match.id)}


@router.get("/saved", response_model=List[UserPublicResponse])
async def get_saved_profiles(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get saved profiles"""
    matches = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.status == "saved"
    ).order_by(Match.created_at.desc()).offset(skip).limit(limit).all()

    user_ids = [match.target_user_id for match in matches]
    if not user_ids:
        return []

    users = db.query(User).filter(User.id.in_(user_ids)).all()
    # Maintain order from matches
    user_dict = {user.id: user for user in users}
    return [user_dict[user_id] for user_id in user_ids if user_id in user_dict]


@router.get("/skipped", response_model=List[UserPublicResponse])
async def get_skipped_profiles(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get skipped/dismissed profiles"""
    matches = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.status == "dismissed"
    ).order_by(Match.created_at.desc()).offset(skip).limit(limit).all()

    user_ids = [match.target_user_id for match in matches]
    if not user_ids:
        return []

    users = db.query(User).filter(User.id.in_(user_ids)).all()
    # Maintain order from matches
    user_dict = {user.id: user for user in users}
    return [user_dict[user_id] for user_id in user_ids if user_id in user_dict]
