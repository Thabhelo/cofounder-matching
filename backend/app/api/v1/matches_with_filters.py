"""
Enhanced Matches API with Quality Filters

This file demonstrates how to integrate the quality filters with the existing
matching system. This would replace or extend the existing matches.py file.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.models.message import Message
from app.schemas.match import (
    IntroRequest,
)
from app.schemas.user import UserPublicResponse, ProfileDiscoverResponse
from app.api.deps import get_current_user
from app.services.matching import score_match, MIN_MATCH_SCORE
from app.services.matching_filters import (
    matching_quality_filter,
    filter_candidates_for_matching,
    validate_intro_request_eligibility,
    FilterReason
)
from app.services.email import send_intro_request_notification, send_new_match_notification

# Active statuses: exclude from discover/recommendations
ACTIVE_MATCH_STATUSES = ("saved", "viewed", "intro_requested", "connected")
PRIOR_MATCH_STATUSES = ("dismissed", "unmatched")

router = APIRouter()


@router.post("/invite/{profile_id}", status_code=status.HTTP_201_CREATED)
async def send_invite_to_profile(
    profile_id: str,
    intro_request: IntroRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send invitation directly to a profile - creates match and sends intro in one step.
    Now includes comprehensive quality filtering.
    """
    try:
        target_user_id = uuid.UUID(profile_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid profile ID"
        )

    if target_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot invite yourself"
        )

    # Quality filter: Check if current user can send intro requests
    intro_eligibility = await validate_intro_request_eligibility(current_user, db)
    if not intro_eligibility.allowed:
        status_code = status.HTTP_403_FORBIDDEN
        if intro_eligibility.reason == FilterReason.RATE_LIMIT:
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
        elif intro_eligibility.reason == FilterReason.INSUFFICIENT_PROFILE:
            status_code = status.HTTP_400_BAD_REQUEST

        raise HTTPException(
            status_code=status_code,
            detail=intro_eligibility.message or "Not eligible to send introduction requests"
        )

    target_user = db.query(User).filter(
        User.id == target_user_id,
        User.is_active
    ).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )

    # Quality filter: Check if target user can appear in matches
    target_eligibility = await matching_quality_filter.can_appear_in_matches(target_user, db)
    if not target_eligibility.allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This profile is not available for matching"
        )

    # Apply auto-moderation check for current user
    moderation_applied, moderation_message = await matching_quality_filter.apply_auto_moderation(
        current_user, db
    )
    if moderation_applied and current_user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended due to policy violations"
        )

    # Check if match already exists (current user → target user)
    existing_match = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.target_user_id == target_user_id
    ).first()

    if existing_match:
        if existing_match.intro_requested_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already sent an invitation to this person"
            )
        if existing_match.intro_accepted_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already connected with this person"
            )

    # Check for reciprocal match (target user → current user)
    reciprocal_match = db.query(Match).filter(
        Match.user_id == target_user_id,
        Match.target_user_id == current_user.id,
        Match.intro_requested_at.isnot(None)
    ).first()

    # Enhanced rate limit check using quality filter
    one_week_ago = datetime.utcnow() - timedelta(weeks=1)
    recent_intros = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.intro_requested_at.isnot(None),
        Match.intro_requested_at >= one_week_ago
    ).count()

    if recent_intros >= 20:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Maximum of 20 invitations per week. You have {20 - recent_intros} invites left."
        )

    # Calculate match score (only if passes quality filters)
    match_result = score_match(current_user, target_user)

    # If reciprocal match exists, auto-connect both matches
    if reciprocal_match:
        if existing_match:
            match = existing_match
            match.status = "connected"
            match.intro_requested_at = datetime.utcnow()
            match.intro_accepted_at = datetime.utcnow()
            match.updated_at = datetime.utcnow()
            if match.match_score == 0:
                match.match_score = match_result["match_score"]
                match.match_explanation = match_result["match_explanation"]
                match.complementarity_score = match_result["complementarity_score"]
                match.commitment_alignment_score = match_result["commitment_alignment_score"]
                match.location_fit_score = match_result["location_fit_score"]
                match.intent_score = match_result["intent_score"]
                match.interest_overlap_score = match_result["interest_overlap_score"]
                match.preference_alignment_score = match_result["preference_alignment_score"]
        else:
            match = Match(
                user_id=current_user.id,
                target_user_id=target_user_id,
                match_score=match_result["match_score"],
                match_explanation=match_result["match_explanation"],
                complementarity_score=match_result["complementarity_score"],
                commitment_alignment_score=match_result["commitment_alignment_score"],
                location_fit_score=match_result["location_fit_score"],
                intent_score=match_result["intent_score"],
                interest_overlap_score=match_result["interest_overlap_score"],
                preference_alignment_score=match_result["preference_alignment_score"],
                status="connected",
                intro_requested_at=datetime.utcnow(),
                intro_accepted_at=datetime.utcnow()
            )
            db.add(match)
            db.flush()

        if reciprocal_match.match_score == 0:
            rec_result = score_match(target_user, current_user)
            reciprocal_match.match_score = rec_result["match_score"]
            reciprocal_match.match_explanation = rec_result["match_explanation"]
            reciprocal_match.complementarity_score = rec_result["complementarity_score"]
            reciprocal_match.commitment_alignment_score = rec_result["commitment_alignment_score"]
            reciprocal_match.location_fit_score = rec_result["location_fit_score"]
            reciprocal_match.intent_score = rec_result["intent_score"]
            reciprocal_match.interest_overlap_score = rec_result["interest_overlap_score"]
            reciprocal_match.preference_alignment_score = rec_result["preference_alignment_score"]

        reciprocal_match.status = "connected"
        reciprocal_match.intro_accepted_at = datetime.utcnow()
        reciprocal_match.updated_at = datetime.utcnow()

        intro_message = Message(
            match_id=match.id,
            sender_id=current_user.id,
            recipient_id=target_user_id,
            content=intro_request.message,
            message_type="intro_request"
        )
        db.add(intro_message)
        db.commit()
        db.refresh(match)

        if target_user.alert_on_new_matches:
            await send_new_match_notification(target_user, current_user)

        return {
            "message": "You're now connected! Check your inbox to start chatting.",
            "match_id": str(match.id),
            "invites_remaining": max(0, 20 - recent_intros - 1),
            "auto_connected": True
        }

    # No reciprocal match - create normal intro request
    if existing_match:
        match = existing_match
        match.status = "intro_requested"
        match.intro_requested_at = datetime.utcnow()
        match.updated_at = datetime.utcnow()
        if match.match_score == 0:
            match.match_score = match_result["match_score"]
            match.match_explanation = match_result["match_explanation"]
            match.complementarity_score = match_result["complementarity_score"]
            match.commitment_alignment_score = match_result["commitment_alignment_score"]
            match.location_fit_score = match_result["location_fit_score"]
            match.intent_score = match_result["intent_score"]
            match.interest_overlap_score = match_result["interest_overlap_score"]
            match.preference_alignment_score = match_result["preference_alignment_score"]
    else:
        match = Match(
            user_id=current_user.id,
            target_user_id=target_user_id,
            match_score=match_result["match_score"],
            match_explanation=match_result["match_explanation"],
            complementarity_score=match_result["complementarity_score"],
            commitment_alignment_score=match_result["commitment_alignment_score"],
            location_fit_score=match_result["location_fit_score"],
            intent_score=match_result["intent_score"],
            interest_overlap_score=match_result["interest_overlap_score"],
            preference_alignment_score=match_result["preference_alignment_score"],
            status="intro_requested",
            intro_requested_at=datetime.utcnow()
        )
        db.add(match)
        db.flush()

    intro_message = Message(
        match_id=match.id,
        sender_id=current_user.id,
        recipient_id=target_user_id,
        content=intro_request.message,
        message_type="intro_request"
    )
    db.add(intro_message)
    db.commit()
    db.refresh(match)

    if target_user.alert_on_new_matches:
        await send_intro_request_notification(target_user, current_user)

    # Track quality filter flags for analytics
    if intro_eligibility.flags:
        # Could add analytics tracking here
        pass

    return {
        "message": "Invitation sent successfully",
        "match_id": str(match.id),
        "invites_remaining": max(0, 20 - recent_intros - 1),
        "auto_connected": False
    }


@router.get("/recommendations", response_model=List[ProfileDiscoverResponse])
async def get_match_recommendations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get match recommendations with quality filtering.
    Only shows users who meet quality requirements.
    """
    # Check if current user can use the matching system
    user_eligibility = await matching_quality_filter.can_appear_in_matches(current_user, db, True)
    if not user_eligibility.allowed:
        # Return empty list with helpful message
        return []

    interacted_matches = db.query(Match.target_user_id).filter(
        Match.user_id == current_user.id,
        Match.status.in_(ACTIVE_MATCH_STATUSES)
    ).all()
    interacted_ids = [match[0] for match in interacted_matches]

    # Base query for candidates
    query = db.query(User).filter(
        User.is_active,
        ~User.is_banned,
        User.id != current_user.id
    )
    if interacted_ids:
        query = query.filter(~User.id.in_(interacted_ids))

    CANDIDATE_POOL_SIZE = 1000  # Increased to account for quality filtering
    candidates = query.order_by(User.created_at.desc()).limit(CANDIDATE_POOL_SIZE).all()

    # Apply quality filters to candidates
    qualified_candidates = await filter_candidates_for_matching(candidates, db, update_metrics=False)

    # Score qualified candidates
    scored: List[tuple[User, int]] = []
    for other in qualified_candidates:
        try:
            result = score_match(current_user, other)
            if result["match_score"] >= MIN_MATCH_SCORE:
                scored.append((other, result["match_score"]))
        except Exception:
            # Log error but continue
            continue

    scored.sort(key=lambda x: x[1], reverse=True)
    page = [u for u, _ in scored[skip : skip + limit]]

    if not page:
        return []

    # Check for prior matches
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
        ProfileDiscoverResponse(
            profile=UserPublicResponse.model_validate(u),
            matched_before=(u.id in prior_ids)
        )
        for u in page
    ]


@router.get("/quality-summary", response_model=dict)
async def get_user_quality_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive quality summary for the current user.
    Helps users understand their matching eligibility and areas for improvement.
    """
    summary = await matching_quality_filter.get_user_quality_summary(
        current_user, db, update_metrics=True
    )

    return summary


# Keep all the other existing endpoints unchanged, just add quality filtering where appropriate...
# [The rest of the endpoints would follow similar patterns]


@router.post("/{match_id}/intro", status_code=status.HTTP_201_CREATED)
async def request_introduction(
    match_id: str,
    intro_request: IntroRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request introduction with quality filtering."""
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid match ID"
        )

    # Quality filter: Check if user can send intro requests
    intro_eligibility = await validate_intro_request_eligibility(current_user, db)
    if not intro_eligibility.allowed:
        status_code = status.HTTP_403_FORBIDDEN
        if intro_eligibility.reason == FilterReason.RATE_LIMIT:
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
        elif intro_eligibility.reason == FilterReason.INSUFFICIENT_PROFILE:
            status_code = status.HTTP_400_BAD_REQUEST

        raise HTTPException(
            status_code=status_code,
            detail=intro_eligibility.message or "Not eligible to send introduction requests"
        )

    match = db.query(Match).filter(Match.id == match_uuid).first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Verify user is the requester (not the target)
    if match.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only request introductions for your own matches"
        )

    # Check if already connected or requested
    if match.intro_requested_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Introduction already requested for this match"
        )

    if match.intro_accepted_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already connected with this user"
        )

    # The quality filter already handles rate limiting, but keep original check for consistency
    one_week_ago = datetime.utcnow() - timedelta(weeks=1)
    recent_intros = db.query(Match).filter(
        Match.user_id == current_user.id,
        Match.intro_requested_at.isnot(None),
        Match.intro_requested_at >= one_week_ago
    ).count()

    if recent_intros >= 20:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum of 20 introduction requests per week. Please try again next week."
        )

    # Update match status and timestamp
    match.status = "intro_requested"
    match.intro_requested_at = datetime.utcnow()
    match.updated_at = datetime.utcnow()

    # Create intro request message
    intro_message = Message(
        match_id=match.id,
        sender_id=current_user.id,
        recipient_id=match.target_user_id,
        content=intro_request.message,
        message_type="intro_request"
    )
    db.add(intro_message)
    db.commit()
    db.refresh(match)

    return {
        "message": "Introduction request sent successfully",
        "match_id": str(match.id),
        "intro_requested_at": match.intro_requested_at
    }