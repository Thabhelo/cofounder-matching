"""
Comprehensive Vetting System API

Unified API endpoints for user vetting, trust scores, verifications, and quality metrics.
Provides both user-facing and admin-facing endpoints for complete vetting functionality.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict, Any
from datetime import datetime
import uuid

from app.database import get_db
from app.models import (
    User, UserTrustScore, UserVerification, UserQualityMetrics,
    VerificationType, VerificationStatus
)
from app.api.deps import get_current_user
from app.api.deps_admin import get_current_admin_user
from app.schemas.vetting import (
    TrustScoreResponse, TrustScoreBreakdown,
    VerificationResponse, VerificationStatusResponse,
    QualityMetricsResponse, UserQualityDashboard,
    VettingStatusResponse, ImprovementSuggestion
)
from app.services.trust_score import (
    recalculate_user_trust_score
)
from app.services.quality_metrics import (
    update_user_quality_metrics
)
from app.services.verification import verification_service
from app.services.matching_filters import matching_quality_filter
from app.services.background_jobs import (
    trigger_trust_score_recalculation,
    trigger_quality_metrics_update,
    trigger_user_trust_score_update
)
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


# User-facing endpoints
@router.get("/me", response_model=VettingStatusResponse)
async def get_my_vetting_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive vetting status for the current user.
    Shows trust score, quality metrics, verification status, and improvement suggestions.
    """
    try:
        # Get comprehensive quality summary
        quality_summary = await matching_quality_filter.get_user_quality_summary(
            current_user, db, update_metrics=True
        )

        # Get verification status
        # Get verification badges
        verification_badges = await verification_service.get_verification_badge_info(
            str(current_user.id), db
        )

        # Generate improvement suggestions
        suggestions = await _generate_improvement_suggestions(
            current_user, quality_summary, verification_badges, db
        )

        # Get trust score breakdown
        trust_score_data = db.query(UserTrustScore).filter(
            UserTrustScore.user_id == current_user.id
        ).first()

        trust_score_breakdown = None
        if trust_score_data and trust_score_data.score_factors:
            trust_score_breakdown = TrustScoreBreakdown(
                overall_score=trust_score_data.score,
                email_domain_score=trust_score_data.email_domain_score,
                github_activity_score=trust_score_data.github_activity_score,
                linkedin_completeness_score=trust_score_data.linkedin_completeness_score,
                portfolio_quality_score=trust_score_data.portfolio_quality_score,
                platform_tenure_score=trust_score_data.platform_tenure_score,
                engagement_score=trust_score_data.engagement_score,
                intro_acceptance_rate=trust_score_data.intro_acceptance_rate,
                report_penalty=trust_score_data.report_penalty,
                last_calculated=trust_score_data.last_calculated,
                factors_breakdown=trust_score_data.score_factors
            )

        return VettingStatusResponse(
            user_id=current_user.id,
            overall_status="good" if quality_summary.get("can_appear_in_matches") else "needs_improvement",
            trust_score=quality_summary.get("trust_score", 0),
            profile_completeness=quality_summary.get("profile_completeness", 0),
            can_appear_in_matches=quality_summary.get("can_appear_in_matches", False),
            can_send_intro_requests=quality_summary.get("can_send_intro_requests", False),
            verification_badges=verification_badges,
            quality_summary=quality_summary,
            trust_score_breakdown=trust_score_breakdown,
            improvement_suggestions=suggestions,
            last_updated=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Error getting vetting status for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving vetting status"
        )


@router.get("/trust-score", response_model=TrustScoreResponse)
async def get_my_trust_score(
    recalculate: bool = Query(False, description="Force recalculation of trust score"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed trust score information for the current user."""
    try:
        if recalculate:
            # Trigger recalculation in background
            trust_score_data = await recalculate_user_trust_score(str(current_user.id))
        else:
            # Get existing trust score
            trust_score_data = db.query(UserTrustScore).filter(
                UserTrustScore.user_id == current_user.id
            ).first()

        if not trust_score_data:
            # No trust score exists, calculate it
            trust_score_data = await recalculate_user_trust_score(str(current_user.id))

        if not trust_score_data:
            return TrustScoreResponse(
                overall_score=0,
                email_domain_score=0,
                github_activity_score=0,
                linkedin_completeness_score=0,
                portfolio_quality_score=0,
                platform_tenure_score=0,
                engagement_score=0,
                intro_acceptance_rate=0.0,
                report_penalty=0,
                last_calculated=datetime.utcnow(),
                factors_breakdown={}
            )

        return TrustScoreResponse(
            overall_score=trust_score_data.score,
            email_domain_score=trust_score_data.email_domain_score,
            github_activity_score=trust_score_data.github_activity_score,
            linkedin_completeness_score=trust_score_data.linkedin_completeness_score,
            portfolio_quality_score=trust_score_data.portfolio_quality_score,
            platform_tenure_score=trust_score_data.platform_tenure_score,
            engagement_score=trust_score_data.engagement_score,
            intro_acceptance_rate=trust_score_data.intro_acceptance_rate,
            report_penalty=trust_score_data.report_penalty,
            last_calculated=trust_score_data.last_calculated,
            factors_breakdown=trust_score_data.score_factors or {}
        )

    except Exception as e:
        logger.error(f"Error getting trust score for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving trust score"
        )


@router.get("/quality-metrics", response_model=QualityMetricsResponse)
async def get_my_quality_metrics(
    recalculate: bool = Query(False, description="Force recalculation of quality metrics"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed quality metrics for the current user."""
    try:
        if recalculate:
            # Trigger recalculation
            metrics_data = await update_user_quality_metrics(str(current_user.id))
        else:
            # Get existing metrics
            metrics_data = db.query(UserQualityMetrics).filter(
                UserQualityMetrics.user_id == current_user.id
            ).first()

        if not metrics_data:
            # No metrics exist, calculate them
            metrics_data = await update_user_quality_metrics(str(current_user.id))

        if not metrics_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Unable to calculate quality metrics"
            )

        return QualityMetricsResponse(
            profile_completeness=metrics_data.profile_completeness,
            required_fields_complete=metrics_data.required_fields_complete,
            activity_score=metrics_data.activity_score,
            login_frequency_score=metrics_data.login_frequency_score,
            profile_update_recency=metrics_data.profile_update_recency,
            message_response_rate=metrics_data.message_response_rate,
            introduction_acceptance_rate=metrics_data.introduction_acceptance_rate,
            platform_interaction_score=metrics_data.platform_interaction_score,
            has_portfolio=metrics_data.has_portfolio,
            has_linkedin=metrics_data.has_linkedin,
            has_github=metrics_data.has_github,
            has_video_intro=metrics_data.has_video_intro,
            linkedin_connections=metrics_data.linkedin_connections,
            github_followers=metrics_data.github_followers,
            github_public_repos=metrics_data.github_public_repos,
            report_count=metrics_data.report_count,
            suspicious_activity_flags=metrics_data.suspicious_activity_flags,
            detailed_metrics=metrics_data.detailed_metrics or {},
            last_calculated=metrics_data.last_calculated,
            calculation_version=metrics_data.calculation_version
        )

    except Exception as e:
        logger.error(f"Error getting quality metrics for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving quality metrics"
        )


@router.post("/verify/{verification_type}", response_model=VerificationResponse)
async def start_verification(
    verification_type: VerificationType,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a verification process for the specified type."""
    try:
        verification = await verification_service.start_verification(
            current_user, verification_type, db
        )

        return VerificationResponse(
            id=verification.id,
            verification_type=verification.verification_type,
            status=verification.status,
            verification_data=verification.verification_data,
            verified_at=verification.verified_at,
            expires_at=verification.expires_at,
            failure_reason=verification.failure_reason,
            attempts=verification.attempts,
            created_at=verification.created_at
        )

    except Exception as e:
        logger.error(f"Error starting verification for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error starting {verification_type.value} verification"
        )


@router.get("/verifications", response_model=List[VerificationStatusResponse])
async def get_my_verifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all verification attempts for the current user."""
    try:
        verifications = await verification_service.get_user_verifications(
            str(current_user.id), db
        )

        return [
            VerificationStatusResponse(
                id=v.id,
                verification_type=v.verification_type,
                status=v.status,
                verified_at=v.verified_at,
                expires_at=v.expires_at,
                failure_reason=v.failure_reason,
                attempts=v.attempts,
                admin_verified=v.admin_verified,
                created_at=v.created_at,
                updated_at=v.updated_at
            )
            for v in verifications
        ]

    except Exception as e:
        logger.error(f"Error getting verifications for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving verifications"
        )


@router.post("/verify/{verification_type}/complete", response_model=dict)
async def complete_verification(
    verification_type: VerificationType,
    token: str = Query(..., description="Verification token (for email verification)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Complete a verification process (e.g., email verification via token)."""
    try:
        if verification_type == VerificationType.EMAIL:
            from app.services.verification import EmailVerificationHandler
            handler = EmailVerificationHandler()
            result = await handler.complete_email_verification(token)

            if result.success:
                # Find and update the verification record
                verification = db.query(UserVerification).filter(
                    UserVerification.user_id == current_user.id,
                    UserVerification.verification_type == verification_type.value,
                    UserVerification.status == VerificationStatus.PENDING.value
                ).first()

                if verification:
                    verification.status = result.status.value
                    verification.verified_at = datetime.utcnow() if result.success else None
                    verification.verification_data = result.data
                    verification.updated_at = datetime.utcnow()
                    db.commit()

                return {
                    "success": True,
                    "message": "Email verification completed successfully",
                    "verification_type": verification_type.value
                }
            else:
                return {
                    "success": False,
                    "message": result.error_message,
                    "verification_type": verification_type.value
                }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Manual completion not supported for {verification_type.value}"
            )

    except Exception as e:
        logger.error(f"Error completing verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error completing verification"
        )


@router.get("/dashboard", response_model=UserQualityDashboard)
async def get_quality_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive quality dashboard for the current user.
    Shows progress, improvement areas, and actionable insights.
    """
    try:
        # Get comprehensive status
        vetting_status = await get_my_vetting_status(current_user, db)

        # Calculate progress metrics
        total_possible_score = 100
        current_score = vetting_status.trust_score
        progress_percentage = (current_score / total_possible_score) * 100

        # Get recent score history (if available)
        score_history = db.query(UserTrustScore).filter(
            UserTrustScore.user_id == current_user.id
        ).order_by(desc(UserTrustScore.last_calculated)).limit(10).all()

        score_trend = []
        for score_record in reversed(score_history):
            score_trend.append({
                "date": score_record.last_calculated.isoformat(),
                "score": score_record.score
            })

        # Calculate completion status for different areas
        completion_status = {
            "profile": vetting_status.profile_completeness,
            "verification": len([v for v in vetting_status.verification_badges.values() if v]) * 20,
            "activity": vetting_status.trust_score_breakdown.engagement_score if vetting_status.trust_score_breakdown else 0,
            "trust": min(100, (vetting_status.trust_score / 50) * 100)  # Normalize to 100
        }

        return UserQualityDashboard(
            overall_progress=progress_percentage,
            trust_score=current_score,
            profile_completeness=vetting_status.profile_completeness,
            verification_badges=vetting_status.verification_badges,
            completion_status=completion_status,
            score_trend=score_trend,
            improvement_suggestions=vetting_status.improvement_suggestions,
            can_appear_in_matches=vetting_status.can_appear_in_matches,
            can_send_intro_requests=vetting_status.can_send_intro_requests,
            last_updated=datetime.utcnow(),
            next_milestone={
                "target": "Reach 50 trust score",
                "current": current_score,
                "target_value": 50,
                "progress": min(100, (current_score / 50) * 100)
            }
        )

    except Exception as e:
        logger.error(f"Error getting quality dashboard for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving quality dashboard"
        )


# Admin-only endpoints
@router.get("/admin/users/{user_id}", response_model=VettingStatusResponse)
async def get_user_vetting_status(
    user_id: str,
    update_metrics: bool = Query(False, description="Update metrics during retrieval"),
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to get comprehensive vetting status for any user."""
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Use the same logic as get_my_vetting_status but for the specified user
    # This is a simplified version - in practice you'd refactor the common logic
    quality_summary = await matching_quality_filter.get_user_quality_summary(
        user, db, update_metrics=update_metrics
    )

    verification_badges = await verification_service.get_verification_badge_info(
        str(user.id), db
    )

    suggestions = await _generate_improvement_suggestions(
        user, quality_summary, verification_badges, db
    )

    return VettingStatusResponse(
        user_id=user.id,
        overall_status="good" if quality_summary.get("can_appear_in_matches") else "needs_improvement",
        trust_score=quality_summary.get("trust_score", 0),
        profile_completeness=quality_summary.get("profile_completeness", 0),
        can_appear_in_matches=quality_summary.get("can_appear_in_matches", False),
        can_send_intro_requests=quality_summary.get("can_send_intro_requests", False),
        verification_badges=verification_badges,
        quality_summary=quality_summary,
        improvement_suggestions=suggestions,
        last_updated=datetime.utcnow()
    )


@router.post("/admin/recalculate/all", response_model=dict)
async def admin_recalculate_all_metrics(
    background_tasks: BackgroundTasks,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to trigger recalculation of all user metrics."""
    try:
        # Trigger background jobs
        background_tasks.add_task(trigger_trust_score_recalculation)
        background_tasks.add_task(trigger_quality_metrics_update)

        logger.info(
            f"Admin {current_admin.id} triggered full metrics recalculation",
            extra={"admin_id": str(current_admin.id)}
        )

        return {
            "message": "Full metrics recalculation started in background",
            "triggered_by": current_admin.name,
            "timestamp": datetime.utcnow()
        }

    except Exception as e:
        logger.error(f"Error triggering full recalculation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error starting recalculation"
        )


@router.post("/admin/recalculate/{user_id}", response_model=dict)
async def admin_recalculate_user_metrics(
    user_id: str,
    background_tasks: BackgroundTasks,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to trigger recalculation of specific user metrics."""
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Trigger background recalculation
    background_tasks.add_task(trigger_user_trust_score_update, user_id)

    logger.info(
        f"Admin {current_admin.id} triggered metrics recalculation for user {user_id}",
        extra={"admin_id": str(current_admin.id), "target_user_id": user_id}
    )

    return {
        "message": f"Metrics recalculation started for user {user.name}",
        "user_id": user_id,
        "user_name": user.name,
        "triggered_by": current_admin.name,
        "timestamp": datetime.utcnow()
    }


@router.get("/admin/stats", response_model=dict)
async def get_vetting_system_stats(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to get comprehensive vetting system statistics."""
    try:
        # Trust score distribution
        trust_score_stats = db.query(UserTrustScore).all()
        trust_score_distribution = {
            "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0
        }

        for score_record in trust_score_stats:
            score = score_record.score
            if score <= 20:
                trust_score_distribution["0-20"] += 1
            elif score <= 40:
                trust_score_distribution["21-40"] += 1
            elif score <= 60:
                trust_score_distribution["41-60"] += 1
            elif score <= 80:
                trust_score_distribution["61-80"] += 1
            else:
                trust_score_distribution["81-100"] += 1

        # Verification statistics
        verification_stats = {}
        for verification_type in VerificationType:
            verified_count = db.query(UserVerification).filter(
                UserVerification.verification_type == verification_type.value,
                UserVerification.status == VerificationStatus.VERIFIED.value
            ).count()

            total_attempts = db.query(UserVerification).filter(
                UserVerification.verification_type == verification_type.value
            ).count()

            verification_stats[verification_type.value] = {
                "verified": verified_count,
                "total_attempts": total_attempts,
                "success_rate": (verified_count / total_attempts * 100) if total_attempts > 0 else 0
            }

        # Quality metrics overview
        quality_metrics = db.query(UserQualityMetrics).all()
        avg_profile_completeness = sum(m.profile_completeness for m in quality_metrics) / len(quality_metrics) if quality_metrics else 0

        total_flagged = sum(1 for m in quality_metrics if m.suspicious_activity_flags > 0)

        return {
            "trust_score_distribution": trust_score_distribution,
            "verification_statistics": verification_stats,
            "quality_overview": {
                "total_users_with_metrics": len(quality_metrics),
                "average_profile_completeness": round(avg_profile_completeness, 1),
                "users_with_flags": total_flagged,
                "flag_rate": (total_flagged / len(quality_metrics) * 100) if quality_metrics else 0
            },
            "system_health": {
                "users_with_trust_scores": len(trust_score_stats),
                "users_with_quality_metrics": len(quality_metrics),
                "total_verification_attempts": sum(v["total_attempts"] for v in verification_stats.values())
            },
            "generated_at": datetime.utcnow(),
            "generated_by": current_admin.name
        }

    except Exception as e:
        logger.error(f"Error getting vetting system stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving system statistics"
        )


# Helper functions
async def _generate_improvement_suggestions(
    user: User,
    quality_summary: Dict[str, Any],
    verification_badges: Dict[str, bool],
    db: Session
) -> List[ImprovementSuggestion]:
    """Generate personalized improvement suggestions for a user."""
    suggestions = []

    # Profile completeness suggestions
    profile_completeness = quality_summary.get("profile_completeness", 0)
    if profile_completeness < 50:
        suggestions.append(ImprovementSuggestion(
            category="profile",
            title="Complete Your Profile",
            description="Your profile is only {}% complete. Add more details about your background, startup ideas, and what you're looking for in a co-founder.".format(profile_completeness),
            impact="high",
            estimated_points=15,
            action_url="/profile/edit"
        ))

    # Verification suggestions
    if not verification_badges.get("email", False):
        suggestions.append(ImprovementSuggestion(
            category="verification",
            title="Verify Your Email",
            description="Email verification is required to use the platform. Check your inbox for a verification link.",
            impact="critical",
            estimated_points=10,
            action_url="/verify/email"
        ))

    if not verification_badges.get("github", False) and user.github_url:
        suggestions.append(ImprovementSuggestion(
            category="verification",
            title="Verify Your GitHub Profile",
            description="You've added a GitHub URL but haven't verified it yet. Verification adds credibility to your profile.",
            impact="medium",
            estimated_points=12,
            action_url="/verify/github"
        ))

    if not verification_badges.get("linkedin", False) and user.linkedin_url:
        suggestions.append(ImprovementSuggestion(
            category="verification",
            title="Verify Your LinkedIn Profile",
            description="LinkedIn verification helps other users trust your professional background.",
            impact="medium",
            estimated_points=10,
            action_url="/verify/linkedin"
        ))

    # Trust score specific suggestions
    trust_score = quality_summary.get("trust_score", 0)
    if trust_score < 20:
        suggestions.append(ImprovementSuggestion(
            category="trust",
            title="Improve Your Trust Score",
            description="Your trust score is below the minimum needed to send introduction requests. Focus on completing your profile and getting verified.",
            impact="high",
            estimated_points=25,
            action_url="/vetting/dashboard"
        ))

    # Professional profile suggestions
    if not user.portfolio_url and not user.github_url:
        suggestions.append(ImprovementSuggestion(
            category="professional",
            title="Add Professional Links",
            description="Add your portfolio, GitHub, or other professional links to showcase your work and increase your trust score.",
            impact="medium",
            estimated_points=8,
            action_url="/profile/edit#professional"
        ))

    # Activity suggestions
    if quality_summary.get("account_age_days", 0) > 7 and trust_score < 30:
        suggestions.append(ImprovementSuggestion(
            category="activity",
            title="Increase Platform Engagement",
            description="Engage more with the platform by updating your profile, browsing resources, and participating in events.",
            impact="medium",
            estimated_points=10,
            action_url="/dashboard"
        ))

    # Sort by impact and return top 5
    impact_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    suggestions.sort(key=lambda x: impact_order.get(x.impact, 3))

    return suggestions[:5]  # Return top 5 suggestions