import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import jwt
from datetime import datetime, timedelta
from typing import Dict

# Import all models so they register with Base before table creation
import app.models  # noqa: F401
from app.database import Base, get_db

# Import app after models to ensure proper initialization
from app.main import app as fastapi_app

# Use PostgreSQL for tests (required for UUID support)
import os
if os.getenv("DATABASE_URL"):
    # CI environment - use PostgreSQL
    SQLALCHEMY_TEST_DATABASE_URL = os.getenv("DATABASE_URL")
else:
    # Local testing - use PostgreSQL container (docker-compose)
    # Use main database but wrap in transactions (rolled back after each test)
    SQLALCHEMY_TEST_DATABASE_URL = "postgresql://user:password@localhost:5432/cofounder_matching"

from sqlalchemy.pool import NullPool
engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    poolclass=NullPool,  # Don't pool connections in tests
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test"""
    # Create all tables if they don't exist
    Base.metadata.create_all(bind=engine)
    connection = engine.connect()
    # Force single-row inserts for PostgreSQL as a safety measure
    # With the GUID type fix (UUID objects instead of strings), this may no longer be needed
    # but keeping it as a fallback until verified in CI
    if os.getenv("DATABASE_URL"):
        connection = connection.execution_options(insertmanyvalues_page_size=1)
    # Start a transaction that wraps the entire test
    transaction = connection.begin()
    # Create a session bound to this connection
    db = TestingSessionLocal(bind=connection)
    
    try:
        yield db
    finally:
        # Always rollback the outer transaction to ensure clean state
        # This undoes all changes, even if tests called commit()
        db.close()
        try:
            transaction.rollback()
        except Exception:
            pass  # Transaction may already be rolled back
        connection.close()


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database override"""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def test_user_data() -> Dict:
    """Sample user data for testing"""
    return {
        "email": "test@example.com",
        "name": "Test User",
        "role_intent": "cofounder",
        "bio": "Test bio for testing purposes",
        "commitment": "full_time",
        "location": "San Francisco, CA",
        "previous_startups": 1
    }


@pytest.fixture
def mock_jwt_token() -> str:
    """Generate a mock JWT token for testing"""
    payload = {
        "sub": "clerk_test_user_123",
        "email": "test@example.com",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    # This is a test token, not used in production
    return jwt.encode(payload, "test_secret_key", algorithm="HS256")


@pytest.fixture
def auth_headers(mock_jwt_token: str) -> Dict[str, str]:
    """Generate authorization headers for testing"""
    return {"Authorization": f"Bearer {mock_jwt_token}"}


@pytest.fixture
def test_organization_data() -> Dict:
    """Sample organization data for testing"""
    return {
        "name": "Test Accelerator",
        "slug": "test-accelerator",
        "description": "A test accelerator for testing purposes",
        "org_type": "accelerator",
        "website_url": "https://test-accelerator.com",
        "location": "San Francisco, CA",
        "focus_areas": ["AI", "Healthcare"]
    }


@pytest.fixture
def test_event_data() -> Dict:
    """Sample event data for testing"""
    future_date = datetime.utcnow() + timedelta(days=7)
    return {
        "title": "Test Networking Event",
        "description": "A test networking event for testing purposes and validation",
        "event_type": "networking",
        "start_datetime": future_date,  # Return datetime object, not string
        "timezone": "America/Chicago",  # Required field
        "location_type": "in_person",
        "location_address": "123 Test St, San Francisco, CA",
        "max_attendees": 50
    }


@pytest.fixture
def test_resource_data() -> Dict:
    """Sample resource data for testing"""
    return {
        "title": "Test Grant Program",
        "description": "A test grant program for testing purposes and validation",
        "category": "funding",
        "resource_type": "grant",
        "amount_min": 10000,
        "amount_max": 50000,
        "currency": "USD",
        "application_url": "https://test-grant.com/apply"
    }
