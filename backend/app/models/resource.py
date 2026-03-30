from sqlalchemy import Column, String, Boolean, Text, Date, DECIMAL, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Resource(Base):
    __tablename__ = "resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Resource Details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=True)

    # Eligibility
    stage_eligibility = Column(JSONB, nullable=True)
    location_eligibility = Column(JSONB, nullable=True)
    other_eligibility = Column(Text, nullable=True)

    # Details
    amount_min = Column(DECIMAL(12, 2), nullable=True)
    amount_max = Column(DECIMAL(12, 2), nullable=True)
    currency = Column(String(10), default="USD", nullable=False)
    application_url = Column(String(500), nullable=True)
    deadline = Column(Date, nullable=True)

    # Tags and Metadata
    tags = Column(JSONB, nullable=True)
    is_featured = Column(Boolean, default=False, nullable=False)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<Resource {self.title}>"


class UserSavedResource(Base):
    __tablename__ = "user_saved_resources"
    __table_args__ = (
        UniqueConstraint("user_id", "resource_id", name="uq_user_saved_resource"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    saved_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    notes = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<UserSavedResource user={self.user_id} resource={self.resource_id}>"
