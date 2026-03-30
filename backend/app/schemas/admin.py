"""
Pydantic schemas for admin endpoints.
Defines request/response models for the admin review queue system.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from uuid import UUID
from enum import Enum

from app.models.vetting import ReviewReason, ReviewStatus


class ReviewActionType(str, Enum):
    """Valid admin actions on review items."""
    APPROVE = "approve"
    REJECT = "reject"
    ESCALATE = "escalate"
    BAN = "ban"
    SUSPEND = "suspend"
    REQUIRE_REVERIFICATION = "require_reverification"
    RECALCULATE_METRICS = "recalculate_metrics"


class ReviewActionRequest(BaseModel):
    """Request model for taking action on a review item."""
    action: ReviewActionType
    admin_notes: Optional[str] = Field(None, max_length=1000)
    decision_reason: Optional[str] = Field(None, max_length=500)
    notify_user: bool = Field(default=False, description="Send notification to user")

    @validator('admin_notes')
    def validate_admin_notes(cls, v, values):
        if values.get('action') in [ReviewActionType.REJECT, ReviewActionType.BAN] and not v:
            raise ValueError('Admin notes required for rejection or ban actions')
        return v


class ReviewActionResponse(BaseModel):
    """Response model for review actions."""
    success: bool
    actions_taken: List[str]
    message: str
    review_status: Optional[str] = None
    user_status: Optional[Dict[str, Any]] = None


class BulkReviewActionRequest(BaseModel):
    """Request model for bulk actions on review items."""
    review_ids: List[str] = Field(..., max_items=50, min_items=1)
    action: ReviewActionType
    admin_notes: Optional[str] = Field(None, max_length=1000)
    decision_reason: Optional[str] = Field(None, max_length=500)
    notify_user: bool = Field(default=False)


class BulkReviewActionResponse(BaseModel):
    """Response model for bulk review actions."""
    processed_count: int
    success_count: int
    error_count: int
    results: List[Dict[str, Any]]
    message: str


class UserVerificationSummary(BaseModel):
    """Summary of user verification status."""
    id: str
    type: str
    status: str
    verified_at: Optional[datetime] = None
    failure_reason: Optional[str] = None


class UserReportSummary(BaseModel):
    """Summary of user report."""
    id: str
    reporter_name: str
    reason: str
    description: Optional[str] = None
    created_at: datetime
    status: str


class AdminReviewQueueResponse(BaseModel):
    """Detailed response model for review queue items."""
    id: UUID
    user_id: UUID
    user_name: str
    user_email: str
    reason: str
    status: str
    priority: int
    description: Optional[str] = None
    admin_notes: Optional[str] = None
    decision_reason: Optional[str] = None
    actions_taken: Optional[List[str]] = None
    user_context: Optional[Dict[str, Any]] = None

    # Assignment info
    assigned_admin_id: Optional[UUID] = None
    assigned_admin_name: Optional[str] = None
    assigned_at: Optional[datetime] = None

    # Resolution info
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None

    # Escalation info
    escalated_at: Optional[datetime] = None
    escalation_reason: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    # Additional enrichment data
    user_quality_summary: Optional[Dict[str, Any]] = None
    user_verifications: Optional[List[Dict[str, Any]]] = None
    user_reports: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True


class AdminReviewQueueListResponse(BaseModel):
    """Paginated list response for review queue."""
    items: List[AdminReviewQueueResponse]
    total_count: int
    page_size: int
    current_page: int
    total_pages: int


class AdminDashboardStats(BaseModel):
    """Admin dashboard statistics."""
    queue_stats: Dict[str, int] = Field(..., description="Queue statistics")
    reason_breakdown: Dict[str, int] = Field(..., description="Breakdown by reason")
    activity_stats: Dict[str, Union[int, float]] = Field(..., description="Activity statistics")
    system_health: Dict[str, int] = Field(..., description="System health indicators")
    generated_at: datetime


class AdminUserSummary(BaseModel):
    """Summary of user for admin purposes."""
    id: UUID
    name: str
    email: str
    is_active: bool
    is_banned: bool
    profile_completeness: int
    trust_score: int
    report_count: int
    verification_badges: Dict[str, bool]
    account_age_days: int
    created_at: datetime
    updated_at: datetime


class AdminReviewItemCreate(BaseModel):
    """Request model for creating review items."""
    user_id: UUID
    reason: ReviewReason
    priority: int = Field(default=3, ge=1, le=5)
    description: Optional[str] = Field(None, max_length=1000)
    user_context: Optional[Dict[str, Any]] = None


class AdminReviewItemUpdate(BaseModel):
    """Request model for updating review items."""
    status: Optional[ReviewStatus] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    admin_notes: Optional[str] = Field(None, max_length=1000)
    escalation_reason: Optional[str] = Field(None, max_length=500)


class AdminActionAuditEntry(BaseModel):
    """Admin action audit entry."""
    id: UUID
    admin_id: UUID
    admin_name: str
    action: str
    target_type: str
    target_id: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminStatsFilter(BaseModel):
    """Filter parameters for admin statistics."""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    admin_id: Optional[UUID] = None
    action_type: Optional[str] = None


class UserModerationHistory(BaseModel):
    """User's complete moderation history."""
    user_id: UUID
    review_items: List[AdminReviewQueueResponse]
    admin_actions: List[AdminActionAuditEntry]
    reports_received: List[UserReportSummary]
    ban_history: List[Dict[str, Any]]
    suspension_history: List[Dict[str, Any]]
    trust_score_history: List[Dict[str, Any]]


class AdminNotificationSettings(BaseModel):
    """Admin notification preferences."""
    email_on_high_priority: bool = True
    email_on_escalation: bool = True
    email_on_assignment: bool = False
    daily_summary: bool = True
    notification_types: List[str] = []


class QueueMetrics(BaseModel):
    """Queue performance metrics."""
    avg_resolution_time_hours: float
    median_resolution_time_hours: float
    total_resolved_today: int
    total_resolved_week: int
    resolution_rate_percentage: float
    escalation_rate_percentage: float
    backlog_age_distribution: Dict[str, int]  # "0-24h", "1-3d", "3-7d", "7d+"


class AdminPerformanceStats(BaseModel):
    """Individual admin performance statistics."""
    admin_id: UUID
    admin_name: str
    items_resolved: int
    avg_resolution_time_hours: float
    escalation_rate: float
    user_satisfaction_score: Optional[float] = None
    specialization_areas: List[str]  # Most common review reasons handled
    active_period: Dict[str, datetime]  # start/end dates


class SystemHealthMetrics(BaseModel):
    """Overall system health indicators."""
    queue_health: Dict[str, Any]
    user_quality_trends: Dict[str, Any]
    moderation_effectiveness: Dict[str, Any]
    false_positive_rate: float
    user_appeal_success_rate: float
    automated_vs_manual_actions: Dict[str, int]


class AdminReviewFilters(BaseModel):
    """Advanced filtering options for review queue."""
    status: Optional[List[ReviewStatus]] = None
    reason: Optional[List[ReviewReason]] = None
    priority_min: Optional[int] = Field(None, ge=1, le=5)
    priority_max: Optional[int] = Field(None, ge=1, le=5)
    assigned_admin_id: Optional[UUID] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    user_trust_score_min: Optional[int] = Field(None, ge=0, le=100)
    user_trust_score_max: Optional[int] = Field(None, ge=0, le=100)
    user_report_count_min: Optional[int] = Field(None, ge=0)
    has_verifications: Optional[bool] = None
    keywords: Optional[str] = Field(None, max_length=200)

    class Config:
        use_enum_values = True


class ReviewQueueExportRequest(BaseModel):
    """Request for exporting review queue data."""
    format: str = Field("csv", pattern="^(csv|json|xlsx)$")
    filters: Optional[AdminReviewFilters] = None
    include_user_details: bool = False
    include_quality_metrics: bool = False
    date_range_days: int = Field(30, ge=1, le=365)


class AdminWebhookConfig(BaseModel):
    """Configuration for admin webhooks."""
    webhook_url: str = Field(..., pattern=r"^https?://.*")
    events: List[str]  # Which events to send
    secret_token: Optional[str] = None
    enabled: bool = True
    retry_attempts: int = Field(3, ge=1, le=10)


class ReviewEscalationRule(BaseModel):
    """Automatic escalation rule configuration."""
    condition: Dict[str, Any]  # JSON condition (e.g., {"reason": "multiple_reports", "age_hours": 24})
    action: str  # escalate, assign_to, increase_priority
    target_admin_id: Optional[UUID] = None
    priority_change: Optional[int] = Field(None, ge=-4, le=4)
    notification_message: Optional[str] = None
    enabled: bool = True


class BulkUserAction(BaseModel):
    """Bulk action on multiple users."""
    user_ids: List[UUID] = Field(..., max_items=100)
    action: str = Field(..., pattern="^(ban|suspend|activate|recalculate_trust|require_reverification)$")
    reason: str = Field(..., max_length=500)
    notify_users: bool = False
    batch_size: int = Field(10, ge=1, le=50)


# Response models for specific endpoints

class QueueStatsResponse(BaseModel):
    """Response for queue statistics endpoint."""
    current_stats: AdminDashboardStats
    historical_trends: Dict[str, List[Dict[str, Any]]]
    comparative_metrics: Dict[str, float]
    recommendations: List[str]


class AdminActivityResponse(BaseModel):
    """Response for admin activity tracking."""
    admin_id: UUID
    recent_actions: List[AdminActionAuditEntry]
    performance_metrics: AdminPerformanceStats
    workload_distribution: Dict[str, int]
    time_distribution: Dict[str, float]  # Hours spent on different activities


class UserRiskAssessment(BaseModel):
    """Risk assessment for a specific user."""
    user_id: UUID
    risk_level: str = Field(..., pattern="^(low|medium|high|critical)$")
    risk_factors: List[Dict[str, Any]]
    recommended_actions: List[str]
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    assessment_date: datetime
    next_review_date: Optional[datetime] = None


class PlatformHealthReport(BaseModel):
    """Comprehensive platform health report."""
    report_date: datetime
    overall_health_score: float = Field(..., ge=0.0, le=100.0)
    queue_metrics: QueueMetrics
    system_metrics: SystemHealthMetrics
    trend_analysis: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    executive_summary: str