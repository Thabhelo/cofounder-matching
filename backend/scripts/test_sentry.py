#!/usr/bin/env python3
"""
Test script for Sentry integration.
Run this to verify Sentry is capturing errors correctly.
"""

import os
import sys
import asyncio
from pathlib import Path

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.sentry_config import setup_sentry, capture_custom_error, capture_message
from app.config import settings


def test_basic_error_capture():
    """Test basic error capture functionality."""
    print("🧪 Testing basic error capture...")

    try:
        # This will raise an error
        1 / 0
    except ZeroDivisionError as e:
        capture_custom_error(
            error=e,
            context={
                "test": "basic_error_capture",
                "description": "Testing Sentry integration"
            },
            extra={
                "test_mode": True,
                "environment": settings.ENVIRONMENT
            }
        )
        print("✅ Basic error captured")


def test_pii_scrubbing():
    """Test PII scrubbing functionality."""
    print("🧪 Testing PII scrubbing...")

    try:
        # Create an error with PII data
        sensitive_data = {
            "email": "user@example.com",
            "phone": "+1-555-123-4567",
            "credit_card": "4111-1111-1111-1111",
            "password": "secret123",
            "normal_data": "this should not be scrubbed"
        }

        # This should fail and capture the error with scrubbed PII
        raise ValueError(f"Test error with sensitive data: {sensitive_data}")

    except ValueError as e:
        capture_custom_error(
            error=e,
            context={
                "test": "pii_scrubbing",
                "user_data": sensitive_data
            },
            extra={
                "sensitive_info": "This should be redacted: user@example.com, +1-555-123-4567"
            }
        )
        print("✅ PII scrubbing test completed")


def test_custom_message():
    """Test custom message capture."""
    print("🧪 Testing custom message capture...")

    capture_message(
        "Test message from monitoring setup",
        level="info",
        user_id="test_user_123",
        extra={
            "event_type": "setup_test",
            "timestamp": "2026-03-23T12:30:45Z",
            "test_data": "This is test data that should appear in Sentry"
        },
        context={
            "test_context": {
                "environment": settings.ENVIRONMENT,
                "test_suite": "sentry_integration"
            }
        }
    )
    print("✅ Custom message captured")


def test_performance_transaction():
    """Test performance monitoring."""
    print("🧪 Testing performance monitoring...")

    import sentry_sdk
    import time
    import random

    with sentry_sdk.start_transaction(op="test", name="performance_test"):
        # Simulate some work
        with sentry_sdk.start_span(op="db", description="Simulated database query"):
            time.sleep(random.uniform(0.1, 0.5))

        with sentry_sdk.start_span(op="http", description="Simulated API call"):
            time.sleep(random.uniform(0.2, 0.8))

        with sentry_sdk.start_span(op="compute", description="Simulated computation"):
            time.sleep(random.uniform(0.1, 0.3))

    print("✅ Performance transaction recorded")


async def test_async_error():
    """Test async error capture."""
    print("🧪 Testing async error capture...")

    try:
        # Simulate async operation failure
        await asyncio.sleep(0.1)
        raise ConnectionError("Simulated async database connection failure")

    except ConnectionError as e:
        capture_custom_error(
            error=e,
            context={
                "operation": "async_database_query",
                "attempt": 1,
                "max_retries": 3
            },
            extra={
                "async_context": True,
                "connection_pool_size": 20
            }
        )
        print("✅ Async error captured")


def main():
    """Run all Sentry tests."""
    print("🚀 Starting Sentry integration tests...")
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Sentry DSN configured: {'Yes' if settings.SENTRY_DSN else 'No'}")

    if not settings.SENTRY_DSN:
        print("❌ SENTRY_DSN not configured. Add it to your .env file to test Sentry integration.")
        print("Example: SENTRY_DSN=https://your_key@sentry.io/project_id")
        sys.exit(1)

    # Setup Sentry
    setup_sentry()
    print("✅ Sentry initialized")

    # Run tests
    test_basic_error_capture()
    test_pii_scrubbing()
    test_custom_message()
    test_performance_transaction()

    # Run async test
    asyncio.run(test_async_error())

    print("\n🎉 All Sentry tests completed!")
    print("📊 Check your Sentry dashboard at https://sentry.io to see the captured events.")
    print("🔍 Look for:")
    print("  - Error events with scrubbed PII")
    print("  - Custom messages and context")
    print("  - Performance transactions")
    print("  - User context and additional metadata")

    # Give Sentry a moment to send events
    print("\n⏳ Waiting 5 seconds for events to be sent to Sentry...")
    import time
    time.sleep(5)

    print("✨ Test completed successfully!")


if __name__ == "__main__":
    main()