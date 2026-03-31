"""
Quality Metrics Calculation Service

Calculates and caches quality metrics for users that are used in matching filters
and trust score calculations. These metrics focus on profile completeness,
activity patterns, and engagement indicators.
"""

from datetime import datetime, timedelta
from typing import Dict, Optional
from dataclasses import dataclass

from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    User, UserQualityMetrics, Match, Message, Report,
    UserEventRSVP, UserSavedResource
)
from app.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class ProfileCompletenessScore:
    """Breakdown of profile completeness scoring."""
    basic_info_score: int = 0  # Name, email, avatar, introduction
    location_score: int = 0    # Location fields
    professional_score: int = 0  # Experience, skills, URLs
    personal_score: int = 0    # Story, hobbies, accomplishments
    preferences_score: int = 0  # Co-founder preferences
    startup_score: int = 0     # Startup information

    @property
    def total_score(self) -> int:
        """Calculate total profile completeness score (0-100)."""
        return min(100, (
            self.basic_info_score + self.location_score + self.professional_score +
            self.personal_score + self.preferences_score + self.startup_score
        ))


class QualityMetricsCalculator:
    """Calculates comprehensive quality metrics for users."""

    def __init__(self):
        self.required_fields = [
            'name', 'email', 'introduction', 'location', 'startup_description',
            'looking_for_description', 'areas_of_ownership'
        ]

    def calculate_user_quality_metrics(
        self,
        user: User,
        session: Session
    ) -> UserQualityMetrics:
        """
        Calculate comprehensive quality metrics for a user.
        """
        try:
            # Calculate profile completeness
            completeness = self._calculate_profile_completeness(user)

            # Calculate activity metrics
            activity_score = self._calculate_activity_score(user, session)
            login_frequency = self._calculate_login_frequency_score(user, session)
            update_recency = self._calculate_profile_update_recency(user)

            # Calculate engagement metrics
            message_response_rate = self._calculate_message_response_rate(user, session)
            intro_acceptance_rate = self._calculate_intro_acceptance_rate(user, session)
            interaction_score = self._calculate_platform_interaction_score(user, session)

            # Check quality indicators
            has_portfolio = bool(user.portfolio_url)
            has_linkedin = bool(user.linkedin_url)
            has_github = bool(user.github_url)
            has_video_intro = bool(user.video_intro_url)

            # Get social proof metrics (if available from verifications)
            social_metrics = self._get_social_proof_metrics(user, session)

            # Calculate risk indicators
            report_count = self._get_report_count(user, session)
            suspicious_flags = self._calculate_suspicious_activity_flags(user, session)

            # Determine if required fields are complete
            required_complete = self._check_required_fields_complete(user)

            # Build detailed metrics
            detailed_metrics = {
                'profile_breakdown': {
                    'basic_info': completeness.basic_info_score,
                    'location': completeness.location_score,
                    'professional': completeness.professional_score,
                    'personal': completeness.personal_score,
                    'preferences': completeness.preferences_score,
                    'startup': completeness.startup_score
                },
                'activity_breakdown': {
                    'general_activity': activity_score,
                    'login_frequency': login_frequency,
                    'profile_updates': update_recency
                },
                'engagement_breakdown': {
                    'message_responses': message_response_rate,
                    'intro_acceptance': intro_acceptance_rate,
                    'platform_interaction': interaction_score
                },
                'quality_indicators': {
                    'portfolio': has_portfolio,
                    'linkedin': has_linkedin,
                    'github': has_github,
                    'video_intro': has_video_intro
                },
                'social_proof': social_metrics,
                'risk_indicators': {
                    'report_count': report_count,
                    'suspicious_flags': suspicious_flags
                },
                'calculation_timestamp': datetime.utcnow().isoformat()
            }

            return UserQualityMetrics(
                user_id=user.id,
                profile_completeness=completeness.total_score,
                required_fields_complete=required_complete,
                activity_score=activity_score,
                login_frequency_score=login_frequency,
                profile_update_recency=update_recency,
                message_response_rate=message_response_rate,
                introduction_acceptance_rate=intro_acceptance_rate,
                platform_interaction_score=interaction_score,
                has_portfolio=has_portfolio,
                has_linkedin=has_linkedin,
                has_github=has_github,
                has_video_intro=has_video_intro,
                linkedin_connections=social_metrics.get('linkedin_connections'),
                github_followers=social_metrics.get('github_followers'),
                github_public_repos=social_metrics.get('github_public_repos'),
                report_count=report_count,
                suspicious_activity_flags=suspicious_flags,
                detailed_metrics=detailed_metrics,
                last_calculated=datetime.utcnow(),
                calculation_version="1.0"
            )

        except Exception as e:
            logger.error(
                f"Error calculating quality metrics for user {user.id}: {str(e)}",
                extra={"user_id": str(user.id), "error": str(e)}
            )
            # Return minimal metrics on error
            return UserQualityMetrics(
                user_id=user.id,
                last_calculated=datetime.utcnow(),
                calculation_version="1.0"
            )

    def _calculate_profile_completeness(self, user: User) -> ProfileCompletenessScore:
        """Calculate detailed profile completeness breakdown."""
        score = ProfileCompletenessScore()

        # Basic info (0-25 points)
        basic_fields = [user.name, user.email, user.introduction]
        basic_count = sum(1 for field in basic_fields if field and field.strip())
        if user.avatar_url:
            basic_count += 1

        score.basic_info_score = min(25, (basic_count / 4) * 25)

        # Location info (0-10 points)
        location_fields = [user.location, user.location_city, user.location_country]
        location_count = sum(1 for field in location_fields if field and field.strip())
        score.location_score = min(10, (location_count / 3) * 10)

        # Professional info (0-25 points)
        professional_fields = [
            user.linkedin_url, user.github_url, user.portfolio_url,
            user.employment_history, user.education_history
        ]
        professional_count = sum(1 for field in professional_fields if field and field.strip())

        if user.experience_years and user.experience_years > 0:
            professional_count += 1

        score.professional_score = min(25, (professional_count / 6) * 25)

        # Personal info (0-15 points)
        personal_fields = [
            user.life_story, user.hobbies, user.impressive_accomplishment
        ]
        personal_count = sum(1 for field in personal_fields if field and len(field.strip()) > 20)
        score.personal_score = min(15, (personal_count / 3) * 15)

        # Co-founder preferences (0-15 points)
        preference_fields = [
            user.looking_for_description, user.pref_idea_status,
            user.pref_location_type, user.pref_cofounder_areas
        ]
        pref_count = sum(1 for field in preference_fields if field)
        score.preferences_score = min(15, (pref_count / 4) * 15)

        # Startup information (0-10 points)
        startup_fields = [
            user.startup_description, user.idea_status,
            user.areas_of_ownership, user.commitment
        ]
        startup_count = sum(1 for field in startup_fields if field)
        score.startup_score = min(10, (startup_count / 4) * 10)

        return score

    def _calculate_activity_score(self, user: User, session: Session) -> int:
        """Calculate general activity score based on platform usage."""
        score = 0

        try:
            if user.created_at:
                account_age = datetime.utcnow() - user.created_at
                days = account_age.days

                if days > 365:
                    score += 30
                elif days > 180:
                    score += 25
                elif days > 90:
                    score += 20
                elif days > 30:
                    score += 15
                elif days > 7:
                    score += 10
                else:
                    score += 5

            if user.profile_status == "complete":
                score += 20
            elif user.profile_status == "partial":
                score += 10

            if user.settings:
                score += 5
            if user.behavior_agreement_accepted_at:
                score += 5

            now = datetime.utcnow()

            recent_matches = session.execute(
                select(func.count(Match.id)).where(
                    and_(
                        or_(Match.requester_id == user.id, Match.recipient_id == user.id),
                        Match.created_at > now - timedelta(days=30)
                    )
                )
            )
            match_count = recent_matches.scalar() or 0
            score += min(15, match_count * 2)

            recent_messages = session.execute(
                select(func.count(Message.id)).where(
                    and_(
                        Message.sender_id == user.id,
                        Message.created_at > now - timedelta(days=30)
                    )
                )
            )
            message_count = recent_messages.scalar() or 0
            score += min(15, message_count)

            recent_resources = session.execute(
                select(func.count(UserSavedResource.id)).where(
                    and_(
                        UserSavedResource.user_id == user.id,
                        UserSavedResource.created_at > now - timedelta(days=30)
                    )
                )
            )
            resource_count = recent_resources.scalar() or 0
            score += min(10, resource_count)

        except Exception as e:
            logger.error(f"Error calculating activity score: {str(e)}")

        return min(100, score)

    def _calculate_login_frequency_score(self, user: User, session: Session) -> int:
        """Calculate login frequency score based on recent activity patterns."""
        try:
            if not user.updated_at:
                return 0

            days_since_update = (datetime.utcnow() - user.updated_at).days

            if days_since_update < 1:
                return 100  # Active today
            elif days_since_update < 3:
                return 80   # Active in last 3 days
            elif days_since_update < 7:
                return 60   # Active in last week
            elif days_since_update < 14:
                return 40   # Active in last 2 weeks
            elif days_since_update < 30:
                return 20   # Active in last month
            else:
                return 5    # Inactive

        except Exception as e:
            logger.error(f"Error calculating login frequency: {str(e)}")
            return 0

    def _calculate_profile_update_recency(self, user: User) -> int:
        """Calculate score based on how recently profile was updated."""
        try:
            if not user.updated_at:
                return 0

            days_since_update = (datetime.utcnow() - user.updated_at).days

            if days_since_update < 7:
                return 100
            elif days_since_update < 30:
                return 80
            elif days_since_update < 90:
                return 60
            elif days_since_update < 180:
                return 40
            elif days_since_update < 365:
                return 20
            else:
                return 0

        except Exception as e:
            logger.error(f"Error calculating profile update recency: {str(e)}")
            return 0

    def _calculate_message_response_rate(self, user: User, session: Session) -> float:
        """Calculate message response rate."""
        try:
            messages_received = session.execute(
                select(func.count(Message.id)).where(
                    and_(
                        Message.recipient_id == user.id,
                        Message.created_at > datetime.utcnow() - timedelta(days=90)
                    )
                )
            )
            received_count = messages_received.scalar() or 0

            if received_count == 0:
                return 0.0

            messages_sent = session.execute(
                select(func.count(Message.id)).where(
                    and_(
                        Message.sender_id == user.id,
                        Message.created_at > datetime.utcnow() - timedelta(days=90)
                    )
                )
            )
            sent_count = messages_sent.scalar() or 0

            return min(1.0, sent_count / received_count)

        except Exception as e:
            logger.error(f"Error calculating message response rate: {str(e)}")
            return 0.0

    def _calculate_intro_acceptance_rate(self, user: User, session: Session) -> float:
        """Calculate introduction request acceptance rate."""
        try:
            intros_received = session.execute(
                select(func.count(Match.id)).where(
                    and_(
                        Match.recipient_id == user.id,
                        Match.status.in_(['pending', 'accepted', 'declined'])
                    )
                )
            )
            received_count = intros_received.scalar() or 0

            if received_count == 0:
                return 0.5

            intros_accepted = session.execute(
                select(func.count(Match.id)).where(
                    and_(
                        Match.recipient_id == user.id,
                        Match.status == 'accepted'
                    )
                )
            )
            accepted_count = intros_accepted.scalar() or 0

            return accepted_count / received_count

        except Exception as e:
            logger.error(f"Error calculating intro acceptance rate: {str(e)}")
            return 0.0

    def _calculate_platform_interaction_score(self, user: User, session: Session) -> int:
        """Calculate overall platform interaction score."""
        score = 0

        try:
            event_rsvps = session.execute(
                select(func.count(UserEventRSVP.id)).where(
                    UserEventRSVP.user_id == user.id
                )
            )
            event_count = event_rsvps.scalar() or 0
            score += min(20, event_count * 5)

            saved_resources = session.execute(
                select(func.count(UserSavedResource.id)).where(
                    UserSavedResource.user_id == user.id
                )
            )
            resource_count = saved_resources.scalar() or 0
            score += min(20, resource_count * 2)

            total_matches = session.execute(
                select(func.count(Match.id)).where(
                    or_(Match.requester_id == user.id, Match.recipient_id == user.id)
                )
            )
            match_count = total_matches.scalar() or 0
            score += min(30, match_count * 3)

            total_messages = session.execute(
                select(func.count(Message.id)).where(
                    Message.sender_id == user.id
                )
            )
            message_count = total_messages.scalar() or 0
            score += min(30, message_count * 2)

        except Exception as e:
            logger.error(f"Error calculating interaction score: {str(e)}")

        return min(100, score)

    def _get_social_proof_metrics(self, user: User, session: Session) -> Dict:
        """Get social proof metrics from verification data."""
        metrics = {}

        try:
            # This would typically pull from UserVerification records
            # For now, return empty dict - will be populated by verification system
            pass
        except Exception as e:
            logger.error(f"Error getting social proof metrics: {str(e)}")

        return metrics

    def _get_report_count(self, user: User, session: Session) -> int:
        """Get count of reports against this user."""
        try:
            reports = session.execute(
                select(func.count(Report.id)).where(Report.reported_user_id == user.id)
            )
            return reports.scalar() or 0
        except Exception as e:
            logger.error(f"Error getting report count: {str(e)}")
            return 0

    def _calculate_suspicious_activity_flags(self, user: User, session: Session) -> int:
        """Calculate number of suspicious activity flags."""
        flags = 0

        try:
            if user.created_at and user.experience_years:
                account_age = (datetime.utcnow() - user.created_at).days
                if account_age < 1 and user.experience_years > 10:
                    flags += 1

            if user.profile_status == "incomplete":
                recent_matches = session.execute(
                    select(func.count(Match.id)).where(
                        and_(
                            Match.requester_id == user.id,
                            Match.created_at > datetime.utcnow() - timedelta(days=7)
                        )
                    )
                )
                if (recent_matches.scalar() or 0) > 10:
                    flags += 1

            report_count = self._get_report_count(user, session)
            if report_count > 2:
                flags += 1

        except Exception as e:
            logger.error(f"Error calculating suspicious flags: {str(e)}")

        return flags

    def _check_required_fields_complete(self, user: User) -> bool:
        """Check if all required fields are completed."""
        for field_name in self.required_fields:
            field_value = getattr(user, field_name, None)
            if not field_value or (isinstance(field_value, str) and not field_value.strip()):
                return False
        return True

    def save_quality_metrics(
        self,
        metrics: UserQualityMetrics,
        session: Session
    ) -> UserQualityMetrics:
        """Save quality metrics to database."""
        try:
            existing_record = session.query(UserQualityMetrics).filter(
                UserQualityMetrics.user_id == metrics.user_id
            ).first()

            if existing_record:
                for attr, value in metrics.__dict__.items():
                    if not attr.startswith('_') and attr != 'id':
                        setattr(existing_record, attr, value)
                existing_record.updated_at = datetime.utcnow()
                result = existing_record
            else:
                session.add(metrics)
                result = metrics

            session.commit()
            session.refresh(result)
            return result

        except Exception as e:
            session.rollback()
            logger.error(f"Error saving quality metrics: {str(e)}")
            raise


# Background job functions
def update_all_quality_metrics():
    """Update quality metrics for all active users."""
    calculator = QualityMetricsCalculator()
    session = SessionLocal()

    try:
        users = session.query(User).filter(
            and_(User.is_active, ~User.is_banned)
        ).all()

        logger.info(f"Starting quality metrics update for {len(users)} users")

        for user in users:
            try:
                metrics = calculator.calculate_user_quality_metrics(user, session)
                calculator.save_quality_metrics(metrics, session)
            except Exception as e:
                logger.error(
                    f"Error updating quality metrics for user {user.id}: {str(e)}"
                )
                continue

        logger.info("Completed quality metrics update for all users")

    except Exception as e:
        logger.error(f"Error in quality metrics update job: {str(e)}")
        raise
    finally:
        session.close()


def update_user_quality_metrics(user_id: str) -> Optional[UserQualityMetrics]:
    """Update quality metrics for a specific user."""
    calculator = QualityMetricsCalculator()
    session = SessionLocal()

    try:
        user = session.query(User).filter(User.id == user_id).first()

        if not user:
            logger.warning(f"User not found: {user_id}")
            return None

        metrics = calculator.calculate_user_quality_metrics(user, session)
        return calculator.save_quality_metrics(metrics, session)

    except Exception as e:
        logger.error(f"Error updating quality metrics for user {user_id}: {str(e)}")
        return None
    finally:
        session.close()