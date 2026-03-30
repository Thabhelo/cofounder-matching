"""
Quality Filters for Matching System

Implements comprehensive quality filtering to ensure high-quality matches:
- Minimum profile completeness requirements (50% to appear in matches)
- Trust score requirements (20+ to send intro requests)
- Suspicious profile detection and flagging
- Auto-ban logic for severe violations
- Integration with existing matching system
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session

from app.models import (
    User, UserTrustScore, UserQualityMetrics, UserVerification,
    AdminReviewQueue, Report, Match, VerificationStatus, ReviewReason, ReviewStatus
)
from app.services.trust_score import recalculate_user_trust_score
from app.services.quality_metrics import update_user_quality_metrics
from app.utils.logging import get_logger

logger = get_logger(__name__)


class FilterResultType(str, Enum):
    """Results of quality filtering."""
    ALLOWED = "allowed"
    BLOCKED = "blocked"
    FLAGGED = "flagged"
    BANNED = "banned"


class FilterReason(str, Enum):
    """Reasons for filtering decisions."""
    INSUFFICIENT_PROFILE = "insufficient_profile_completeness"
    LOW_TRUST_SCORE = "low_trust_score"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    MULTIPLE_REPORTS = "multiple_reports"
    AUTO_BAN_THRESHOLD = "auto_ban_threshold_exceeded"
    UNVERIFIED_EMAIL = "unverified_email"
    NEW_ACCOUNT = "new_account_restrictions"
    RATE_LIMIT = "rate_limit_exceeded"


@dataclass
class QualityFilterConfig:
    """Configuration for quality filters."""
    # Profile completeness requirements
    min_profile_completeness_to_appear: int = 50  # % to appear in matches
    min_profile_completeness_to_send_intros: int = 40  # % to send intro requests

    # Trust score requirements
    min_trust_score_to_appear: int = 15  # Minimum trust score to appear in matches
    min_trust_score_to_send_intros: int = 20  # Minimum trust score to send intro requests

    # Rate limiting
    max_intro_requests_per_week: int = 20
    max_intro_requests_per_day: int = 5

    # Auto-ban thresholds
    max_reports_before_review: int = 3  # Flag for review after this many reports
    max_reports_before_auto_ban: int = 7  # Auto-ban after this many reports
    max_suspicious_flags_before_review: int = 3

    # Account age restrictions
    min_account_age_days_for_intros: int = 1  # Must be at least 1 day old to send intros

    # Email verification requirements
    require_email_verification: bool = True


@dataclass
class FilterResult:
    """Result of applying quality filters."""
    allowed: bool
    result_type: FilterResultType
    reason: Optional[FilterReason] = None
    message: Optional[str] = None
    flags: List[str] = None

    def __post_init__(self):
        if self.flags is None:
            self.flags = []


class MatchingQualityFilter:
    """Main quality filter service for the matching system."""

    def __init__(self, config: Optional[QualityFilterConfig] = None):
        self.config = config or QualityFilterConfig()

    def can_appear_in_matches(
        self,
        user: User,
        session: Session,
        update_metrics: bool = False
    ) -> FilterResult:
        """
        Check if a user can appear in match recommendations for others.
        This is the most permissive filter - basic requirements only.
        """
        flags = []

        try:
            # Basic account status checks
            if not user.is_active:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BLOCKED,
                    reason=FilterReason.BANNED,
                    message="Account is inactive"
                )

            if user.is_banned:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BLOCKED,
                    reason=FilterReason.BANNED,
                    message="Account is banned"
                )

            # Email verification check (if required)
            if self.config.require_email_verification:
                email_verified = self._is_email_verified(user, session)
                if not email_verified:
                    return FilterResult(
                        allowed=False,
                        result_type=FilterResultType.BLOCKED,
                        reason=FilterReason.UNVERIFIED_EMAIL,
                        message="Email verification required"
                    )

            # Get or calculate quality metrics
            quality_metrics = self._get_quality_metrics(user, session, update_metrics)

            # Profile completeness check
            profile_completeness = quality_metrics.profile_completeness if quality_metrics else 0
            if profile_completeness < self.config.min_profile_completeness_to_appear:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BLOCKED,
                    reason=FilterReason.INSUFFICIENT_PROFILE,
                    message=f"Profile must be at least {self.config.min_profile_completeness_to_appear}% complete (currently {profile_completeness}%)"
                )

            # Trust score check
            trust_score_data = self._get_trust_score(user, session, update_metrics)
            trust_score = trust_score_data.score if trust_score_data else 0

            if trust_score < self.config.min_trust_score_to_appear:
                # Low trust score doesn't block appearance, but flags for monitoring
                flags.append(f"low_trust_score_{trust_score}")

            # Report count check
            report_count = self._get_report_count(user, session)
            if report_count >= self.config.max_reports_before_auto_ban:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BANNED,
                    reason=FilterReason.AUTO_BAN_THRESHOLD,
                    message="Account automatically suspended due to multiple reports"
                )
            elif report_count >= self.config.max_reports_before_review:
                flags.append(f"multiple_reports_{report_count}")

            # Suspicious activity check
            suspicious_flags = self._count_suspicious_flags(user, session)
            if suspicious_flags >= self.config.max_suspicious_flags_before_review:
                flags.append(f"suspicious_activity_{suspicious_flags}")

            # Account passes all checks
            return FilterResult(
                allowed=True,
                result_type=FilterResultType.ALLOWED,
                flags=flags
            )

        except Exception as e:
            logger.error(f"Error checking appearance filter for user {user.id}: {str(e)}")
            return FilterResult(
                allowed=False,
                result_type=FilterResultType.BLOCKED,
                reason=FilterReason.SUSPICIOUS_ACTIVITY,
                message="Unable to verify account quality"
            )

    def can_send_intro_requests(
        self,
        user: User,
        session: Session,
        update_metrics: bool = False
    ) -> FilterResult:
        """
        Check if a user can send introduction requests.
        This has stricter requirements than appearing in matches.
        """
        flags = []

        try:
            # First check if they can appear in matches (basic requirements)
            appearance_check = self.can_appear_in_matches(user, session, update_metrics)
            if not appearance_check.allowed:
                return appearance_check

            # Account age check
            if user.created_at:
                account_age = (datetime.utcnow() - user.created_at).days
                if account_age < self.config.min_account_age_days_for_intros:
                    return FilterResult(
                        allowed=False,
                        result_type=FilterResultType.BLOCKED,
                        reason=FilterReason.NEW_ACCOUNT,
                        message=f"Account must be at least {self.config.min_account_age_days_for_intros} day(s) old to send introduction requests"
                    )

            # Enhanced profile completeness check for sending intros
            quality_metrics = self._get_quality_metrics(user, session, False)
            profile_completeness = quality_metrics.profile_completeness if quality_metrics else 0

            if profile_completeness < self.config.min_profile_completeness_to_send_intros:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BLOCKED,
                    reason=FilterReason.INSUFFICIENT_PROFILE,
                    message=f"Profile must be at least {self.config.min_profile_completeness_to_send_intros}% complete to send introduction requests (currently {profile_completeness}%)"
                )

            # Trust score check for sending intros
            trust_score_data = self._get_trust_score(user, session, False)
            trust_score = trust_score_data.score if trust_score_data else 0

            if trust_score < self.config.min_trust_score_to_send_intros:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BLOCKED,
                    reason=FilterReason.LOW_TRUST_SCORE,
                    message=f"Trust score must be at least {self.config.min_trust_score_to_send_intros} to send introduction requests (currently {trust_score})",
                    flags=[f"trust_score_{trust_score}"]
                )

            # Rate limiting checks
            rate_limit_result = self._check_intro_rate_limits(user, session)
            if not rate_limit_result.allowed:
                return rate_limit_result

            # Required fields check
            if not quality_metrics or not quality_metrics.required_fields_complete:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BLOCKED,
                    reason=FilterReason.INSUFFICIENT_PROFILE,
                    message="All required profile fields must be completed to send introduction requests"
                )

            # All checks passed
            return FilterResult(
                allowed=True,
                result_type=FilterResultType.ALLOWED,
                flags=flags + appearance_check.flags
            )

        except Exception as e:
            logger.error(f"Error checking intro request filter for user {user.id}: {str(e)}")
            return FilterResult(
                allowed=False,
                result_type=FilterResultType.BLOCKED,
                reason=FilterReason.SUSPICIOUS_ACTIVITY,
                message="Unable to verify account eligibility"
            )

    def check_and_flag_suspicious_activity(
        self,
        user: User,
        session: Session
    ) -> Tuple[bool, List[str]]:
        """
        Check for suspicious activity patterns and flag for admin review if needed.
        Returns (should_flag, reasons_list).
        """
        suspicious_indicators = []

        try:
            # Get user metrics
            quality_metrics = self._get_quality_metrics(user, session)
            trust_score_data = self._get_trust_score(user, session)

            # Pattern 1: Very new account with aggressive activity
            if user.created_at:
                account_age = (datetime.utcnow() - user.created_at).days
                if account_age < 2:  # Less than 2 days old
                    # Check recent intro requests
                    recent_intros = self._count_recent_intro_requests(
                        user, session, days=1
                    )
                    if recent_intros > 10:
                        suspicious_indicators.append("new_account_high_activity")

            # Pattern 2: Incomplete profile but many intro requests
            if quality_metrics and quality_metrics.profile_completeness < 30:
                recent_intros = self._count_recent_intro_requests(
                    user, session, days=7
                )
                if recent_intros > 15:
                    suspicious_indicators.append("incomplete_profile_high_requests")

            # Pattern 3: Very low trust score with persistent activity
            if trust_score_data and trust_score_data.score < 10:
                recent_intros = self._count_recent_intro_requests(
                    user, session, days=7
                )
                if recent_intros > 5:
                    suspicious_indicators.append("low_trust_persistent_activity")

            # Pattern 4: Multiple reports
            report_count = self._get_report_count(user, session)
            if report_count >= self.config.max_reports_before_review:
                suspicious_indicators.append(f"multiple_reports_{report_count}")

            # Pattern 5: Rapid-fire intro requests (potential bot behavior)
            recent_intros_1h = self._count_recent_intro_requests(
                user, session, hours=1
            )
            if recent_intros_1h > 5:
                suspicious_indicators.append("rapid_fire_requests")

            # Pattern 6: Generic or suspicious profile content
            if self._has_suspicious_profile_content(user):
                suspicious_indicators.append("suspicious_profile_content")

            # Pattern 7: No verification but claiming extensive experience
            if trust_score_data and trust_score_data.email_domain_score == 0:  # No domain verification
                if user.experience_years and user.experience_years > 10:
                    suspicious_indicators.append("unverified_extensive_claims")

            # Determine if should flag for review
            should_flag = len(suspicious_indicators) >= 2 or any(
                indicator.startswith(("multiple_reports", "rapid_fire_requests"))
                for indicator in suspicious_indicators
            )

            if should_flag:
                self._create_admin_review_item(
                    user, session, ReviewReason.SUSPICIOUS_ACTIVITY,
                    f"Suspicious activity detected: {', '.join(suspicious_indicators)}"
                )

            return should_flag, suspicious_indicators

        except Exception as e:
            logger.error(f"Error checking suspicious activity for user {user.id}: {str(e)}")
            return False, []

    def apply_auto_moderation(
        self,
        user: User,
        session: Session
    ) -> Tuple[bool, str]:
        """
        Apply automatic moderation actions based on user behavior.
        Returns (action_taken, action_description).
        """
        try:
            # Check for auto-ban conditions
            report_count = self._get_report_count(user, session)

            if report_count >= self.config.max_reports_before_auto_ban:
                # Auto-ban user
                user.is_banned = True
                user.updated_at = datetime.utcnow()

                self._create_admin_review_item(
                    user, session, ReviewReason.MULTIPLE_REPORTS,
                    f"Auto-banned due to {report_count} reports"
                )

                session.commit()

                logger.warning(
                    f"User {user.id} auto-banned due to {report_count} reports",
                    extra={"user_id": str(user.id), "report_count": report_count}
                )

                return True, f"Account automatically suspended due to {report_count} reports"

            # Check for suspicious activity flagging
            should_flag, indicators = self.check_and_flag_suspicious_activity(user, session)

            if should_flag:
                return True, f"Account flagged for admin review: {', '.join(indicators)}"

            return False, "No moderation action required"

        except Exception as e:
            logger.error(f"Error applying auto-moderation for user {user.id}: {str(e)}")
            return False, "Error during moderation check"

    def get_user_quality_summary(
        self,
        user: User,
        session: Session,
        update_metrics: bool = False
    ) -> Dict:
        """Get comprehensive quality summary for a user."""
        try:
            quality_metrics = self._get_quality_metrics(user, session, update_metrics)
            trust_score_data = self._get_trust_score(user, session, update_metrics)

            # Check various filters
            can_appear = self.can_appear_in_matches(user, session, False)
            can_send_intros = self.can_send_intro_requests(user, session, False)

            # Get verification status
            email_verified = self._is_email_verified(user, session)

            # Get report and flag counts
            report_count = self._get_report_count(user, session)
            suspicious_flags = self._count_suspicious_flags(user, session)

            return {
                "user_id": str(user.id),
                "profile_completeness": quality_metrics.profile_completeness if quality_metrics else 0,
                "trust_score": trust_score_data.score if trust_score_data else 0,
                "required_fields_complete": quality_metrics.required_fields_complete if quality_metrics else False,
                "email_verified": email_verified,
                "can_appear_in_matches": can_appear.allowed,
                "can_send_intro_requests": can_send_intros.allowed,
                "report_count": report_count,
                "suspicious_flags_count": suspicious_flags,
                "account_age_days": (datetime.utcnow() - user.created_at).days if user.created_at else 0,
                "is_active": user.is_active,
                "is_banned": user.is_banned,
                "filters": {
                    "appearance_filter": {
                        "allowed": can_appear.allowed,
                        "reason": can_appear.reason.value if can_appear.reason else None,
                        "message": can_appear.message,
                        "flags": can_appear.flags
                    },
                    "intro_request_filter": {
                        "allowed": can_send_intros.allowed,
                        "reason": can_send_intros.reason.value if can_send_intros.reason else None,
                        "message": can_send_intros.message,
                        "flags": can_send_intros.flags
                    }
                },
                "verification_badges": self._get_verification_badges(user, session),
                "calculated_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting quality summary for user {user.id}: {str(e)}")
            return {"error": str(e)}

    # Helper methods
    def _get_quality_metrics(
        self,
        user: User,
        session: Session,
        update_if_missing: bool = False
    ) -> Optional[UserQualityMetrics]:
        """Get user quality metrics, optionally updating if missing."""
        try:
            result = session.execute(
                select(UserQualityMetrics).where(UserQualityMetrics.user_id == user.id)
            )
            metrics = result.scalar_one_or_none()

            if not metrics and update_if_missing:
                # Calculate metrics in background
                try:
                    metrics = update_user_quality_metrics(str(user.id))
                except Exception as e:
                    logger.error(f"Error updating quality metrics: {str(e)}")

            return metrics
        except Exception as e:
            logger.error(f"Error getting quality metrics: {str(e)}")
            return None

    def _get_trust_score(
        self,
        user: User,
        session: Session,
        update_if_missing: bool = False
    ) -> Optional[UserTrustScore]:
        """Get user trust score, optionally updating if missing."""
        try:
            result = session.execute(
                select(UserTrustScore).where(UserTrustScore.user_id == user.id)
            )
            trust_score = result.scalar_one_or_none()

            if not trust_score and update_if_missing:
                # Calculate trust score in background
                try:
                    trust_score = recalculate_user_trust_score(str(user.id))
                except Exception as e:
                    logger.error(f"Error updating trust score: {str(e)}")

            return trust_score
        except Exception as e:
            logger.error(f"Error getting trust score: {str(e)}")
            return None

    def _is_email_verified(self, user: User, session: Session) -> bool:
        """Check if user's email is verified."""
        try:
            result = session.execute(
                select(UserVerification).where(
                    and_(
                        UserVerification.user_id == user.id,
                        UserVerification.verification_type == "email",
                        UserVerification.status == VerificationStatus.VERIFIED.value
                    )
                ).order_by(UserVerification.created_at.desc())
            )
            verification = result.scalar_one_or_none()

            if not verification:
                return False

            # Check if verification is expired
            if verification.expires_at and verification.expires_at < datetime.utcnow():
                return False

            return True
        except Exception:
            return False

    def _get_report_count(self, user: User, session: Session) -> int:
        """Get count of reports against this user."""
        try:
            result = session.execute(
                select(func.count(Report.id)).where(Report.reported_user_id == user.id)
            )
            return result.scalar() or 0
        except Exception:
            return 0

    def _count_suspicious_flags(self, user: User, session: Session) -> int:
        """Count suspicious activity flags from quality metrics."""
        try:
            quality_metrics = self._get_quality_metrics(user, session, False)
            return quality_metrics.suspicious_activity_flags if quality_metrics else 0
        except Exception:
            return 0

    def _count_recent_intro_requests(
        self,
        user: User,
        session: Session,
        days: Optional[int] = None,
        hours: Optional[int] = None
    ) -> int:
        """Count recent introduction requests by user."""
        try:
            if days:
                cutoff = datetime.utcnow() - timedelta(days=days)
            elif hours:
                cutoff = datetime.utcnow() - timedelta(hours=hours)
            else:
                cutoff = datetime.utcnow() - timedelta(days=7)

            result = session.execute(
                select(func.count(Match.id)).where(
                    and_(
                        Match.user_id == user.id,
                        Match.intro_requested_at.isnot(None),
                        Match.intro_requested_at >= cutoff
                    )
                )
            )
            return result.scalar() or 0
        except Exception:
            return 0

    def _check_intro_rate_limits(self, user: User, session: Session) -> FilterResult:
        """Check introduction request rate limits."""
        try:
            # Daily limit
            daily_count = self._count_recent_intro_requests(user, session, days=1)
            if daily_count >= self.config.max_intro_requests_per_day:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BLOCKED,
                    reason=FilterReason.RATE_LIMIT,
                    message=f"Daily limit of {self.config.max_intro_requests_per_day} introduction requests exceeded. Try again tomorrow."
                )

            # Weekly limit
            weekly_count = self._count_recent_intro_requests(user, session, days=7)
            if weekly_count >= self.config.max_intro_requests_per_week:
                return FilterResult(
                    allowed=False,
                    result_type=FilterResultType.BLOCKED,
                    reason=FilterReason.RATE_LIMIT,
                    message=f"Weekly limit of {self.config.max_intro_requests_per_week} introduction requests exceeded."
                )

            return FilterResult(allowed=True, result_type=FilterResultType.ALLOWED)

        except Exception as e:
            logger.error(f"Error checking rate limits: {str(e)}")
            return FilterResult(
                allowed=False,
                result_type=FilterResultType.BLOCKED,
                reason=FilterReason.RATE_LIMIT,
                message="Unable to verify rate limits"
            )

    def _has_suspicious_profile_content(self, user: User) -> bool:
        """Check for suspicious patterns in profile content."""
        suspicious_patterns = [
            "crypto", "investment", "trading", "forex", "loan", "money",
            "bitcoin", "ethereum", "nft", "dating", "romance", "escort"
        ]

        # Check various text fields for suspicious content
        text_fields = [
            user.introduction or "",
            user.life_story or "",
            user.startup_description or "",
            user.looking_for_description or ""
        ]

        content = " ".join(text_fields).lower()

        return any(pattern in content for pattern in suspicious_patterns)

    def _create_admin_review_item(
        self,
        user: User,
        session: Session,
        reason: ReviewReason,
        description: str
    ) -> Optional[AdminReviewQueue]:
        """Create admin review queue item."""
        try:
            # Check if review item already exists for this reason
            existing = session.execute(
                select(AdminReviewQueue).where(
                    and_(
                        AdminReviewQueue.user_id == user.id,
                        AdminReviewQueue.reason == reason.value,
                        AdminReviewQueue.status == ReviewStatus.PENDING.value
                    )
                )
            )

            if existing.scalar_one_or_none():
                return None  # Already exists

            review_item = AdminReviewQueue(
                user_id=user.id,
                reason=reason.value,
                status=ReviewStatus.PENDING.value,
                description=description,
                priority=2 if reason == ReviewReason.MULTIPLE_REPORTS else 3,
                user_context={
                    "name": user.name,
                    "email": user.email,
                    "profile_status": user.profile_status,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "is_active": user.is_active,
                    "is_banned": user.is_banned
                }
            )

            session.add(review_item)
            session.commit()

            logger.info(
                f"Created admin review item for user {user.id}: {reason.value}",
                extra={"user_id": str(user.id), "reason": reason.value}
            )

            return review_item

        except Exception as e:
            logger.error(f"Error creating admin review item: {str(e)}")
            session.rollback()
            return None

    def _get_verification_badges(self, user: User, session: Session) -> Dict[str, bool]:
        """Get verification badge status for user."""
        try:
            result = session.execute(
                select(UserVerification).where(
                    and_(
                        UserVerification.user_id == user.id,
                        UserVerification.status == VerificationStatus.VERIFIED.value,
                        or_(
                            UserVerification.expires_at.is_(None),
                            UserVerification.expires_at > datetime.utcnow()
                        )
                    )
                )
            )
            verifications = result.scalars().all()

            badges = {
                "email": False,
                "domain": False,
                "github": False,
                "linkedin": False,
                "manual": False
            }

            for verification in verifications:
                badges[verification.verification_type] = True

            return badges
        except Exception:
            return {"email": False, "domain": False, "github": False, "linkedin": False, "manual": False}


# Global filter service instance
matching_quality_filter = MatchingQualityFilter()


# Convenience functions for use in API endpoints
def filter_candidates_for_matching(
    candidates: List[User],
    session: Session,
    update_metrics: bool = False
) -> List[User]:
    """Filter candidate users that can appear in matches."""
    filtered_candidates = []

    for user in candidates:
        try:
            filter_result = matching_quality_filter.can_appear_in_matches(
                user, session, update_metrics
            )
            if filter_result.allowed:
                filtered_candidates.append(user)
        except Exception as e:
            logger.error(f"Error filtering candidate {user.id}: {str(e)}")
            continue

    return filtered_candidates


def validate_intro_request_eligibility(
    user: User,
    session: Session
) -> FilterResult:
    """Validate if user can send introduction requests."""
    return matching_quality_filter.can_send_intro_requests(user, session, True)