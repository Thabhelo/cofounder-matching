from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

from app.schemas.user import UserPublicResponse


class MessageCreate(BaseModel):
    match_id: UUID = Field(..., description="Match ID for the conversation")
    content: str = Field(..., min_length=1, max_length=5000, description="Message content")


class MessageResponse(BaseModel):
    id: UUID
    match_id: UUID
    sender_id: UUID
    recipient_id: UUID
    content: str
    message_type: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    sender: Optional[UserPublicResponse] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    match_id: UUID
    other_user: UserPublicResponse
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    updated_at: datetime

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    total_unread: int
    conversations: dict[str, int]  # match_id -> unread count
