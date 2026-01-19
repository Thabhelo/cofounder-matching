from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column[uuid.UUID](UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column[uuid.UUID | None](UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reported_user_id = Column[uuid.UUID | None](UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reported_org_id = Column[uuid.UUID | None](UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    reported_resource_id = Column[uuid.UUID | None](UUID(as_uuid=True), ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)
    reported_event_id = Column[uuid.UUID | None](UUID(as_uuid=True), ForeignKey("events.id", ondelete="SET NULL"), nullable=True)

    # Report Details
    report_type = Column[str](String(100), nullable=False)
    description = Column[str](Text, nullable=False)

    # Status
    status = Column[str](String(50), default="pending", nullable=False, index=True)
    reviewed_by = Column[uuid.UUID | None](UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column[datetime | None](TIMESTAMP, nullable=True)
    resolution_notes = Column[str | None](Text, nullable=True)

    # Metadata
    created_at = Column[datetime](TIMESTAMP, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<Report type={self.report_type} status={self.status}>"
