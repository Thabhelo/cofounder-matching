from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional, cast
from datetime import datetime, timedelta, timezone
from uuid import UUID
import uuid

from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.models.message import Message
from app.schemas.message import (
    MessageCreate,
    MessageResponse,
    ConversationResponse,
    UnreadCountResponse
)
from app.schemas.user import UserPublicResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=List[ConversationResponse])
async def get_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all conversations (matches with messages) for current user"""
    # Get all matches where user is connected
    matches = db.query(Match).filter(
        or_(
            and_(Match.user_id == current_user.id, Match.status == "connected"),
            and_(Match.target_user_id == current_user.id, Match.status == "connected")
        )
    ).all()

    # Deduplicate - only show one conversation per pair of users
    seen_pairs: set = set()
    unique_matches = []
    match_to_other_id = {}
    for match in matches:
        other_user_id = match.target_user_id if match.user_id == current_user.id else match.user_id
        pair = tuple(sorted([str(current_user.id), str(other_user_id)]))
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        unique_matches.append(match)
        match_to_other_id[match.id] = other_user_id

    match_ids = [m.id for m in unique_matches]

    # Batch load other users (single query)
    other_user_ids = list(match_to_other_id.values())
    users_map = {
        u.id: u for u in db.query(User).filter(
            User.id.in_(other_user_ids),
            User.is_active,
            ~User.is_banned,
        ).all()
    }

    # Batch load last message per match using a subquery
    if match_ids:
        last_msg_subq = (
            db.query(Message.match_id, func.max(Message.created_at).label("max_ts"))
            .filter(Message.match_id.in_(match_ids))
            .group_by(Message.match_id)
            .subquery()
        )
        last_messages_list = (
            db.query(Message)
            .join(last_msg_subq, and_(
                Message.match_id == last_msg_subq.c.match_id,
                Message.created_at == last_msg_subq.c.max_ts,
            ))
            .all()
        )
        last_messages_map = {msg.match_id: msg for msg in last_messages_list}

        # Batch load unread counts (single GROUP BY query)
        unread_rows = (
            db.query(Message.match_id, func.count().label("cnt"))
            .filter(
                Message.match_id.in_(match_ids),
                Message.recipient_id == current_user.id,
                ~Message.is_read,
            )
            .group_by(Message.match_id)
            .all()
        )
        unread_map = {row.match_id: row.cnt for row in unread_rows}

        # Batch load last-message senders
        sender_ids = list({msg.sender_id for msg in last_messages_list})
        senders_map = {u.id: u for u in db.query(User).filter(User.id.in_(sender_ids)).all()}
    else:
        last_messages_map = {}
        unread_map = {}
        senders_map = {}

    conversations = []
    for match in unique_matches:
        other_user = users_map.get(match_to_other_id[match.id])
        if not other_user:
            continue

        last_message = last_messages_map.get(match.id)
        unread_count = unread_map.get(match.id, 0)

        last_message_response = None
        if last_message:
            sender = senders_map.get(last_message.sender_id)
            if sender:
                last_message_response = MessageResponse(
                    id=cast(UUID, last_message.id),
                    match_id=cast(UUID, last_message.match_id),
                    sender_id=cast(UUID, last_message.sender_id),
                    recipient_id=cast(UUID, last_message.recipient_id),
                    content=cast(str, last_message.content),
                    message_type=cast(str, last_message.message_type),
                    is_read=cast(bool, last_message.is_read),
                    read_at=cast(Optional[datetime], last_message.read_at),
                    created_at=cast(datetime, last_message.created_at),
                    sender=UserPublicResponse.model_validate(sender),
                )

        updated_at = cast(datetime, match.updated_at or match.created_at)
        if last_message and last_message.created_at and cast(datetime, last_message.created_at) > updated_at:
            updated_at = cast(datetime, last_message.created_at)

        conversations.append(ConversationResponse(
            match_id=cast(UUID, match.id),
            other_user=other_user,
            last_message=last_message_response,
            unread_count=unread_count,
            updated_at=updated_at,
        ))

    # Sort by updated_at (most recent first)
    conversations.sort(key=lambda x: x.updated_at, reverse=True)

    # Apply pagination
    return conversations[skip:skip + limit]


@router.get("/unread/count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total unread message count and per-conversation counts"""
    # Get all matches where user is connected
    matches = db.query(Match).filter(
        or_(
            and_(Match.user_id == current_user.id, Match.status == "connected"),
            and_(Match.target_user_id == current_user.id, Match.status == "connected")
        )
    ).all()

    match_ids = [m.id for m in matches]
    unread_rows = (
        db.query(Message.match_id, func.count().label("cnt"))
        .filter(
            Message.match_id.in_(match_ids),
            Message.recipient_id == current_user.id,
            ~Message.is_read,
        )
        .group_by(Message.match_id)
        .all()
    )

    total_unread = 0
    conversations = {}
    for row in unread_rows:
        total_unread += row.cnt
        conversations[str(row.match_id)] = row.cnt

    return UnreadCountResponse(
        total_unread=total_unread,
        conversations=conversations,
    )


@router.get("/{match_id}", response_model=List[MessageResponse])
async def get_messages(
    match_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages for a specific match/thread"""
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

    # Verify user is part of this match and it's connected
    if match.user_id != current_user.id and match.target_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view messages for this match"
        )

    if match.status != "connected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Messages are only available for connected matches"
        )

    # Get messages for this match
    messages = db.query(Message).filter(
        Message.match_id == match_uuid
    ).order_by(Message.created_at.asc()).offset(skip).limit(limit).all()

    # Batch-load all senders in a single query
    sender_ids = list({msg.sender_id for msg in messages})
    senders_map = {u.id: u for u in db.query(User).filter(User.id.in_(sender_ids)).all()}

    result = []
    for message in messages:
        sender = senders_map.get(message.sender_id)
        if sender:
            result.append(MessageResponse(
                id=cast(UUID, message.id),
                match_id=cast(UUID, message.match_id),
                sender_id=cast(UUID, message.sender_id),
                recipient_id=cast(UUID, message.recipient_id),
                content=cast(str, message.content),
                message_type=cast(str, message.message_type),
                is_read=cast(bool, message.is_read),
                read_at=cast(Optional[datetime], message.read_at),
                created_at=cast(datetime, message.created_at),
                sender=UserPublicResponse.model_validate(sender),
            ))

    return result


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to a connected user"""
    match = db.query(Match).filter(Match.id == message_data.match_id).first()

    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )

    # Verify user is part of this match
    if match.user_id != current_user.id and match.target_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to send messages for this match"
        )

    # Verify match is connected
    if match.status != "connected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Messages can only be sent to connected users"
        )

    # Determine recipient
    if match.user_id == current_user.id:
        recipient_id = match.target_user_id
    else:
        recipient_id = match.user_id

    # Rate limiting - max 50 messages per day
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    recent_messages = db.query(Message).filter(
        Message.sender_id == current_user.id,
        Message.message_type == "message",  # Only count regular messages, not intro requests
        Message.created_at >= yesterday
    ).count()

    if recent_messages >= 50:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum of 50 messages per day. Please try again tomorrow."
        )

    # Create message
    message = Message(
        match_id=message_data.match_id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        content=message_data.content,
        message_type="message"
    )
    db.add(message)

    # Update match updated_at
    match.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    db.refresh(message)

    # Get sender info
    sender = db.query(User).filter(User.id == current_user.id).first()
    return MessageResponse(
        id=cast(UUID, message.id),
        match_id=cast(UUID, message.match_id),
        sender_id=cast(UUID, message.sender_id),
        recipient_id=cast(UUID, message.recipient_id),
        content=cast(str, message.content),
        message_type=cast(str, message.message_type),
        is_read=cast(bool, message.is_read),
        read_at=cast(Optional[datetime], message.read_at),
        created_at=cast(datetime, message.created_at),
        sender=UserPublicResponse.model_validate(sender) if sender else None,
    )


@router.put("/{message_id}/read", status_code=status.HTTP_200_OK)
async def mark_message_read(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a message as read"""
    try:
        message_uuid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid message ID"
        )

    message = db.query(Message).filter(Message.id == message_uuid).first()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Verify user is the recipient
    if message.recipient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to mark this message as read"
        )

    # Mark as read
    if not message.is_read:
        message.is_read = True  # type: ignore[assignment]
        message.read_at = datetime.now(timezone.utc)  # type: ignore[assignment]
        db.commit()
        db.refresh(message)

    return {
        "message": "Message marked as read",
        "message_id": str(message.id)
    }


@router.put("/match/{match_id}/read-all", status_code=status.HTTP_200_OK)
async def mark_all_messages_read(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all messages in a thread as read"""
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
            detail="Not authorized to mark messages for this match"
        )

    # Mark all unread messages as read
    unread_messages = db.query(Message).filter(
        Message.match_id == match_uuid,
        Message.recipient_id == current_user.id,
        ~Message.is_read
    ).all()

    now = datetime.now(timezone.utc)
    for msg in unread_messages:
        msg.is_read = True  # type: ignore[assignment]
        msg.read_at = now  # type: ignore[assignment]

    db.commit()

    return {
        "message": f"Marked {len(unread_messages)} messages as read",
        "match_id": match_id
    }
