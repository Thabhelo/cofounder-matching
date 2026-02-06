from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Event Details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    event_type = Column(String(100), nullable=True)

    # Timing
    start_datetime = Column(TIMESTAMP, nullable=False, index=True)
    end_datetime = Column(TIMESTAMP, nullable=True)
    timezone = Column(String(50), default="America/Chicago", nullable=False)
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurrence_rule = Column(String(255), nullable=True)

    # Location
    location_type = Column(String(50), nullable=True)
    location_address = Column(Text, nullable=True)
    location_url = Column(String(500), nullable=True)

    # Registration
    registration_url = Column(String(500), nullable=True)
    registration_required = Column(Boolean, default=False, nullable=False)
    max_attendees = Column(Integer, nullable=True)
    current_attendees = Column(Integer, default=0, nullable=False)

    # Tags and Metadata
    tags = Column(JSONB, nullable=True)
    is_featured = Column(Boolean, default=False, nullable=False)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<Event {self.title}>"


class UserEventRSVP(Base):
    __tablename__ = "user_event_rsvps"
    __table_args__ = (
        UniqueConstraint("user_id", "event_id", name="uq_user_event_rsvp"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    rsvp_status = Column(String(50), nullable=False)
    rsvp_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<UserEventRSVP user={self.user_id} event={self.event_id} status={self.rsvp_status}>"
