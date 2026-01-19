from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func
from datetime import datetime
import uuid

from app.database import Base


class News(Base):
    __tablename__ = "news"

    id = Column[uuid.UUID](UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column[uuid.UUID | None](UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    created_by = Column[uuid.UUID | None](UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # News Details
    title = Column[str](String(255), nullable=False)
    content = Column[str](Text, nullable=False)
    excerpt = Column[str | None](Text, nullable=True)
    news_type = Column[str | None](String(100), nullable=True, index=True)

    # Media
    image_url = Column[str | None](String(500), nullable=True)
    external_url = Column[str | None](String(500), nullable=True)

    # Tags
    tags = Column[list | None](JSONB, nullable=True)

    # Status
    is_featured = Column[bool](Boolean, default=False, nullable=False)
    is_published = Column[bool](Boolean, default=False, nullable=False, index=True)
    published_at = Column[datetime | None](TIMESTAMP, nullable=True, index=True)

    # Metadata
    created_at = Column[datetime](TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column[datetime](TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<News {self.title}>"
