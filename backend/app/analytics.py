"""
Analytics and tracking configuration for GDPR-compliant user behavior analysis.
Uses PostHog for privacy-first analytics with PII protection.
"""

import logging
import re
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import posthog
from app.config import settings

logger = logging.getLogger(__name__)


class AnalyticsManager:
    """
    Manages analytics tracking with privacy protection and GDPR compliance.
    """

    def __init__(self):
        self.enabled = False
        self.posthog_client = None
        self._setup_analytics()

    def _setup_analytics(self):
        """Initialize analytics provider if configured."""
        posthog_api_key = getattr(settings, 'POSTHOG_API_KEY', '')
        posthog_host = getattr(settings, 'POSTHOG_HOST', 'https://app.posthog.com')

        if posthog_api_key and settings.ENVIRONMENT != "test":
            try:
                posthog.api_key = posthog_api_key
                posthog.host = posthog_host

                # Configure privacy settings
                posthog.disabled = settings.ENVIRONMENT == "test"

                self.posthog_client = posthog
                self.enabled = True

                logger.info("Analytics initialized", extra={
                    "provider": "PostHog",
                    "environment": settings.ENVIRONMENT,
                    "privacy_mode": True
                })
            except Exception as e:
                logger.error(f"Failed to initialize analytics: {e}")
                self.enabled = False
        else:
            logger.info("Analytics disabled - no API key configured")

    def _sanitize_properties(self, properties: Dict[str, Any]) -> Dict[str, Any]:
        """
        Remove PII and sensitive data from analytics properties.
        """
        if not properties:
            return {}

        sanitized = {}

        # Patterns for sensitive data
        email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        phone_pattern = re.compile(r'\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b')

        # Sensitive field names
        sensitive_fields = {
            'password', 'passwd', 'secret', 'token', 'key', 'authorization',
            'email', 'phone', 'ssn', 'social_security_number', 'credit_card',
            'card_number', 'cvv', 'cvc', 'pin', 'birth_date', 'dob', 'api_key'
        }

        for key, value in properties.items():
            # Skip sensitive fields
            if key.lower() in sensitive_fields:
                continue

            # Sanitize string values
            if isinstance(value, str):
                # Remove email addresses
                value = email_pattern.sub('[EMAIL_REMOVED]', value)
                # Remove phone numbers
                value = phone_pattern.sub('[PHONE_REMOVED]', value)

            # Only include safe data types
            if isinstance(value, (str, int, float, bool, list, dict)):
                sanitized[key] = value

        return sanitized

    def _get_user_properties(self, user_id: str, additional_props: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get safe user properties for analytics (no PII).
        """
        properties = {
            'environment': settings.ENVIRONMENT,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

        if additional_props:
            properties.update(self._sanitize_properties(additional_props))

        return properties

    def track_event(
        self,
        event_name: str,
        user_id: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
        anonymous_id: Optional[str] = None
    ):
        """
        Track an analytics event with privacy protection.

        Args:
            event_name: Name of the event to track
            user_id: User ID (optional, for authenticated users)
            properties: Additional properties (will be sanitized)
            anonymous_id: Anonymous identifier for non-authenticated users
        """
        if not self.enabled or not self.posthog_client:
            return

        try:
            # Use anonymous_id if no user_id provided
            distinct_id = user_id if user_id else (anonymous_id or "anonymous")

            # Prepare properties
            event_properties = self._get_user_properties(user_id, properties)

            # Track the event
            self.posthog_client.capture(
                distinct_id=distinct_id,
                event=event_name,
                properties=event_properties
            )

            logger.debug("Analytics event tracked", extra={
                "event": event_name,
                "user_id": user_id[:8] + "..." if user_id else None,
                "properties_count": len(event_properties)
            })
        except Exception as e:
            logger.error(f"Failed to track analytics event: {e}")

    def identify_user(self, user_id: str, properties: Dict[str, Any] = None):
        """
        Identify a user with safe properties (no PII).

        Args:
            user_id: User identifier
            properties: User properties (will be sanitized)
        """
        if not self.enabled or not self.posthog_client:
            return

        try:
            safe_properties = self._sanitize_properties(properties) if properties else {}

            self.posthog_client.identify(
                distinct_id=user_id,
                properties=safe_properties
            )

            logger.debug("User identified in analytics", extra={
                "user_id": user_id[:8] + "..." if user_id else None
            })
        except Exception as e:
            logger.error(f"Failed to identify user in analytics: {e}")

    def flush(self):
        """Flush any pending analytics events."""
        if self.enabled and self.posthog_client:
            try:
                self.posthog_client.flush()
            except Exception as e:
                logger.error(f"Failed to flush analytics: {e}")


# Global analytics manager instance
analytics = AnalyticsManager()


# Convenience functions for common events
def track_user_signup(user_id: str, signup_source: str = None, **kwargs):
    """Track user signup event."""
    properties = {
        'signup_source': signup_source,
        **kwargs
    }
    analytics.track_event("user_signed_up", user_id=user_id, properties=properties)


def track_profile_completion(user_id: str, completion_percentage: int, **kwargs):
    """Track profile completion milestone."""
    properties = {
        'completion_percentage': completion_percentage,
        **kwargs
    }
    analytics.track_event("profile_completed", user_id=user_id, properties=properties)


def track_match_generation(user_id: str, matches_count: int, **kwargs):
    """Track when matches are generated for a user."""
    properties = {
        'matches_count': matches_count,
        **kwargs
    }
    analytics.track_event("matches_generated", user_id=user_id, properties=properties)


def track_match_view(user_id: str, viewed_user_id: str, **kwargs):
    """Track when a user views a potential match."""
    properties = {
        'viewed_user_id': viewed_user_id,
        **kwargs
    }
    analytics.track_event("match_viewed", user_id=user_id, properties=properties)


def track_introduction_request(sender_id: str, recipient_id: str, **kwargs):
    """Track introduction request sent."""
    properties = {
        'recipient_id': recipient_id,
        **kwargs
    }
    analytics.track_event("introduction_requested", user_id=sender_id, properties=properties)


def track_introduction_response(user_id: str, response: str, **kwargs):
    """Track introduction response (accepted/declined)."""
    properties = {
        'response': response,
        **kwargs
    }
    analytics.track_event("introduction_responded", user_id=user_id, properties=properties)


def track_message_sent(sender_id: str, recipient_id: str, **kwargs):
    """Track message sent between users."""
    properties = {
        'recipient_id': recipient_id,
        **kwargs
    }
    analytics.track_event("message_sent", user_id=sender_id, properties=properties)


def track_resource_view(user_id: str, resource_id: str, resource_category: str = None, **kwargs):
    """Track resource view."""
    properties = {
        'resource_id': resource_id,
        'resource_category': resource_category,
        **kwargs
    }
    analytics.track_event("resource_viewed", user_id=user_id, properties=properties)


def track_resource_save(user_id: str, resource_id: str, **kwargs):
    """Track resource saved by user."""
    properties = {
        'resource_id': resource_id,
        **kwargs
    }
    analytics.track_event("resource_saved", user_id=user_id, properties=properties)


def track_event_rsvp(user_id: str, event_id: str, rsvp_status: str, **kwargs):
    """Track event RSVP."""
    properties = {
        'event_id': event_id,
        'rsvp_status': rsvp_status,
        **kwargs
    }
    analytics.track_event("event_rsvp", user_id=user_id, properties=properties)


def track_search_query(user_id: str, search_type: str, results_count: int = None, **kwargs):
    """Track search query."""
    properties = {
        'search_type': search_type,
        'results_count': results_count,
        **kwargs
    }
    analytics.track_event("search_performed", user_id=user_id, properties=properties)


def track_feature_usage(user_id: str, feature_name: str, **kwargs):
    """Track feature usage."""
    properties = {
        'feature_name': feature_name,
        **kwargs
    }
    analytics.track_event("feature_used", user_id=user_id, properties=properties)


def track_session_start(user_id: str, **kwargs):
    """Track session start."""
    analytics.track_event("session_started", user_id=user_id, properties=kwargs)


def track_session_end(user_id: str, session_duration: int = None, **kwargs):
    """Track session end."""
    properties = {
        'session_duration_seconds': session_duration,
        **kwargs
    }
    analytics.track_event("session_ended", user_id=user_id, properties=properties)


def track_page_view(user_id: str, page_name: str, **kwargs):
    """Track page view."""
    properties = {
        'page_name': page_name,
        **kwargs
    }
    analytics.track_event("page_viewed", user_id=user_id, properties=properties)


def track_api_usage(endpoint: str, method: str, status_code: int, response_time_ms: float = None, user_id: str = None, **kwargs):
    """Track API endpoint usage."""
    properties = {
        'endpoint': endpoint,
        'method': method,
        'status_code': status_code,
        'response_time_ms': response_time_ms,
        **kwargs
    }
    analytics.track_event("api_call", user_id=user_id, properties=properties)