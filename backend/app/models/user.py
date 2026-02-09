
import uuid

from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PostgreSQL_UUID
from sqlalchemy.sql import func

from app.database import Base


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type when available, otherwise uses CHAR(36) for compatibility.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            # Use as_uuid=True to ensure UUID objects are used (not strings)
            # This matches the pattern used in other models and fixes sentinel matching
            return dialect.type_descriptor(PostgreSQL_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            # Return UUID object directly - PostgreSQL UUID type handles it natively
            # This is critical for SQLAlchemy 2.0's sentinel matching to work correctly
            return value
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)

class User(Base):
    __tablename__ = "users" # we do this so that sqlalchemy knows what table to use

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    clerk_id = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)

    # Onboarding fields
    role_intent = Column(String(50), nullable=True)  # founder, cofounder, early_employee
    commitment = Column(String(50), nullable=True)  # full_time, part_time, exploratory
    location = Column(String(255), nullable=True)
    experience_years = Column(Integer, nullable=True)
    previous_startups = Column(Integer, nullable=True)
    github_url = Column(String(500), nullable=True)
    portfolio_url = Column(String(500), nullable=True)
    linkedin_url = Column(String(500), nullable=True)

    # Account status fields
    is_active = Column(Boolean, default=True, nullable=False)
    is_banned = Column(Boolean, default=False, nullable=False)

    created_at = Column(TIMESTAMP, default=func.now())
    updated_at = Column(TIMESTAMP, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.name}>"