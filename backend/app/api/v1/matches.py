from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.models.message import Message
from app.schemas.match import (
    IntroRequest,
    IntroResponse,
    MatchStatusUpdate,
    MatchResponse,
    MatchWithUserResponse
)
from app.schemas.user import UserPublicResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/invite/{profile_id}", status_code=status.HTTP_201_CREATED)
async def send_invite_to_profile(
    profile_id: str,
    intro_request: IntroRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send invitation directly to a profile - creates match and sends intro in one step

    This is used from the discover page to invite someone to connect.
    Rate limited to 20 invites per week (like YC).
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

    target_user = db.query(User).filter(
        User.id == target_user_id,
        User.is_active
    ).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
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

    # Rate limit check - max 20 intro requests per week
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

    # If reciprocal match exists, auto-connect both matches
    if reciprocal_match:
        # Create or update current user's match as connected
        if existing_match:
            match = existing_match
            match.status = "connected"
            match.intro_requested_at = datetime.utcnow()
            match.intro_accepted_at = datetime.utcnow()
            match.updated_at = datetime.utcnow()
        else:
            match = Match(
                user_id=current_user.id,
                target_user_id=target_user_id,
                match_score=0,
                status="connected",
                intro_requested_at=datetime.utcnow(),
                intro_accepted_at=datetime.utcnow()
            )
            db.add(match)

        # Update reciprocal match to connected
        reciprocal_match.status = "connected"
        reciprocal_match.intro_accepted_at = datetime.utcnow()
        reciprocal_match.updated_at = datetime.utcnow()

        # Create intro message
        intro_message = Message(
            match_id=match.id if existing_match else None,
            sender_id=current_user.id,
            recipient_id=target_user_id,
            content=intro_request.message,
            message_type="intro_request"
        )

        db.commit()
        db.refresh(match)

        # Set match_id for message if it was a new match
        if not existing_match:
            intro_message.match_id = match.id
            db.add(intro_message)
            db.commit()

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
    else:
        match = Match(
            user_id=current_user.id,
            target_user_id=target_user_id,
            match_score=0,
            status="intro_requested",
            intro_requested_at=datetime.utcnow()
        )
        db.add(match)

    # Create intro request message
    intro_message = Message(
        match_id=match.id if existing_match else None,
        sender_id=current_user.id,
        recipient_id=target_user_id,
        content=intro_request.message,
        message_type="intro_request"
    )

    db.commit()
    db.refresh(match)

    # Set match_id for message if it was a new match
    if not existing_match:
        intro_message.match_id = match.id
        db.add(intro_message)
        db.commit()

    return {
        "message": "Invitation sent successfully",
        "match_id": str(match.id),
        "invites_remaining": max(0, 20 - recent_intros - 1),
        "auto_connected": False
    }


@router.get("", response_model=List[MatchWithUserResponse])
async def get_matches(
    status_filter: Optional[str] = Query(None, description="Filter by match status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's matches - both sent and received intro requests"""
    query = db.query(Match).filter(
        or_(
            Match.user_id == current_user.id,
            Match.target_user_id == current_user.id
        )
    )

    if status_filter:
        query = query.filter(Match.status == status_filter)

    matches = query.order_by(Match.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for match in matches:
        # Determine which user is the target (the other user in the match)
        if match.user_id == current_user.id:
            target_user_id = match.target_user_id
        else:
            target_user_id = match.user_id

        target_user = db.query(User).filter(
            User.id == target_user_id,
            User.is_active,
            ~User.is_banned
        ).first()

        if target_user:
            match_dict = {
                "id": match.id,
                "user_id": match.user_id,
                "target_user_id": match.target_user_id,
                "match_score": match.match_score,
                "match_explanation": match.match_explanation,
                "complementarity_score": match.complementarity_score,
                "commitment_alignment_score": match.commitment_alignment_score,
                "location_fit_score": match.location_fit_score,
                "intent_score": match.intent_score,
                "interest_overlap_score": match.interest_overlap_score,
                "preference_alignment_score": match.preference_alignment_score,
                "status": match.status,
                "intro_requested_at": match.intro_requested_at,
                "intro_accepted_at": match.intro_accepted_at,
                "created_at": match.created_at,
                "updated_at": match.updated_at,
                "target_user": target_user
            }
            result.append(MatchWithUserResponse(**match_dict))

    return result


@router.get("/recommendations", response_model=List[UserPublicResponse])
async def get_match_recommendations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get match recommendations - users you haven't interacted with yet"""
    # Get IDs of profiles user has already interacted with
    interacted_matches = db.query(Match.target_user_id).filter(
        Match.user_id == current_user.id
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

    # Filter by complementary role_intent
    if current_user.role_intent == "founder":
        query = query.filter(User.role_intent == "cofounder")
    elif current_user.role_intent == "cofounder":
        query = query.filter(User.role_intent == "founder")

    profiles = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return profiles


@router.get("/{match_id}", response_model=MatchWithUserResponse)
async def get_match(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific match details"""
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid match ID"
        )

    match = db.query(Match).filter(Match.id == match_uuid).first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Verify user is part of this match
    if match.user_id != current_user.id and match.target_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this match"
        )

    # Determine target user
    if match.user_id == current_user.id:
        target_user_id = match.target_user_id
    else:
        target_user_id = match.user_id

    target_user = db.query(User).filter(
        User.id == target_user_id,
        User.is_active,
        ~User.is_banned
    ).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )

    match_dict = {
        "id": match.id,
        "user_id": match.user_id,
        "target_user_id": match.target_user_id,
        "match_score": match.match_score,
        "match_explanation": match.match_explanation,
        "complementarity_score": match.complementarity_score,
        "commitment_alignment_score": match.commitment_alignment_score,
        "location_fit_score": match.location_fit_score,
        "intent_score": match.intent_score,
        "interest_overlap_score": match.interest_overlap_score,
        "preference_alignment_score": match.preference_alignment_score,
        "status": match.status,
        "intro_requested_at": match.intro_requested_at,
        "intro_accepted_at": match.intro_accepted_at,
        "created_at": match.created_at,
        "updated_at": match.updated_at,
        "target_user": target_user
    }

    return MatchWithUserResponse(**match_dict)


@router.post("/{match_id}/intro", status_code=status.HTTP_201_CREATED)
async def request_introduction(
    match_id: str,
    intro_request: IntroRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request introduction to a matched user - max 20 requests per day"""
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid match ID"
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

    # Rate limit check - max 20 intro requests per week (like YC)
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


@router.post("/{match_id}/intro/respond", status_code=status.HTTP_200_OK)
async def respond_to_introduction(
    match_id: str,
    response: IntroResponse,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept or decline an introduction request"""
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid match ID"
        )

    match = db.query(Match).filter(Match.id == match_uuid).first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Verify user is the target (recipient of intro request)
    if match.target_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only respond to introduction requests sent to you"
        )

    if not match.intro_requested_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No introduction request found for this match"
        )

    if match.intro_accepted_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Introduction already accepted"
        )

    if response.accept:
        # Accept the introduction
        match.status = "connected"
        match.intro_accepted_at = datetime.utcnow()
        match.updated_at = datetime.utcnow()

        # Create acceptance message if response message provided
        if response.message:
            acceptance_message = Message(
                match_id=match.id,
                sender_id=current_user.id,
                recipient_id=match.user_id,
                content=response.message,
                message_type="intro_response"
            )
            db.add(acceptance_message)
    else:
        # Decline the introduction
        match.status = "dismissed"
        match.updated_at = datetime.utcnow()

        # Create decline message if response message provided
        if response.message:
            decline_message = Message(
                match_id=match.id,
                sender_id=current_user.id,
                recipient_id=match.user_id,
                content=response.message,
                message_type="intro_response"
            )
            db.add(decline_message)

    db.commit()
    db.refresh(match)

    return {
        "message": "Introduction request responded to successfully",
        "match_id": str(match.id),
        "accepted": response.accept,
        "status": match.status
    }


@router.put("/{match_id}/status", response_model=MatchResponse)
async def update_match_status(
    match_id: str,
    status_update: MatchStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update match status (viewed, saved, dismissed)"""
    try:
        match_uuid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid match ID"
        )

    allowed_statuses = ["viewed", "saved", "dismissed"]
    if status_update.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status must be one of: {', '.join(allowed_statuses)}"
        )

    match = db.query(Match).filter(Match.id == match_uuid).first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Verify user is part of this match
    if match.user_id != current_user.id and match.target_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this match"
        )

    # Don't allow status changes if intro already requested/accepted
    if match.intro_requested_at and status_update.status in ["saved", "dismissed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change status after introduction request has been sent"
        )

    match.status = status_update.status
    match.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(match)

    return match
