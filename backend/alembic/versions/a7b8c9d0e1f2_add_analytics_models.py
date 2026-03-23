"""add analytics models

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-23

Adds comprehensive analytics models for GDPR-compliant tracking:
- analytics_events: Aggregated event data (no PII)
- user_metrics: Daily user counts and engagement metrics
- feature_metrics: Daily feature usage statistics
- conversion_funnel: User journey conversion rates
- retention_metrics: Cohort retention analysis
- performance_metrics: API performance tracking
- revenue_metrics: Business metrics (if applicable)
"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create analytics_events table
    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_name", sa.String(length=100), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("hour", sa.Integer(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, default=0),
        sa.Column("properties", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create indexes for analytics_events
    op.create_index("idx_analytics_events_date_name", "analytics_events", ["event_date", "event_name"])
    op.create_index("idx_analytics_events_created_at", "analytics_events", ["created_at"])
    op.create_index(op.f("ix_analytics_events_event_name"), "analytics_events", ["event_name"])
    op.create_index(op.f("ix_analytics_events_event_date"), "analytics_events", ["event_date"])

    # Create user_metrics table
    op.create_table(
        "user_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False, unique=True),
        sa.Column("total_users", sa.Integer(), nullable=False, default=0),
        sa.Column("new_signups", sa.Integer(), nullable=False, default=0),
        sa.Column("active_users_daily", sa.Integer(), nullable=False, default=0),
        sa.Column("active_users_weekly", sa.Integer(), nullable=False, default=0),
        sa.Column("active_users_monthly", sa.Integer(), nullable=False, default=0),
        sa.Column("profiles_completed", sa.Integer(), nullable=False, default=0),
        sa.Column("avg_profile_completion", sa.Float(), nullable=True),
        sa.Column("total_sessions", sa.Integer(), nullable=False, default=0),
        sa.Column("avg_session_duration_seconds", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create index for user_metrics
    op.create_index(op.f("ix_user_metrics_date"), "user_metrics", ["date"])

    # Create feature_metrics table
    op.create_table(
        "feature_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("matches_generated", sa.Integer(), nullable=False, default=0),
        sa.Column("matches_viewed", sa.Integer(), nullable=False, default=0),
        sa.Column("introduction_requests", sa.Integer(), nullable=False, default=0),
        sa.Column("introduction_acceptances", sa.Integer(), nullable=False, default=0),
        sa.Column("introduction_rejections", sa.Integer(), nullable=False, default=0),
        sa.Column("messages_sent", sa.Integer(), nullable=False, default=0),
        sa.Column("conversations_started", sa.Integer(), nullable=False, default=0),
        sa.Column("resources_viewed", sa.Integer(), nullable=False, default=0),
        sa.Column("resources_saved", sa.Integer(), nullable=False, default=0),
        sa.Column("events_viewed", sa.Integer(), nullable=False, default=0),
        sa.Column("event_rsvps", sa.Integer(), nullable=False, default=0),
        sa.Column("searches_performed", sa.Integer(), nullable=False, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create index for feature_metrics
    op.create_index("idx_feature_metrics_date", "feature_metrics", ["date"])

    # Create conversion_funnel table
    op.create_table(
        "conversion_funnel",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("visitors", sa.Integer(), nullable=False, default=0),
        sa.Column("signups", sa.Integer(), nullable=False, default=0),
        sa.Column("signup_conversion_rate", sa.Float(), nullable=True),
        sa.Column("profile_starts", sa.Integer(), nullable=False, default=0),
        sa.Column("profile_completions", sa.Integer(), nullable=False, default=0),
        sa.Column("profile_completion_rate", sa.Float(), nullable=True),
        sa.Column("first_match_views", sa.Integer(), nullable=False, default=0),
        sa.Column("intro_requests", sa.Integer(), nullable=False, default=0),
        sa.Column("intro_request_rate", sa.Float(), nullable=True),
        sa.Column("connections_made", sa.Integer(), nullable=False, default=0),
        sa.Column("first_messages", sa.Integer(), nullable=False, default=0),
        sa.Column("conversation_start_rate", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create index for conversion_funnel
    op.create_index(op.f("ix_conversion_funnel_date"), "conversion_funnel", ["date"])

    # Create retention_metrics table
    op.create_table(
        "retention_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cohort_month", sa.Date(), nullable=False),
        sa.Column("period", sa.Integer(), nullable=False),
        sa.Column("cohort_size", sa.Integer(), nullable=False, default=0),
        sa.Column("retained_users", sa.Integer(), nullable=False, default=0),
        sa.Column("retention_rate", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create index for retention_metrics
    op.create_index("idx_retention_cohort_period", "retention_metrics", ["cohort_month", "period"])

    # Create performance_metrics table
    op.create_table(
        "performance_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("hour", sa.Integer(), nullable=False),
        sa.Column("total_requests", sa.Integer(), nullable=False, default=0),
        sa.Column("successful_requests", sa.Integer(), nullable=False, default=0),
        sa.Column("error_requests", sa.Integer(), nullable=False, default=0),
        sa.Column("avg_response_time_ms", sa.Float(), nullable=True),
        sa.Column("p95_response_time_ms", sa.Float(), nullable=True),
        sa.Column("p99_response_time_ms", sa.Float(), nullable=True),
        sa.Column("error_4xx", sa.Integer(), nullable=False, default=0),
        sa.Column("error_5xx", sa.Integer(), nullable=False, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create index for performance_metrics
    op.create_index("idx_performance_metrics_date_hour", "performance_metrics", ["date", "hour"])

    # Create revenue_metrics table
    op.create_table(
        "revenue_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False, unique=True),
        sa.Column("total_revenue", sa.Float(), nullable=False, default=0.0),
        sa.Column("new_subscriptions", sa.Integer(), nullable=False, default=0),
        sa.Column("cancelled_subscriptions", sa.Integer(), nullable=False, default=0),
        sa.Column("active_subscriptions", sa.Integer(), nullable=False, default=0),
        sa.Column("average_revenue_per_user", sa.Float(), nullable=True),
        sa.Column("lifetime_value", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Create index for revenue_metrics
    op.create_index(op.f("ix_revenue_metrics_date"), "revenue_metrics", ["date"])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("revenue_metrics")
    op.drop_table("performance_metrics")
    op.drop_table("retention_metrics")
    op.drop_table("conversion_funnel")
    op.drop_table("feature_metrics")
    op.drop_table("user_metrics")
    op.drop_table("analytics_events")