"""
Analytics middleware for automatic API usage tracking.
Captures response times, status codes, and endpoint usage.
"""

import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.analytics import track_api_usage

logger = logging.getLogger(__name__)


class AnalyticsMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically track API usage analytics.

    Captures:
    - Endpoint access patterns
    - Response times
    - HTTP status codes
    - Error rates
    """

    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)

        start_time = time.time()

        # Extract user ID if available
        user_id = None
        if hasattr(request.state, "user") and request.state.user:
            user_id = str(request.state.user.id)

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            # Log the exception but don't break the request
            logger.error(f"Request failed: {e}")
            status_code = 500
            raise
        finally:
            # Calculate response time
            response_time_ms = (time.time() - start_time) * 1000

            # Track the API usage
            try:
                track_api_usage(
                    endpoint=request.url.path,
                    method=request.method,
                    status_code=status_code,
                    response_time_ms=response_time_ms,
                    user_id=user_id,
                    user_agent=request.headers.get("user-agent"),
                    ip_address=request.client.host if request.client else None,
                )
            except Exception as e:
                # Don't break requests if analytics fails
                logger.error(f"Analytics tracking failed: {e}")

        return response