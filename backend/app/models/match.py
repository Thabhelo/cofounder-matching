from sqlalchemy import Column, String, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column[uuid.UUID](UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column[uuid.UUID](UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_user_id = Column[uuid.UUID](UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Match Score and Details
    match_score = Column[int](Integer, nullable=False, index=True)
    match_explanation = Column[str | None](Text, nullable=True)

    # Score Breakdown (for transparency)
    complementarity_score = Column[int | None](Integer, nullable=True)
    stage_alignment_score = Column[int | None](Integer, nullable=True)
    commitment_alignment_score = Column[int | None](Integer, nullable=True)
    working_style_score = Column[int | None](Integer, nullable=True)
    location_fit_score = Column[int | None](Integer, nullable=True)
    intent_score = Column[int | None](Integer, nullable=True)

    # Status
    status = Column[str](String(50), default="pending", nullable=False, index=True)
    intro_requested_at = Column[datetime | None](TIMESTAMP, nullable=True)
    intro_accepted_at = Column[datetime | None](TIMESTAMP, nullable=True)

    # Metadata
    created_at = Column[datetime](TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column[datetime](TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<Match {self.user_id} -> {self.target_user_id} score={self.match_score}>"
