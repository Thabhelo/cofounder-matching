"""
Pydantic schemas for vetting system endpoints.
Defines request/response models for trust scores, verifications, and quality metrics.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum

from app.models.vetting import VerificationType


class VettingStatusLevel(str, Enum):
    """Overall vetting status levels."""
    EXCELLENT = "excellent"
    GOOD = "good"
    NEEDS_IMPROVEMENT = "needs_improvement"
    CRITICAL = "critical"


class ImpactLevel(str, Enum):
    """Impact level for improvement suggestions."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SuggestionCategory(str, Enum):
    """Categories for improvement suggestions."""
    PROFILE = "profile"
    VERIFICATION = "verification"
    TRUST = "trust"
    PROFESSIONAL = "professional"
    ACTIVITY = "activity"


class TrustScoreBreakdown(BaseModel):
    """Detailed breakdown of trust score factors."""
    overall_score: int = Field(..., ge=0, le=100)
    email_domain_score: int = Field(..., ge=0, le=100)
    github_activity_score: int = Field(..., ge=0, le=100)
    linkedin_completeness_score: int = Field(..., ge=0, le=100)
    portfolio_quality_score: int = Field(..., ge=0, le=100)
    platform_tenure_score: int = Field(..., ge=0, le=100)
    engagement_score: int = Field(..., ge=0, le=100)
    intro_acceptance_rate: float = Field(..., ge=0.0, le=1.0)
    report_penalty: int = Field(..., ge=0)
    last_calculated: datetime
    factors_breakdown: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class TrustScoreResponse(BaseModel):
    """Response model for trust score information."""
    overall_score: int = Field(..., ge=0, le=100)
    email_domain_score: int = Field(..., ge=0, le=100)
    github_activity_score: int = Field(..., ge=0, le=100)
    linkedin_completeness_score: int = Field(..., ge=0, le=100)
    portfolio_quality_score: int = Field(..., ge=0, le=100)
    platform_tenure_score: int = Field(..., ge=0, le=100)
    engagement_score: int = Field(..., ge=0, le=100)
    intro_acceptance_rate: float = Field(..., ge=0.0, le=1.0)
    report_penalty: int = Field(..., ge=0)
    last_calculated: datetime
    factors_breakdown: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class QualityMetricsResponse(BaseModel):
    """Response model for user quality metrics."""
    profile_completeness: int = Field(..., ge=0, le=100)
    required_fields_complete: bool
    activity_score: int = Field(..., ge=0, le=100)
    login_frequency_score: int = Field(..., ge=0, le=100)
    profile_update_recency: int = Field(..., ge=0, le=100)
    message_response_rate: float = Field(..., ge=0.0, le=1.0)
    introduction_acceptance_rate: float = Field(..., ge=0.0, le=1.0)
    platform_interaction_score: int = Field(..., ge=0, le=100)

    # Quality indicators
    has_portfolio: bool
    has_linkedin: bool
    has_github: bool
    has_video_intro: bool

    # Social proof metrics
    linkedin_connections: Optional[int] = None
    github_followers: Optional[int] = None
    github_public_repos: Optional[int] = None

    # Risk indicators
    report_count: int = Field(..., ge=0)
    suspicious_activity_flags: int = Field(..., ge=0)

    # Metadata
    detailed_metrics: Dict[str, Any] = Field(default_factory=dict)
    last_calculated: datetime
    calculation_version: str

    class Config:
        from_attributes = True


class VerificationRequest(BaseModel):
    """Request model for starting verification."""
    verification_type: VerificationType
    additional_data: Optional[Dict[str, Any]] = Field(default_factory=dict)


class VerificationResponse(BaseModel):
    """Response model for verification process."""
    id: UUID
    verification_type: str
    status: str
    verification_data: Optional[Dict[str, Any]] = None
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    attempts: int
    created_at: datetime

    class Config:
        from_attributes = True


class VerificationStatusResponse(BaseModel):
    """Response model for verification status."""
    id: UUID
    verification_type: str
    status: str
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    attempts: int
    admin_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImprovementSuggestion(BaseModel):
    """Individual improvement suggestion for users."""
    category: SuggestionCategory
    title: str = Field(..., max_length=100)
    description: str = Field(..., max_length=500)
    impact: ImpactLevel
    estimated_points: int = Field(..., ge=0, le=50)
    action_url: Optional[str] = None
    is_required: bool = False
    deadline: Optional[datetime] = None

    @validator('title')
    def validate_title(cls, v):
        if len(v.strip()) < 5:
            raise ValueError('Title must be at least 5 characters long')
        return v.strip()


class VettingStatusResponse(BaseModel):
    """Comprehensive vetting status response."""
    user_id: UUID
    overall_status: VettingStatusLevel
    trust_score: int = Field(..., ge=0, le=100)
    profile_completeness: int = Field(..., ge=0, le=100)

    # Eligibility flags
    can_appear_in_matches: bool
    can_send_intro_requests: bool

    # Verification status
    verification_badges: Dict[str, bool] = Field(default_factory=dict)

    # Detailed information
    quality_summary: Optional[Dict[str, Any]] = None
    trust_score_breakdown: Optional[TrustScoreBreakdown] = None
    improvement_suggestions: List[ImprovementSuggestion] = Field(default_factory=list)

    # Metadata
    last_updated: datetime

    class Config:
        from_attributes = True
        use_enum_values = True


class UserQualityDashboard(BaseModel):
    """Comprehensive quality dashboard for users."""
    overall_progress: float = Field(..., ge=0.0, le=100.0, description="Overall progress percentage")
    trust_score: int = Field(..., ge=0, le=100)
    profile_completeness: int = Field(..., ge=0, le=100)

    # Status indicators
    verification_badges: Dict[str, bool] = Field(default_factory=dict)
    completion_status: Dict[str, int] = Field(default_factory=dict)  # Different area completion percentages

    # Trends and history
    score_trend: List[Dict[str, Any]] = Field(default_factory=list)  # Historical score data

    # Actionable insights
    improvement_suggestions: List[ImprovementSuggestion] = Field(default_factory=list)

    # Platform access
    can_appear_in_matches: bool
    can_send_intro_requests: bool

    # Next milestone
    next_milestone: Optional[Dict[str, Any]] = None

    # Metadata
    last_updated: datetime

    class Config:
        use_enum_values = True


class VerificationBadges(BaseModel):
    """User verification badges status."""
    email: bool = False
    domain: bool = False
    github: bool = False
    linkedin: bool = False
    manual: bool = False

    @property
    def total_verified(self) -> int:
        """Count of verified badges."""
        return sum([self.email, self.domain, self.github, self.linkedin, self.manual])

    @property
    def verification_percentage(self) -> float:
        """Percentage of possible verifications completed."""
        return (self.total_verified / 5) * 100


class TrustScoreHistory(BaseModel):
    """Historical trust score data."""
    user_id: UUID
    score_history: List[Dict[str, Any]] = Field(default_factory=list)
    trend_direction: str = Field(..., pattern="^(up|down|stable)$")
    trend_percentage: float
    best_score: int
    worst_score: int
    average_score: float
    date_range: Dict[str, datetime]

    class Config:
        from_attributes = True


class QualityInsights(BaseModel):
    """Quality insights and recommendations."""
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)
    threats: List[str] = Field(default_factory=list)
    priority_actions: List[ImprovementSuggestion] = Field(default_factory=list)

    # Benchmarking
    percentile_ranking: Optional[int] = Field(None, ge=1, le=100)
    compared_to_cohort: Optional[str] = None  # e.g., "similar users in your industry"

    class Config:
        use_enum_values = True


class VettingSystemHealth(BaseModel):
    """System-wide vetting health metrics."""
    total_users: int
    users_with_trust_scores: int
    users_with_quality_metrics: int
    average_trust_score: float
    average_profile_completeness: float

    # Distribution metrics
    trust_score_distribution: Dict[str, int] = Field(default_factory=dict)
    verification_success_rates: Dict[str, float] = Field(default_factory=dict)

    # Quality indicators
    flagged_users_percentage: float
    banned_users_percentage: float
    highly_trusted_users_percentage: float

    # Trends
    score_trend_30_days: str = Field(..., pattern="^(improving|declining|stable)$")
    new_user_quality_trend: str = Field(..., pattern="^(improving|declining|stable)$")

    # System performance
    average_verification_time_hours: float
    pending_verifications: int
    admin_review_backlog: int

    generated_at: datetime

    class Config:
        use_enum_values = True


class VettingConfiguration(BaseModel):
    """Vetting system configuration options."""
    min_trust_score_for_matches: int = Field(15, ge=0, le=100)
    min_trust_score_for_intros: int = Field(20, ge=0, le=100)
    min_profile_completeness: int = Field(50, ge=0, le=100)
    require_email_verification: bool = True
    auto_flag_threshold: int = Field(3, ge=1, le=10)
    auto_ban_threshold: int = Field(7, ge=1, le=20)

    # Rate limiting
    max_intro_requests_per_day: int = Field(5, ge=1, le=50)
    max_intro_requests_per_week: int = Field(20, ge=1, le=100)

    # Verification settings
    email_verification_expires_hours: int = Field(24, ge=1, le=168)
    manual_verification_expires_days: int = Field(7, ge=1, le=30)

    class Config:
        validate_assignment = True


class BulkVettingOperation(BaseModel):
    """Bulk operation on multiple users."""
    user_ids: List[UUID] = Field(..., max_items=100)
    operation: str = Field(..., pattern="^(recalculate_trust|update_metrics|verify_domain|flag_review)$")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    batch_size: int = Field(10, ge=1, le=50)
    notify_admins: bool = False

    @validator('user_ids')
    def validate_user_ids(cls, v):
        if len(v) == 0:
            raise ValueError('At least one user ID must be provided')
        if len(set(v)) != len(v):
            raise ValueError('Duplicate user IDs are not allowed')
        return v


class BulkVettingResult(BaseModel):
    """Result of bulk vetting operation."""
    operation: str
    total_requested: int
    successful: int
    failed: int
    results: List[Dict[str, Any]] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    started_at: datetime
    completed_at: datetime
    duration_seconds: float

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage."""
        if self.total_requested == 0:
            return 0.0
        return (self.successful / self.total_requested) * 100


# Request/Response models for specific endpoints

class TrustScoreRecalculationRequest(BaseModel):
    """Request for trust score recalculation."""
    force_update: bool = False
    update_dependencies: bool = True  # Also update quality metrics
    reason: Optional[str] = Field(None, max_length=200)


class VerificationCompletionRequest(BaseModel):
    """Request for completing verification."""
    token: Optional[str] = None
    verification_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    admin_override: bool = False
    admin_notes: Optional[str] = Field(None, max_length=500)


class QualityMetricsUpdate(BaseModel):
    """Request for updating quality metrics."""
    recalculate_trust_score: bool = True
    update_verification_status: bool = True
    reason: Optional[str] = Field(None, max_length=200)


class VettingAlert(BaseModel):
    """Vetting system alert."""
    id: UUID
    alert_type: str = Field(..., pattern="^(low_trust|suspicious_activity|verification_failure|system_health)$")
    severity: str = Field(..., pattern="^(low|medium|high|critical)$")
    title: str
    description: str
    user_id: Optional[UUID] = None
    user_context: Optional[Dict[str, Any]] = None
    resolution_required: bool
    auto_resolvable: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class VettingReport(BaseModel):
    """Comprehensive vetting system report."""
    report_type: str = Field(..., pattern="^(daily|weekly|monthly|custom)$")
    date_range: Dict[str, datetime]

    # Summary metrics
    total_users_processed: int
    trust_scores_calculated: int
    verifications_completed: int
    quality_metrics_updated: int

    # Quality trends
    average_trust_score_change: float
    profile_completeness_trend: float
    verification_success_rate: float

    # System performance
    processing_time_metrics: Dict[str, float]
    error_rates: Dict[str, float]

    # Insights and recommendations
    key_insights: List[str]
    recommendations: List[str]
    alerts_generated: int

    generated_by: str
    generated_at: datetime

    class Config:
        use_enum_values = True