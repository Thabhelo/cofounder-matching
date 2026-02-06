from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func
import uuid

from app.database import Base


class News(Base):
    __tablename__ = "news"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # News Details
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    excerpt = Column(Text, nullable=True)
    news_type = Column(String(100), nullable=True, index=True)

    # Media
    image_url = Column(String(500), nullable=True)
    external_url = Column(String(500), nullable=True)

    # Tags
    tags = Column(JSONB, nullable=True)

    # Status
    is_featured = Column(Boolean, default=False, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False, index=True)
    published_at = Column(TIMESTAMP, nullable=True, index=True)

    # Metadata
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<News {self.title}>"
