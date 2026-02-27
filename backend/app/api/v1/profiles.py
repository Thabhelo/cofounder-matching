from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List
import uuid

from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.schemas.user import UserPublicResponse, ProfileDiscoverResponse
from app.api.deps import get_current_user
from app.services.matching import score_match, MIN_MATCH_SCORE
from app.services.email import send_new_match_notification

router = APIRouter()


# Exclude only active matches; dismissed/unmatched can reappear in discover (matched_before).
ACTIVE_MATCH_STATUSES = ("saved", "viewed", "intro_requested", "connected")
PRIOR_MATCH_STATUSES = ("dismissed", "unmatched")


@router.get("/discover", response_model=List[ProfileDiscoverResponse])
async def discover_profiles(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Discover profiles - excludes only active matches (saved/invited/connected). Dismissed/unmatched can reappear with matched_before."""
    interacted_matches = db.query(Match.target_user_id).filter(
        Match.user_id == current_user.id,
        Match.status.in_(ACTIVE_MATCH_STATUSES)
    ).all()
    interacted_ids = [match[0] for match in interacted_matches]

    query = db.query(User).filter(
        User.is_active,
        ~User.is_banned,
        User.id != current_user.id
    )
    if interacted_ids:
        query = query.filter(~User.id.in_(interacted_ids))

    CANDIDATE_POOL_SIZE = 500
    candidates = query.order_by(User.created_at.desc()).limit(CANDIDATE_POOL_SIZE).all()
    scored: List[tuple[User, int]] = []
    for other in candidates:
        result = score_match(current_user, other)
        if result["match_score"] >= MIN_MATCH_SCORE:
            scored.append((other, result["match_score"]))
    scored.sort(key=lambda x: x[1], reverse=True)
    page = [u for u, _ in scored[skip : skip + limit]]
    if not page:
        return []

    prior = db.query(Match.target_user_id).filter(
        Match.user_id == current_user.id,
        Match.target_user_id.in_([u.id for u in page]),
        Match.status.in_(PRIOR_MATCH_STATUSES)
    ).all()
    prior_ids = {m[0] for m in prior}
    rec = db.query(Match.user_id).filter(
        Match.target_user_id == current_user.id,
        Match.user_id.in_([u.id for u in page]),
        Match.status.in_(PRIOR_MATCH_STATUSES)
    ).all()
    prior_ids |= {m[0] for m in rec}

    return [
        ProfileDiscoverResponse(profile=UserPublicResponse.model_validate(u), matched_before=(u.id in prior_ids))
        for u in page
    ]


@router.get("/count", response_model=dict)
async def get_profile_counts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get counts for dashboard summary cards"""
    interacted_matches = db.query(Match.target_user_id).filter(
        Match.user_id == current_user.id,
        Match.status.in_(ACTIVE_MATCH_STATUSES)
    ).all()
    interacted_ids = [match[0] for match in interacted_matches]

    discover_query = db.query(User).filter(
        User.is_active,
        ~User.is_banned,
        User.id != current_user.id
    )
    
    if interacted_ids:
        discover_query = discover_query.filter(~User.id.in_(interacted_ids))

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
        existing_match.status = "saved"  # type: ignore[assignment]
        if existing_match.match_score == 0:
            result = score_match(current_user, target_user)
            existing_match.match_score = result["match_score"]
            existing_match.match_explanation = result["match_explanation"]
            existing_match.complementarity_score = result["complementarity_score"]
            existing_match.commitment_alignment_score = result["commitment_alignment_score"]
            existing_match.location_fit_score = result["location_fit_score"]
            existing_match.intent_score = result["intent_score"]
            existing_match.interest_overlap_score = result["interest_overlap_score"]
            existing_match.preference_alignment_score = result["preference_alignment_score"]
        db.commit()
        if target_user.alert_on_new_matches:
            await send_new_match_notification(target_user, current_user)
        return {"message": "Profile saved", "match_id": str(existing_match.id)}

    result = score_match(current_user, target_user)
    new_match = Match(
        user_id=current_user.id,
        target_user_id=target_user_id,
        match_score=result["match_score"],
        match_explanation=result["match_explanation"],
        complementarity_score=result["complementarity_score"],
        commitment_alignment_score=result["commitment_alignment_score"],
        location_fit_score=result["location_fit_score"],
        intent_score=result["intent_score"],
        interest_overlap_score=result["interest_overlap_score"],
        preference_alignment_score=result["preference_alignment_score"],
        status="saved",
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    if target_user.alert_on_new_matches:
        await send_new_match_notification(target_user, current_user)
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
        existing_match.status = "dismissed"  # type: ignore[assignment]
        if existing_match.match_score == 0:
            result = score_match(current_user, target_user)
            existing_match.match_score = result["match_score"]
            existing_match.match_explanation = result["match_explanation"]
            existing_match.complementarity_score = result["complementarity_score"]
            existing_match.commitment_alignment_score = result["commitment_alignment_score"]
            existing_match.location_fit_score = result["location_fit_score"]
            existing_match.intent_score = result["intent_score"]
            existing_match.interest_overlap_score = result["interest_overlap_score"]
            existing_match.preference_alignment_score = result["preference_alignment_score"]
        db.commit()
        return {"message": "Profile skipped", "match_id": str(existing_match.id)}
    result = score_match(current_user, target_user)
    new_match = Match(
        user_id=current_user.id,
        target_user_id=target_user_id,
        match_score=result["match_score"],
        match_explanation=result["match_explanation"],
        complementarity_score=result["complementarity_score"],
        commitment_alignment_score=result["commitment_alignment_score"],
        location_fit_score=result["location_fit_score"],
        intent_score=result["intent_score"],
        interest_overlap_score=result["interest_overlap_score"],
        preference_alignment_score=result["preference_alignment_score"],
        status="dismissed",
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    return {"message": "Profile skipped", "match_id": str(new_match.id)}


@router.delete("/{profile_id}/save", status_code=status.HTTP_200_OK)
async def unsave_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unsave a profile - removes it from saved list and returns it to discover pool"""
    try:
        target_user_id = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile ID")

    # Find the match
    match = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.target_user_id == target_user_id,
        Match.status == "saved"
    ).first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved profile not found"
        )

    # Delete the match to return profile to discover pool
    db.delete(match)
    db.commit()

    return {"message": "Profile unsaved", "profile_id": profile_id}


@router.delete("/{profile_id}/skip", status_code=status.HTTP_200_OK)
async def unskip_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unskip a profile - removes it from skipped list and returns it to discover pool"""
    try:
        target_user_id = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid profile ID")

    # Find the match
    match = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.target_user_id == target_user_id,
        Match.status == "dismissed"
    ).first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skipped profile not found"
        )

    # Delete the match to return profile to discover pool
    db.delete(match)
    db.commit()

    return {"message": "Profile unskipped", "profile_id": profile_id}


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
