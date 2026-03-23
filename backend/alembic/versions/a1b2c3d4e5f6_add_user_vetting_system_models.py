"""Add user vetting system models

Revision ID: b1c2d3e4f5a6
Revises: dafdf7dd01d2
Create Date: 2026-03-23 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'dafdf7dd01d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_trust_scores table
    op.create_table(
        'user_trust_scores',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False, default=0),
        sa.Column('email_domain_score', sa.Integer(), default=0),
        sa.Column('github_activity_score', sa.Integer(), default=0),
        sa.Column('linkedin_completeness_score', sa.Integer(), default=0),
        sa.Column('portfolio_quality_score', sa.Integer(), default=0),
        sa.Column('platform_tenure_score', sa.Integer(), default=0),
        sa.Column('engagement_score', sa.Integer(), default=0),
        sa.Column('intro_acceptance_rate', sa.Float(), default=0.0),
        sa.Column('report_penalty', sa.Integer(), default=0),
        sa.Column('score_factors', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('last_calculated', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('calculation_version', sa.String(10), default='1.0'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.CheckConstraint('score >= 0 AND score <= 100', name='trust_score_range'),
        sa.CheckConstraint(
            'intro_acceptance_rate >= 0.0 AND intro_acceptance_rate <= 1.0',
            name='acceptance_rate_range'
        ),
        sa.UniqueConstraint('user_id')
    )

    # Create indexes for user_trust_scores
    op.create_index('idx_user_trust_score', 'user_trust_scores', ['user_id'])
    op.create_index('idx_trust_score_value', 'user_trust_scores', ['score'])
    op.create_index('idx_trust_score_calculated', 'user_trust_scores', ['last_calculated'])

    # Create user_verifications table
    op.create_table(
        'user_verifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('verification_type', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='pending'),
        sa.Column('verification_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('verified_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('attempts', sa.Integer(), default=1),
        sa.Column('admin_verified', sa.Boolean(), default=False),
        sa.Column('admin_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'])
    )

    # Create indexes for user_verifications
    op.create_index('idx_user_verifications', 'user_verifications', ['user_id'])
    op.create_index('idx_verification_type_status', 'user_verifications', ['verification_type', 'status'])
    op.create_index('idx_verification_expires', 'user_verifications', ['expires_at'])

    # Create partial unique index for preventing duplicate pending verifications
    op.execute("""
        CREATE UNIQUE INDEX idx_unique_pending_verification
        ON user_verifications (user_id, verification_type)
        WHERE status = 'pending'
    """)

    # Create user_quality_metrics table
    op.create_table(
        'user_quality_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('profile_completeness', sa.Integer(), default=0),
        sa.Column('required_fields_complete', sa.Boolean(), default=False),
        sa.Column('activity_score', sa.Integer(), default=0),
        sa.Column('login_frequency_score', sa.Integer(), default=0),
        sa.Column('profile_update_recency', sa.Integer(), default=0),
        sa.Column('message_response_rate', sa.Float(), default=0.0),
        sa.Column('introduction_acceptance_rate', sa.Float(), default=0.0),
        sa.Column('platform_interaction_score', sa.Integer(), default=0),
        sa.Column('has_portfolio', sa.Boolean(), default=False),
        sa.Column('has_linkedin', sa.Boolean(), default=False),
        sa.Column('has_github', sa.Boolean(), default=False),
        sa.Column('has_video_intro', sa.Boolean(), default=False),
        sa.Column('linkedin_connections', sa.Integer(), nullable=True),
        sa.Column('github_followers', sa.Integer(), nullable=True),
        sa.Column('github_public_repos', sa.Integer(), nullable=True),
        sa.Column('report_count', sa.Integer(), default=0),
        sa.Column('suspicious_activity_flags', sa.Integer(), default=0),
        sa.Column('detailed_metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('last_calculated', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('calculation_version', sa.String(10), default='1.0'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.CheckConstraint(
            'profile_completeness >= 0 AND profile_completeness <= 100',
            name='profile_completeness_range'
        ),
        sa.CheckConstraint(
            'activity_score >= 0 AND activity_score <= 100',
            name='activity_score_range'
        ),
        sa.CheckConstraint(
            'message_response_rate >= 0.0 AND message_response_rate <= 1.0',
            name='response_rate_range'
        ),
        sa.CheckConstraint(
            'introduction_acceptance_rate >= 0.0 AND introduction_acceptance_rate <= 1.0',
            name='intro_acceptance_range'
        ),
        sa.UniqueConstraint('user_id')
    )

    # Create indexes for user_quality_metrics
    op.create_index('idx_user_quality_metrics', 'user_quality_metrics', ['user_id'])
    op.create_index('idx_quality_profile_completeness', 'user_quality_metrics', ['profile_completeness'])
    op.create_index('idx_quality_activity_score', 'user_quality_metrics', ['activity_score'])
    op.create_index('idx_quality_last_calculated', 'user_quality_metrics', ['last_calculated'])

    # Create admin_review_queue table
    op.create_table(
        'admin_review_queue',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), default='pending', nullable=False),
        sa.Column('priority', sa.Integer(), default=3),
        sa.Column('assigned_admin_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assigned_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('decision_reason', sa.Text(), nullable=True),
        sa.Column('actions_taken', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('user_context', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('resolved_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('escalated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('escalation_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['assigned_admin_id'], ['users.id']),
        sa.CheckConstraint('priority >= 1 AND priority <= 5', name='priority_range')
    )

    # Create indexes for admin_review_queue
    op.create_index('idx_admin_queue_status', 'admin_review_queue', ['status'])
    op.create_index('idx_admin_queue_priority', 'admin_review_queue', ['priority'])
    op.create_index('idx_admin_queue_assigned', 'admin_review_queue', ['assigned_admin_id'])
    op.create_index('idx_admin_queue_created', 'admin_review_queue', ['created_at'])
    op.create_index('idx_admin_queue_user', 'admin_review_queue', ['user_id'])

    # Create partial unique index for preventing duplicate pending reviews
    op.execute("""
        CREATE UNIQUE INDEX idx_unique_pending_review
        ON admin_review_queue (user_id, reason)
        WHERE status = 'pending'
    """)

    # Add comments to document the tables
    op.execute("""
        COMMENT ON TABLE user_trust_scores IS
        'Trust score calculation and tracking for users (0-100 scale)';
    """)

    op.execute("""
        COMMENT ON TABLE user_verifications IS
        'Track verification attempts and status for different verification types';
    """)

    op.execute("""
        COMMENT ON TABLE user_quality_metrics IS
        'Computed quality metrics for users, used in matching filters and trust score calculation';
    """)

    op.execute("""
        COMMENT ON TABLE admin_review_queue IS
        'Admin review queue for users that need manual review or verification';
    """)


def downgrade() -> None:
    # Drop tables in reverse order (due to foreign key dependencies)
    op.drop_table('admin_review_queue')
    op.drop_table('user_quality_metrics')
    op.drop_table('user_verifications')
    op.drop_table('user_trust_scores')