# Backend Test Suite

## Overview
Comprehensive test suite for the co-founder matching platform backend API.

## Test Categories

### Authentication Tests (`test_auth.py`)
- JWT token verification
- Onboarding authentication
- Banned/inactive user rejection
- clerk_id extraction from JWT

### User API Tests (`test_api_users.py`)
- User onboarding
- Profile management
- Public profile viewing
- User search with filtering
- Pagination

### Organization API Tests (`test_api_organizations.py`)
- Organization CRUD operations
- Authorization checks (member/non-member)
- Creator auto-added as admin
- Unique constraints on membership

### Event API Tests (`test_api_events.py`)
- Event listing and filtering
- RSVP functionality
- Capacity limit enforcement
- **Race condition prevention** (critical bug fix)
- RSVP status changes (maybe → going, going → not_going)
- Unique constraints on RSVPs

### Resource API Tests (`test_api_resources.py`)
- Resource CRUD operations
- Filtering by category, stage, featured status
- Authorization (creator, org member permissions)
- Unique constraints on saved resources

## Running Tests

### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Run All Tests
```bash
pytest
```

### Run with Coverage
```bash
pytest --cov=app --cov-report=term-missing
```

### Run Specific Test File
```bash
pytest tests/test_api_events.py -v
```

### Run Specific Test
```bash
pytest tests/test_api_events.py::TestEventRSVP::test_capacity_limit_enforced -v
```

### Run by Marker
```bash
pytest -m auth        # Authentication tests only
pytest -m api         # API tests only
pytest -m db          # Database tests only
```

## Test Coverage Goals
- Minimum 80% code coverage
- 100% coverage on critical paths:
  - Authentication/authorization
  - RSVP capacity logic
  - Database constraints

## Notes
- Tests use SQLite in-memory database for speed
- Some tests marked with `pytest.skip()` require proper Clerk mock implementation
- All tests should be independent and not rely on execution order
