"""
Sentry error tracking and performance monitoring configuration.
Includes PII scrubbing and environment-specific settings.
"""

import sentry_sdk
import logging
import re
from typing import Any, Dict, Optional
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from app.config import settings


class SentryPIIFilter:
    """
    Sentry event processor to remove PII from error reports.
    Works in conjunction with our logging PII filter.
    """

    # PII patterns - same as logging configuration for consistency
    EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
    PHONE_PATTERN = re.compile(r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b')
    SSN_PATTERN = re.compile(r'\b\d{3}-?\d{2}-?\d{4}\b')
    CREDIT_CARD_PATTERN = re.compile(r'\b(?:\d{4}[-.\s]?){3}\d{4}\b')
    TOKEN_PATTERN = re.compile(r'\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b')
    API_KEY_PATTERN = re.compile(r'\b[A-Za-z0-9_-]{32,}\b')

    # Sensitive field names
    SENSITIVE_FIELDS = {
        'password', 'passwd', 'secret', 'token', 'key', 'authorization',
        'email', 'phone', 'ssn', 'social_security_number', 'credit_card',
        'card_number', 'cvv', 'cvc', 'pin', 'birth_date', 'dob', 'api_key',
        'clerk_secret_key', 'database_url', 'resend_api_key'
    }

    def __init__(self):
        self.patterns = [
            (self.EMAIL_PATTERN, '[EMAIL_REDACTED]'),
            (self.PHONE_PATTERN, '[PHONE_REDACTED]'),
            (self.SSN_PATTERN, '[SSN_REDACTED]'),
            (self.CREDIT_CARD_PATTERN, '[CARD_REDACTED]'),
            (self.TOKEN_PATTERN, '[TOKEN_REDACTED]'),
            (self.API_KEY_PATTERN, '[API_KEY_REDACTED]'),
        ]

    def __call__(self, event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process Sentry event to remove PII.

        Args:
            event: Sentry event data
            hint: Additional context about the event

        Returns:
            Processed event with PII removed, or None to drop the event
        """
        try:
            # Scrub exception messages
            if 'exception' in event and 'values' in event['exception']:
                for exception in event['exception']['values']:
                    if 'value' in exception:
                        exception['value'] = self._scrub_text(exception['value'])

            # Scrub request data
            if 'request' in event:
                event['request'] = self._scrub_request(event['request'])

            # Scrub extra data
            if 'extra' in event:
                event['extra'] = self._scrub_dict(event['extra'])

            # Scrub tags
            if 'tags' in event:
                event['tags'] = self._scrub_dict(event['tags'])

            # Scrub user data (keep user ID but remove PII)
            if 'user' in event:
                user_data = event['user']
                if 'email' in user_data:
                    user_data['email'] = '[EMAIL_REDACTED]'
                if 'ip_address' in user_data:
                    user_data['ip_address'] = '[IP_REDACTED]'
                # Keep id for tracking, but scrub other fields

            # Scrub breadcrumbs
            if 'breadcrumbs' in event and 'values' in event['breadcrumbs']:
                for breadcrumb in event['breadcrumbs']['values']:
                    if 'message' in breadcrumb:
                        breadcrumb['message'] = self._scrub_text(breadcrumb['message'])
                    if 'data' in breadcrumb:
                        breadcrumb['data'] = self._scrub_dict(breadcrumb['data'])

            return event

        except Exception as e:
            # If PII scrubbing fails, log the error but return the original event
            # Better to have some PII than no error tracking at all
            logging.getLogger(__name__).error(f"Error in Sentry PII filter: {e}")
            return event

    def _scrub_text(self, text: str) -> str:
        """Scrub PII patterns from text."""
        if not isinstance(text, str):
            return text

        scrubbed = text
        for pattern, replacement in self.patterns:
            scrubbed = pattern.sub(replacement, scrubbed)
        return scrubbed

    def _scrub_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Scrub PII from dictionary data."""
        if not isinstance(data, dict):
            return data

        scrubbed = {}
        for key, value in data.items():
            key_lower = key.lower()

            # Check if key indicates sensitive data
            if any(sensitive in key_lower for sensitive in self.SENSITIVE_FIELDS):
                scrubbed[key] = '[REDACTED]'
            elif isinstance(value, str):
                scrubbed[key] = self._scrub_text(value)
            elif isinstance(value, dict):
                scrubbed[key] = self._scrub_dict(value)
            elif isinstance(value, list):
                scrubbed[key] = [self._scrub_dict(item) if isinstance(item, dict)
                               else self._scrub_text(item) if isinstance(item, str)
                               else item for item in value]
            else:
                scrubbed[key] = value

        return scrubbed

    def _scrub_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Scrub PII from request data."""
        scrubbed_request = {}

        for key, value in request.items():
            if key in ['data', 'form', 'json']:
                # Scrub request body data
                scrubbed_request[key] = self._scrub_dict(value) if isinstance(value, dict) else value
            elif key == 'headers':
                # Scrub sensitive headers
                scrubbed_headers = {}
                for header_name, header_value in (value or {}).items():
                    header_lower = header_name.lower()
                    if any(sensitive in header_lower for sensitive in {'authorization', 'cookie', 'token', 'key'}):
                        scrubbed_headers[header_name] = '[REDACTED]'
                    else:
                        scrubbed_headers[header_name] = header_value
                scrubbed_request[key] = scrubbed_headers
            elif key == 'query_string':
                # Scrub query parameters
                scrubbed_request[key] = self._scrub_text(value) if isinstance(value, str) else value
            else:
                scrubbed_request[key] = value

        return scrubbed_request


def setup_sentry():
    """
    Configure Sentry for error tracking and performance monitoring.
    """
    if not settings.SENTRY_DSN:
        logging.getLogger(__name__).info("Sentry DSN not configured, skipping Sentry setup")
        return

    # Environment-specific configuration
    environment = settings.SENTRY_ENVIRONMENT or settings.ENVIRONMENT

    # Sample rates based on environment
    if settings.ENVIRONMENT == "production":
        traces_sample_rate = min(settings.SENTRY_TRACES_SAMPLE_RATE, 0.1)  # Max 10% in prod
        profiles_sample_rate = 0.1
    elif settings.ENVIRONMENT == "test":
        traces_sample_rate = 0.0  # No performance monitoring in tests
        profiles_sample_rate = 0.0
    else:
        traces_sample_rate = settings.SENTRY_TRACES_SAMPLE_RATE
        profiles_sample_rate = 1.0

    # Configure integrations
    integrations = [
        FastApiIntegration(
            auto_tag_request_id=True,
            auto_tag_user_id=True,
            auto_tag_query_string=True,
            failed_request_status_codes=[400, 401, 403, 404, 413, 429, range(500, 600)]
        ),
        SqlalchemyIntegration(),
        HttpxIntegration(),
        LoggingIntegration(
            level=logging.INFO,  # Capture info and above
            event_level=logging.ERROR,  # Send events for errors and above
        ),
        RedisIntegration(),  # For future Redis usage
    ]

    # Initialize Sentry
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=environment,
        integrations=integrations,
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,

        # PII scrubbing
        before_send=SentryPIIFilter(),

        # Additional configuration
        attach_stacktrace=True,  # Include stack traces for all events
        send_default_pii=False,  # Don't send default PII
        max_breadcrumbs=50,  # Keep more breadcrumbs for debugging

        # Release tracking
        release=f"cofounder-matching@{settings.ENVIRONMENT}",

        # Error filtering
        ignore_errors=[
            # Common errors that aren't actionable
            "ConnectionError",
            "TimeoutError",
            "BrokenPipeError",
            KeyboardInterrupt,
            SystemExit,
            # HTTP client errors that are user-caused
            "404",
            "401",
            "403",
        ],

        # Performance monitoring
        enable_tracing=True,

        # Debug mode (only in development)
        debug=settings.ENVIRONMENT == "development",
    )

    # Set additional context
    sentry_sdk.set_context("application", {
        "name": "cofounder-matching-api",
        "version": "1.0.0",
        "environment": environment,
    })

    logger = logging.getLogger(__name__)
    logger.info("Sentry initialized", extra={
        "environment": environment,
        "traces_sample_rate": traces_sample_rate,
        "profiles_sample_rate": profiles_sample_rate,
    })


def capture_custom_error(
    error: Exception,
    context: Dict[str, Any] = None,
    user_id: str = None,
    extra: Dict[str, Any] = None,
    level: str = "error"
):
    """
    Capture a custom error with additional context.

    Args:
        error: The exception to capture
        context: Additional context about the error
        user_id: User ID for tracking
        extra: Extra data to include
        level: Sentry level (error, warning, info)
    """
    with sentry_sdk.configure_scope() as scope:
        if user_id:
            scope.user = {"id": user_id}

        if context:
            for key, value in context.items():
                scope.set_context(key, value)

        if extra:
            for key, value in extra.items():
                scope.set_extra(key, value)

        scope.level = level

        sentry_sdk.capture_exception(error)


def capture_message(
    message: str,
    level: str = "info",
    user_id: str = None,
    extra: Dict[str, Any] = None,
    context: Dict[str, Any] = None
):
    """
    Capture a custom message.

    Args:
        message: The message to capture
        level: Sentry level (error, warning, info)
        user_id: User ID for tracking
        extra: Extra data to include
        context: Additional context
    """
    with sentry_sdk.configure_scope() as scope:
        if user_id:
            scope.user = {"id": user_id}

        if context:
            for key, value in context.items():
                scope.set_context(key, value)

        if extra:
            for key, value in extra.items():
                scope.set_extra(key, value)

        scope.level = level

        sentry_sdk.capture_message(message, level=level)


# Monitoring configuration for external uptime services
UPTIME_MONITORING_CONFIG = {
    "endpoints": [
        {
            "name": "API Health Check",
            "url": "/health",
            "method": "GET",
            "expected_status": 200,
            "timeout": 10,
            "interval": "1m"
        },
        {
            "name": "API Root",
            "url": "/",
            "method": "GET",
            "expected_status": 200,
            "timeout": 5,
            "interval": "5m"
        },
        {
            "name": "Metrics Endpoint",
            "url": "/metrics",
            "method": "GET",
            "expected_status": 200,
            "timeout": 5,
            "interval": "5m"
        }
    ],
    "alert_contacts": [
        {
            "type": "email",
            "value": "alerts@yourdomain.com"
        },
        {
            "type": "slack",
            "value": "#alerts"
        }
    ],
    "alert_thresholds": {
        "response_time_ms": 5000,
        "uptime_percentage": 99.0,
        "consecutive_failures": 3
    }
}