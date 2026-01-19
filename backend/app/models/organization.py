from sqlalchemy import Column, String, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column[uuid.UUID](UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column[str](String(255), nullable=False)
    slug = Column[str](String(255), unique=True, nullable=False, index=True)
    description = Column[str | None](Text, nullable=True)
    website_url = Column[str | None](String(500), nullable=True)
    logo_url = Column[str | None](String(500), nullable=True)

    # Type and Focus
    org_type = Column[str | None](String(100), nullable=True, index=True)
    focus_areas = Column[list | None](JSONB, nullable=True)
    location = Column[str | None](String(255), nullable=True)

    # Verification
    is_verified = Column[bool](Boolean, default=False, nullable=False, index=True)
    verification_method = Column[str | None](String(50), nullable=True)
    verified_at = Column[datetime | None](TIMESTAMP, nullable=True)

    # Contact
    contact_email = Column[str | None](String(255), nullable=True)
    contact_phone = Column[str | None](String(50), nullable=True)

    # Metadata
    created_at = Column[datetime](TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column[datetime](TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)
    is_active = Column[bool](Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Organization {self.name}>"


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_user_organization"),
    )

    id = Column[uuid.UUID](UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column[uuid.UUID](UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column[uuid.UUID](UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column[str](String(50), nullable=False)
    is_primary = Column[bool](Boolean, default=False, nullable=False)
    joined_at = Column[datetime](TIMESTAMP, server_default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<OrganizationMember user={self.user_id} org={self.organization_id}>"
