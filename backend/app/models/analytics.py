"""
Analytics models for tracking platform metrics and user behavior.
Stores aggregated, non-PII data for admin dashboards.
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Date, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid

from app.database import Base


class AnalyticsEvent(Base):
    """
    Local storage for analytics events (aggregated data only, no PII).
    """
    __tablename__ = "analytics_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_name = Column(String(100), nullable=False, index=True)
    event_date = Column(Date, nullable=False, index=True)
    hour = Column(Integer, nullable=False)  # Hour of day (0-23)
    count = Column(Integer, nullable=False, default=0)
    properties = Column(JSONB, nullable=True)  # Aggregated, non-PII properties
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Indexes for performance
    __table_args__ = (
        Index('idx_analytics_events_date_name', 'event_date', 'event_name'),
        Index('idx_analytics_events_created_at', 'created_at'),
    )


class UserMetrics(Base):
    """
    Daily aggregated user metrics (no PII, just counts and percentages).
    """
    __tablename__ = "user_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, unique=True, index=True)

    # User counts
    total_users = Column(Integer, nullable=False, default=0)
    new_signups = Column(Integer, nullable=False, default=0)
    active_users_daily = Column(Integer, nullable=False, default=0)
    active_users_weekly = Column(Integer, nullable=False, default=0)
    active_users_monthly = Column(Integer, nullable=False, default=0)

    # Profile completion
    profiles_completed = Column(Integer, nullable=False, default=0)
    avg_profile_completion = Column(Float, nullable=True)

    # Engagement metrics
    total_sessions = Column(Integer, nullable=False, default=0)
    avg_session_duration_seconds = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class FeatureMetrics(Base):
    """
    Daily aggregated feature usage metrics.
    """
    __tablename__ = "feature_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, index=True)

    # Matching metrics
    matches_generated = Column(Integer, nullable=False, default=0)
    matches_viewed = Column(Integer, nullable=False, default=0)
    introduction_requests = Column(Integer, nullable=False, default=0)
    introduction_acceptances = Column(Integer, nullable=False, default=0)
    introduction_rejections = Column(Integer, nullable=False, default=0)

    # Messaging metrics
    messages_sent = Column(Integer, nullable=False, default=0)
    conversations_started = Column(Integer, nullable=False, default=0)

    # Resource metrics
    resources_viewed = Column(Integer, nullable=False, default=0)
    resources_saved = Column(Integer, nullable=False, default=0)

    # Event metrics
    events_viewed = Column(Integer, nullable=False, default=0)
    event_rsvps = Column(Integer, nullable=False, default=0)

    # Search metrics
    searches_performed = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Indexes
    __table_args__ = (
        Index('idx_feature_metrics_date', 'date'),
    )


class ConversionFunnel(Base):
    """
    Tracks conversion rates through key user journey steps.
    """
    __tablename__ = "conversion_funnel"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, index=True)

    # Signup funnel
    visitors = Column(Integer, nullable=False, default=0)  # Unique visitors
    signups = Column(Integer, nullable=False, default=0)
    signup_conversion_rate = Column(Float, nullable=True)

    # Profile completion funnel
    profile_starts = Column(Integer, nullable=False, default=0)
    profile_completions = Column(Integer, nullable=False, default=0)
    profile_completion_rate = Column(Float, nullable=True)

    # Matching funnel
    first_match_views = Column(Integer, nullable=False, default=0)
    intro_requests = Column(Integer, nullable=False, default=0)
    intro_request_rate = Column(Float, nullable=True)

    # Connection funnel
    connections_made = Column(Integer, nullable=False, default=0)
    first_messages = Column(Integer, nullable=False, default=0)
    conversation_start_rate = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class RetentionMetrics(Base):
    """
    User retention cohort analysis.
    """
    __tablename__ = "retention_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cohort_month = Column(Date, nullable=False, index=True)  # Month user signed up
    period = Column(Integer, nullable=False)  # Months since signup (0, 1, 2, etc.)

    # Cohort data
    cohort_size = Column(Integer, nullable=False, default=0)
    retained_users = Column(Integer, nullable=False, default=0)
    retention_rate = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Indexes
    __table_args__ = (
        Index('idx_retention_cohort_period', 'cohort_month', 'period'),
    )


class PerformanceMetrics(Base):
    """
    API performance and technical metrics.
    """
    __tablename__ = "performance_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, index=True)
    hour = Column(Integer, nullable=False)  # Hour of day (0-23)

    # API metrics
    total_requests = Column(Integer, nullable=False, default=0)
    successful_requests = Column(Integer, nullable=False, default=0)
    error_requests = Column(Integer, nullable=False, default=0)
    avg_response_time_ms = Column(Float, nullable=True)
    p95_response_time_ms = Column(Float, nullable=True)
    p99_response_time_ms = Column(Float, nullable=True)

    # Error rates by type
    error_4xx = Column(Integer, nullable=False, default=0)
    error_5xx = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Indexes
    __table_args__ = (
        Index('idx_performance_metrics_date_hour', 'date', 'hour'),
    )


class RevenueMetrics(Base):
    """
    Revenue and business metrics (if applicable).
    """
    __tablename__ = "revenue_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, unique=True, index=True)

    # Revenue data (if premium features exist)
    total_revenue = Column(Float, nullable=False, default=0.0)
    new_subscriptions = Column(Integer, nullable=False, default=0)
    cancelled_subscriptions = Column(Integer, nullable=False, default=0)
    active_subscriptions = Column(Integer, nullable=False, default=0)

    # Average values
    average_revenue_per_user = Column(Float, nullable=True)
    lifetime_value = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())