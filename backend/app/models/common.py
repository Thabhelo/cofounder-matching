"""Common database types for SQLAlchemy models."""

import uuid
from sqlalchemy import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PostgreSQL_UUID


class GUID(TypeDecorator):
    """Platform-independent GUID type.

    Uses PostgreSQL's UUID type when available, otherwise uses CHAR(36) for compatibility.
    This allows models to work with both PostgreSQL (production) and SQLite (testing).
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
