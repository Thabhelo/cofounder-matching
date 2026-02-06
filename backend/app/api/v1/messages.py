from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List
from datetime import datetime, timedelta
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
    seen_pairs = set()
    conversations = []

    for match in matches:
        # Determine the other user
        if match.user_id == current_user.id:
            other_user_id = match.target_user_id
        else:
            other_user_id = match.user_id

        # Create a pair identifier (sorted to avoid duplicates)
        pair = tuple(sorted([str(current_user.id), str(other_user_id)]))

        # Skip if we've already seen this pair
        if pair in seen_pairs:
            continue

        seen_pairs.add(pair)

        other_user = db.query(User).filter(
            User.id == other_user_id,
            User.is_active,
            ~User.is_banned
        ).first()

        if not other_user:
            continue

        # Get last message in thread
        last_message = db.query(Message).filter(
            Message.match_id == match.id
        ).order_by(desc(Message.created_at)).first()

        # Count unread messages (messages sent to current user that are unread)
        unread_count = db.query(Message).filter(
            Message.match_id == match.id,
            Message.recipient_id == current_user.id,
            ~Message.is_read
        ).count()

        # Get last message response if exists
        last_message_response = None
        if last_message:
            sender = db.query(User).filter(User.id == last_message.sender_id).first()
            if sender:
                last_message_dict = {
                    "id": last_message.id,
                    "match_id": last_message.match_id,
                    "sender_id": last_message.sender_id,
                    "recipient_id": last_message.recipient_id,
                    "content": last_message.content,
                    "message_type": last_message.message_type,
                    "is_read": last_message.is_read,
                    "read_at": last_message.read_at,
                    "created_at": last_message.created_at,
                    "sender": sender
                }
                last_message_response = MessageResponse(**last_message_dict)

        # Use match updated_at or last message created_at
        updated_at = match.updated_at
        if last_message and last_message.created_at > updated_at:
            updated_at = last_message.created_at

        conversations.append(ConversationResponse(
            match_id=match.id,
            other_user=other_user,
            last_message=last_message_response,
            unread_count=unread_count,
            updated_at=updated_at
        ))

    # Sort by updated_at (most recent first)
    conversations.sort(key=lambda x: x.updated_at, reverse=True)

    # Apply pagination
    return conversations[skip:skip + limit]


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

    # Get sender info for each message
    result = []
    for message in messages:
        sender = db.query(User).filter(User.id == message.sender_id).first()
        if sender:
            message_dict = {
                "id": message.id,
                "match_id": message.match_id,
                "sender_id": message.sender_id,
                "recipient_id": message.recipient_id,
                "content": message.content,
                "message_type": message.message_type,
                "is_read": message.is_read,
                "read_at": message.read_at,
                "created_at": message.created_at,
                "sender": sender
            }
            result.append(MessageResponse(**message_dict))

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
    yesterday = datetime.utcnow() - timedelta(days=1)
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
    match.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(message)

    # Get sender info
    sender = db.query(User).filter(User.id == current_user.id).first()
    message_dict = {
        "id": message.id,
        "match_id": message.match_id,
        "sender_id": message.sender_id,
        "recipient_id": message.recipient_id,
        "content": message.content,
        "message_type": message.message_type,
        "is_read": message.is_read,
        "read_at": message.read_at,
        "created_at": message.created_at,
        "sender": sender
    }

    return MessageResponse(**message_dict)


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
        message.is_read = True
        message.read_at = datetime.utcnow()
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

    now = datetime.utcnow()
    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = now

    db.commit()

    return {
        "message": f"Marked {len(unread_messages)} messages as read",
        "match_id": match_id
    }


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

    total_unread = 0
    conversations = {}

    for match in matches:
        unread_count = db.query(Message).filter(
            Message.match_id == match.id,
            Message.recipient_id == current_user.id,
            ~Message.is_read
        ).count()

        if unread_count > 0:
            total_unread += unread_count
            conversations[str(match.id)] = unread_count

    return UnreadCountResponse(
        total_unread=total_unread,
        conversations=conversations
    )
