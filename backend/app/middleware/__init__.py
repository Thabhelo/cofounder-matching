"""
Middleware modules for the Co-Founder Matching Platform.

Contains analytics tracking, performance monitoring, and other cross-cutting concerns.
"""

from app.middleware.analytics import AnalyticsMiddleware

__all__ = ["AnalyticsMiddleware"]