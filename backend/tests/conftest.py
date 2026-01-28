import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import jwt
from datetime import datetime, timedelta
from typing import Dict

from app.main import app
from app.database import Base, get_db

# Use in-memory SQLite for testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test"""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database override"""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data() -> Dict:
    """Sample user data for testing"""
    return {
        "email": "test@example.com",
        "name": "Test User",
        "role_intent": "cofounder",
        "bio": "Test bio for testing purposes",
        "stage_preference": "mvp",
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
        "start_datetime": future_date.isoformat(),
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
