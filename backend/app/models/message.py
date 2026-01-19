from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column[uuid.UUID](UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id = Column[uuid.UUID](UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column[uuid.UUID](UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column[uuid.UUID](UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Message Content
    content = Column[str](Text, nullable=False)
    message_type = Column[str](String(50), default="message", nullable=False)

    # Status
    is_read = Column[bool](Boolean, default=False, nullable=False)
    read_at = Column[datetime | None](TIMESTAMP, nullable=True)

    # Metadata
    created_at = Column[datetime](TIMESTAMP, server_default=func.now(), nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<Message from={self.sender_id} to={self.recipient_id}>"
