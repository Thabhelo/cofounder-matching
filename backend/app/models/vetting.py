"""
User vetting and verification models for the cofounder matching platform.
These models implement a comprehensive trust score system, verification tracking,
and admin review queue functionality.
"""

import uuid
from enum import Enum
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, TIMESTAMP, Float,
    ForeignKey, Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.common import GUID


class VerificationType(str, Enum):
    """Types of verification available in the platform."""
    EMAIL = "email"
    DOMAIN = "domain"  # .edu, .gov, company domains
    GITHUB = "github"
    LINKEDIN = "linkedin"
    MANUAL = "manual"  # Admin manual verification


class VerificationStatus(str, Enum):
    """Status of a verification attempt."""
    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"
    EXPIRED = "expired"


class ReviewReason(str, Enum):
    """Reasons why a user might be flagged for admin review."""
    LOW_TRUST_SCORE = "low_trust_score"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    MULTIPLE_REPORTS = "multiple_reports"
    MANUAL_VERIFICATION_REQUEST = "manual_verification_request"
    PROFILE_INCOMPLETE = "profile_incomplete"
    AUTOMATED_FLAG = "automated_flag"


class ReviewStatus(str, Enum):
    """Status of admin review queue items."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"


class UserTrustScore(Base):
    """
    Trust score calculation and tracking for users (0-100 scale).
    This is the core of the vetting system, combining multiple factors
    to determine user trustworthiness.
    """
    __tablename__ = "user_trust_scores"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, unique=True)

    # Overall trust score (0-100)
    score = Column(Integer, nullable=False, default=0)

    # Individual factor scores (0-100 each)
    email_domain_score = Column(Integer, default=0)  # .edu, company domains
    github_activity_score = Column(Integer, default=0)  # API analysis
    linkedin_completeness_score = Column(Integer, default=0)  # Profile quality
    portfolio_quality_score = Column(Integer, default=0)  # Portfolio/work quality
    platform_tenure_score = Column(Integer, default=0)  # Time on platform
    engagement_score = Column(Integer, default=0)  # Platform engagement
    intro_acceptance_rate = Column(Float, default=0.0)  # Success rate
    report_penalty = Column(Integer, default=0)  # Negative reports

    # Detailed breakdown stored as JSON for flexibility
    score_factors = Column(JSONB, nullable=True)

    # Calculation metadata
    last_calculated = Column(TIMESTAMP(timezone=True), default=func.now())
    calculation_version = Column(String(10), default="1.0")  # For algorithm versioning

    # Audit trail
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="trust_score")

    # Constraints
    __table_args__ = (
        CheckConstraint('score >= 0 AND score <= 100', name='trust_score_range'),
        CheckConstraint('intro_acceptance_rate >= 0.0 AND intro_acceptance_rate <= 1.0',
                       name='acceptance_rate_range'),
        Index('idx_user_trust_score', 'user_id'),
        Index('idx_trust_score_value', 'score'),
        Index('idx_trust_score_calculated', 'last_calculated'),
    )

    def __repr__(self):
        return f"<UserTrustScore user_id={self.user_id} score={self.score}>"


class UserVerification(Base):
    """
    Track verification attempts and status for different verification types.
    Each user can have multiple verification records for different methods.
    """
    __tablename__ = "user_verifications"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False)

    # Verification details
    verification_type = Column(String(20), nullable=False)  # VerificationType enum
    status = Column(String(20), nullable=False, default=VerificationStatus.PENDING)

    # Verification data (flexible JSON structure)
    verification_data = Column(JSONB, nullable=True)  # Store API responses, tokens, etc.

    # Results and metadata
    verified_at = Column(TIMESTAMP(timezone=True), nullable=True)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)  # For time-limited verifications
    failure_reason = Column(Text, nullable=True)
    attempts = Column(Integer, default=1)

    # Admin override capability
    admin_verified = Column(Boolean, default=False)
    admin_id = Column(GUID, ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)

    # Audit trail
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="verifications")
    admin = relationship("User", foreign_keys=[admin_id])

    # Constraints
    __table_args__ = (
        Index('idx_user_verifications', 'user_id'),
        Index('idx_verification_type_status', 'verification_type', 'status'),
        Index('idx_verification_expires', 'expires_at'),
        # Prevent duplicate pending verifications of the same type
        Index('idx_unique_pending_verification', 'user_id', 'verification_type',
              unique=True, postgresql_where=status == VerificationStatus.PENDING),
    )

    def __repr__(self):
        return f"<UserVerification user_id={self.user_id} type={self.verification_type} status={self.status}>"


class UserQualityMetrics(Base):
    """
    Computed quality metrics for users, used in matching filters and trust score calculation.
    These metrics are calculated periodically and cached for performance.
    """
    __tablename__ = "user_quality_metrics"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False, unique=True)

    # Profile completeness (0-100)
    profile_completeness = Column(Integer, default=0)
    required_fields_complete = Column(Boolean, default=False)

    # Activity metrics (0-100)
    activity_score = Column(Integer, default=0)
    login_frequency_score = Column(Integer, default=0)
    profile_update_recency = Column(Integer, default=0)

    # Engagement metrics (0-100)
    message_response_rate = Column(Float, default=0.0)
    introduction_acceptance_rate = Column(Float, default=0.0)
    platform_interaction_score = Column(Integer, default=0)

    # Quality indicators
    has_portfolio = Column(Boolean, default=False)
    has_linkedin = Column(Boolean, default=False)
    has_github = Column(Boolean, default=False)
    has_video_intro = Column(Boolean, default=False)

    # Social proof metrics
    linkedin_connections = Column(Integer, nullable=True)
    github_followers = Column(Integer, nullable=True)
    github_public_repos = Column(Integer, nullable=True)

    # Risk indicators
    report_count = Column(Integer, default=0)
    suspicious_activity_flags = Column(Integer, default=0)

    # Detailed metrics (JSON for flexibility)
    detailed_metrics = Column(JSONB, nullable=True)

    # Calculation metadata
    last_calculated = Column(TIMESTAMP(timezone=True), default=func.now())
    calculation_version = Column(String(10), default="1.0")

    # Audit trail
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="quality_metrics")

    # Constraints
    __table_args__ = (
        CheckConstraint('profile_completeness >= 0 AND profile_completeness <= 100',
                       name='profile_completeness_range'),
        CheckConstraint('activity_score >= 0 AND activity_score <= 100',
                       name='activity_score_range'),
        CheckConstraint('message_response_rate >= 0.0 AND message_response_rate <= 1.0',
                       name='response_rate_range'),
        CheckConstraint('introduction_acceptance_rate >= 0.0 AND introduction_acceptance_rate <= 1.0',
                       name='intro_acceptance_range'),
        Index('idx_user_quality_metrics', 'user_id'),
        Index('idx_quality_profile_completeness', 'profile_completeness'),
        Index('idx_quality_activity_score', 'activity_score'),
        Index('idx_quality_last_calculated', 'last_calculated'),
    )

    def __repr__(self):
        return f"<UserQualityMetrics user_id={self.user_id} completeness={self.profile_completeness}%>"


class AdminReviewQueue(Base):
    """
    Admin review queue for users that need manual review or verification.
    Supports workflow management and audit trail.
    """
    __tablename__ = "admin_review_queue"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id"), nullable=False)

    # Review details
    reason = Column(String(50), nullable=False)  # ReviewReason enum
    status = Column(String(20), default=ReviewStatus.PENDING, nullable=False)
    priority = Column(Integer, default=3)  # 1=high, 2=medium, 3=low

    # Assignment and workflow
    assigned_admin_id = Column(GUID, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Review content and decisions
    description = Column(Text, nullable=True)  # Why flagged
    admin_notes = Column(Text, nullable=True)  # Admin's review notes
    decision_reason = Column(Text, nullable=True)  # Why approved/rejected

    # Actions taken
    actions_taken = Column(JSONB, nullable=True)  # List of actions performed

    # Context data (snapshot at time of flagging)
    user_context = Column(JSONB, nullable=True)  # User data at time of flagging

    # Resolution
    resolved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Auto-escalation
    escalated_at = Column(TIMESTAMP(timezone=True), nullable=True)
    escalation_reason = Column(Text, nullable=True)

    # Audit trail
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="review_queue_items")
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])

    # Constraints
    __table_args__ = (
        CheckConstraint('priority >= 1 AND priority <= 5', name='priority_range'),
        Index('idx_admin_queue_status', 'status'),
        Index('idx_admin_queue_priority', 'priority'),
        Index('idx_admin_queue_assigned', 'assigned_admin_id'),
        Index('idx_admin_queue_created', 'created_at'),
        Index('idx_admin_queue_user', 'user_id'),
        # Prevent duplicate pending reviews for same user/reason
        Index('idx_unique_pending_review', 'user_id', 'reason',
              unique=True, postgresql_where=status == ReviewStatus.PENDING),
    )

    def __repr__(self):
        return f"<AdminReviewQueue user_id={self.user_id} reason={self.reason} status={self.status}>"


# Add relationships to the User model (this would be added to user.py imports)
# These are defined here to avoid circular imports
def add_user_relationships():
    """
    Add relationships to the User model for vetting-related data.
    This function should be called after all models are defined.
    """
    from app.models.user import User

    # Add relationships
    User.trust_score = relationship("UserTrustScore", back_populates="user", uselist=False)
    User.verifications = relationship("UserVerification", foreign_keys="UserVerification.user_id",
                                    back_populates="user")
    User.quality_metrics = relationship("UserQualityMetrics", back_populates="user", uselist=False)
    User.review_queue_items = relationship("AdminReviewQueue", foreign_keys="AdminReviewQueue.user_id",
                                         back_populates="user")