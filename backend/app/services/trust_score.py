"""
Trust Score Calculation Engine for User Vetting System

This module calculates trust scores (0-100) based on multiple factors:
- Email domain verification (.edu, company domains)
- GitHub activity and contributions
- LinkedIn profile completeness
- Portfolio/proof of work quality
- Time on platform and engagement
- Introduction acceptance rate
- Report history (negative signals)
"""

import asyncio
import re
from datetime import datetime
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models import (
    User, UserTrustScore, UserVerification, Match, Report, VerificationType, VerificationStatus
)
from app.utils.logging import get_logger

logger = get_logger(__name__)


class DomainType(str, Enum):
    """Classification of email domains for trust scoring."""
    EDUCATIONAL = "educational"  # .edu domains
    GOVERNMENT = "government"   # .gov domains
    CORPORATE = "corporate"     # Known company domains
    GENERIC = "generic"         # Gmail, Yahoo, etc.
    SUSPICIOUS = "suspicious"   # Temporary/disposable emails
    UNKNOWN = "unknown"         # Other domains


@dataclass
class TrustScoreFactors:
    """Individual factor scores that contribute to overall trust score."""
    email_domain_score: int = 0
    github_activity_score: int = 0
    linkedin_completeness_score: int = 0
    portfolio_quality_score: int = 0
    platform_tenure_score: int = 0
    engagement_score: int = 0
    intro_acceptance_rate: float = 0.0
    report_penalty: int = 0

    @property
    def weighted_score(self) -> int:
        """Calculate weighted overall trust score."""
        return min(100, max(0, int(
            self.email_domain_score * 0.15 +
            self.github_activity_score * 0.20 +
            self.linkedin_completeness_score * 0.15 +
            self.portfolio_quality_score * 0.10 +
            self.platform_tenure_score * 0.10 +
            self.engagement_score * 0.15 +
            (self.intro_acceptance_rate * 100) * 0.15 -
            self.report_penalty
        )))


class TrustScoreCalculator:
    """Main trust score calculation engine."""

    def __init__(self):
        self.educational_domains = {
            '.edu', '.ac.uk', '.edu.au', '.edu.ca', '.ac.za', '.ac.in'
        }
        self.government_domains = {
            '.gov', '.gov.uk', '.gov.au', '.gov.ca', '.gc.ca'
        }
        self.corporate_domains = {
            # Tech companies
            'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'meta.com',
            'tesla.com', 'netflix.com', 'uber.com', 'airbnb.com', 'stripe.com',
            # Consulting/Finance
            'mckinsey.com', 'bain.com', 'bcg.com', 'deloitte.com', 'pwc.com',
            'goldmansachs.com', 'jpmorgan.com', 'blackrock.com', 'sequoia.com',
            # Other well-known companies
            'ycombinator.com', 'techstars.com', 'a16z.com', 'kleinerperkins.com'
        }
        self.suspicious_domains = {
            '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
            'tempmail.org', 'temp-mail.org', 'throwaway.email'
        }

    async def calculate_user_trust_score(
        self,
        user: User,
        session: AsyncSession
    ) -> Tuple[int, TrustScoreFactors]:
        """
        Calculate comprehensive trust score for a user.

        Returns:
            Tuple of (overall_score, individual_factors)
        """
        try:
            # Calculate individual factor scores
            factors = TrustScoreFactors()

            # Email domain verification
            factors.email_domain_score = await self._calculate_email_domain_score(
                user.email, user, session
            )

            # GitHub activity analysis
            factors.github_activity_score = await self._calculate_github_score(
                user.github_url, user, session
            )

            # LinkedIn profile completeness
            factors.linkedin_completeness_score = await self._calculate_linkedin_score(
                user.linkedin_url, user, session
            )

            # Portfolio quality assessment
            factors.portfolio_quality_score = await self._calculate_portfolio_score(
                user, session
            )

            # Platform tenure and activity
            factors.platform_tenure_score = await self._calculate_tenure_score(
                user, session
            )

            # User engagement metrics
            factors.engagement_score = await self._calculate_engagement_score(
                user, session
            )

            # Introduction acceptance rate
            factors.intro_acceptance_rate = await self._calculate_intro_acceptance_rate(
                user, session
            )

            # Report penalty calculation
            factors.report_penalty = await self._calculate_report_penalty(
                user, session
            )

            overall_score = factors.weighted_score

            logger.info(
                f"Calculated trust score for user {user.id}: {overall_score}",
                extra={
                    "user_id": str(user.id),
                    "trust_score": overall_score,
                    "factors": {
                        "email_domain": factors.email_domain_score,
                        "github": factors.github_activity_score,
                        "linkedin": factors.linkedin_completeness_score,
                        "portfolio": factors.portfolio_quality_score,
                        "tenure": factors.platform_tenure_score,
                        "engagement": factors.engagement_score,
                        "intro_rate": factors.intro_acceptance_rate,
                        "report_penalty": factors.report_penalty
                    }
                }
            )

            return overall_score, factors

        except Exception as e:
            logger.error(
                f"Error calculating trust score for user {user.id}: {str(e)}",
                extra={"user_id": str(user.id), "error": str(e)}
            )
            return 0, TrustScoreFactors()

    async def _calculate_email_domain_score(
        self,
        email: str,
        user: User,
        session: AsyncSession
    ) -> int:
        """Calculate score based on email domain trustworthiness."""
        if not email:
            return 0

        domain = email.lower().split('@')[-1]

        # Check for educational domains (.edu, etc.)
        for edu_domain in self.educational_domains:
            if domain.endswith(edu_domain):
                # Verify if actually verified
                verification = await self._get_verification_status(
                    user.id, VerificationType.DOMAIN, session
                )
                return 95 if verification == VerificationStatus.VERIFIED else 75

        # Check for government domains
        for gov_domain in self.government_domains:
            if domain.endswith(gov_domain):
                verification = await self._get_verification_status(
                    user.id, VerificationType.DOMAIN, session
                )
                return 90 if verification == VerificationStatus.VERIFIED else 70

        # Check for corporate domains
        if domain in self.corporate_domains:
            verification = await self._get_verification_status(
                user.id, VerificationType.DOMAIN, session
            )
            return 80 if verification == VerificationStatus.VERIFIED else 60

        # Check for suspicious domains
        if domain in self.suspicious_domains:
            return 5

        # Generic domains (Gmail, Yahoo, etc.)
        generic_domains = {'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'}
        if domain in generic_domains:
            # Base score for generic email providers
            verification = await self._get_verification_status(
                user.id, VerificationType.EMAIL, session
            )
            return 40 if verification == VerificationStatus.VERIFIED else 20

        # Unknown domain - moderate score if verified
        verification = await self._get_verification_status(
            user.id, VerificationType.EMAIL, session
        )
        return 30 if verification == VerificationStatus.VERIFIED else 15

    async def _calculate_github_score(
        self,
        github_url: Optional[str],
        user: User,
        session: AsyncSession
    ) -> int:
        """Calculate score based on GitHub profile activity."""
        if not github_url:
            return 0

        try:
            # Extract username from URL
            username_match = re.search(r'github\.com/([^/]+)', github_url)
            if not username_match:
                return 0

            # Check if GitHub verification exists
            verification = await self._get_verification_status(
                user.id, VerificationType.GITHUB, session
            )

            if verification != VerificationStatus.VERIFIED:
                return 25  # Base score for having GitHub URL

            # Get GitHub data from verification
            github_data = await self._get_verification_data(
                user.id, VerificationType.GITHUB, session
            )

            if not github_data:
                return 25

            score = 0

            # Public repositories (0-25 points)
            public_repos = github_data.get('public_repos', 0)
            if public_repos > 0:
                score += min(25, public_repos * 2)

            # Followers (0-20 points)
            followers = github_data.get('followers', 0)
            if followers > 0:
                score += min(20, followers)

            # Account age (0-20 points)
            created_at = github_data.get('created_at')
            if created_at:
                try:
                    account_age = datetime.now() - datetime.fromisoformat(
                        created_at.replace('Z', '+00:00')
                    )
                    years = account_age.days / 365.25
                    score += min(20, int(years * 5))
                except Exception:
                    pass

            # Recent activity (0-15 points)
            updated_at = github_data.get('updated_at')
            if updated_at:
                try:
                    last_update = datetime.now() - datetime.fromisoformat(
                        updated_at.replace('Z', '+00:00')
                    )
                    if last_update.days < 30:
                        score += 15
                    elif last_update.days < 90:
                        score += 10
                    elif last_update.days < 180:
                        score += 5
                except Exception:
                    pass

            # Hireable status (0-10 points)
            if github_data.get('hireable'):
                score += 10

            # Bio and company info (0-10 points)
            if github_data.get('bio') or github_data.get('company'):
                score += 10

            return min(100, score)

        except Exception as e:
            logger.error(f"Error calculating GitHub score: {str(e)}")
            return 15 if github_url else 0

    async def _calculate_linkedin_score(
        self,
        linkedin_url: Optional[str],
        user: User,
        session: AsyncSession
    ) -> int:
        """Calculate score based on LinkedIn profile completeness."""
        if not linkedin_url:
            return 0

        try:
            # Check if LinkedIn verification exists
            verification = await self._get_verification_status(
                user.id, VerificationType.LINKEDIN, session
            )

            if verification != VerificationStatus.VERIFIED:
                return 20  # Base score for having LinkedIn URL

            # Get LinkedIn data from verification
            linkedin_data = await self._get_verification_data(
                user.id, VerificationType.LINKEDIN, session
            )

            if not linkedin_data:
                return 20

            score = 20  # Base score

            # Profile completeness indicators
            if linkedin_data.get('headline'):
                score += 15
            if linkedin_data.get('summary'):
                score += 15
            if linkedin_data.get('experience') and len(linkedin_data['experience']) > 0:
                score += 20
            if linkedin_data.get('education') and len(linkedin_data['education']) > 0:
                score += 15
            if linkedin_data.get('skills') and len(linkedin_data['skills']) > 5:
                score += 10
            if linkedin_data.get('connections') and linkedin_data['connections'] > 100:
                score += 5

            return min(100, score)

        except Exception as e:
            logger.error(f"Error calculating LinkedIn score: {str(e)}")
            return 15 if linkedin_url else 0

    async def _calculate_portfolio_score(self, user: User, session: AsyncSession) -> int:
        """Calculate score based on portfolio and proof of work quality."""
        score = 0

        # Portfolio URL presence (0-40 points)
        if user.portfolio_url:
            score += 40

        # Professional URLs (0-30 points total)
        professional_urls = [
            user.linkedin_url, user.github_url, user.twitter_url,
            user.calendly_url, user.video_intro_url
        ]
        url_count = sum(1 for url in professional_urls if url)
        score += min(30, url_count * 6)

        # Professional experience indicators (0-20 points)
        if user.experience_years and user.experience_years > 0:
            score += min(15, user.experience_years * 2)

        if user.previous_startups and user.previous_startups > 0:
            score += min(10, user.previous_startups * 5)

        # Education and accomplishments (0-10 points)
        if user.education_history and len(user.education_history) > 50:
            score += 5
        if user.impressive_accomplishment and len(user.impressive_accomplishment) > 50:
            score += 5

        return min(100, score)

    async def _calculate_tenure_score(self, user: User, session: AsyncSession) -> int:
        """Calculate score based on time on platform and activity."""
        if not user.created_at:
            return 0

        # Time since account creation
        account_age = datetime.utcnow() - user.created_at
        days_on_platform = account_age.days

        # Progressive scoring based on tenure
        if days_on_platform < 7:
            return 10
        elif days_on_platform < 30:
            return 30
        elif days_on_platform < 90:
            return 50
        elif days_on_platform < 180:
            return 70
        elif days_on_platform < 365:
            return 85
        else:
            return 100

    async def _calculate_engagement_score(self, user: User, session: AsyncSession) -> int:
        """Calculate score based on platform engagement metrics."""
        score = 0

        # Profile completeness (0-30 points)
        profile_fields = [
            user.introduction, user.location, user.life_story, user.hobbies,
            user.education_history, user.employment_history, user.startup_description,
            user.looking_for_description, user.areas_of_ownership
        ]
        completed_fields = sum(1 for field in profile_fields if field)
        score += min(30, completed_fields * 3)

        # Settings and preferences (0-20 points)
        if user.settings:
            score += 10
        if user.behavior_agreement_accepted_at:
            score += 10

        # Profile status (0-20 points)
        if user.profile_status == "complete":
            score += 20
        elif user.profile_status == "partial":
            score += 10

        # Recent activity indicators (0-30 points)
        if user.updated_at:
            days_since_update = (datetime.utcnow() - user.updated_at).days
            if days_since_update < 7:
                score += 30
            elif days_since_update < 30:
                score += 20
            elif days_since_update < 90:
                score += 10

        return min(100, score)

    async def _calculate_intro_acceptance_rate(
        self,
        user: User,
        session: AsyncSession
    ) -> float:
        """Calculate introduction request acceptance rate."""
        try:
            # Count total intro requests sent by this user
            total_intros = await session.execute(
                select(func.count(Match.id)).where(
                    and_(
                        Match.requester_id == user.id,
                        Match.status.in_(['pending', 'accepted', 'declined'])
                    )
                )
            )
            total_count = total_intros.scalar() or 0

            if total_count == 0:
                return 0.5  # Neutral rate for new users

            # Count accepted intros
            accepted_intros = await session.execute(
                select(func.count(Match.id)).where(
                    and_(
                        Match.requester_id == user.id,
                        Match.status == 'accepted'
                    )
                )
            )
            accepted_count = accepted_intros.scalar() or 0

            return accepted_count / total_count

        except Exception as e:
            logger.error(f"Error calculating intro acceptance rate: {str(e)}")
            return 0.0

    async def _calculate_report_penalty(self, user: User, session: AsyncSession) -> int:
        """Calculate penalty points based on reports received."""
        try:
            # Count reports against this user
            reports = await session.execute(
                select(func.count(Report.id)).where(Report.reported_user_id == user.id)
            )
            report_count = reports.scalar() or 0

            # Progressive penalty system
            if report_count == 0:
                return 0
            elif report_count == 1:
                return 10
            elif report_count <= 3:
                return 25
            elif report_count <= 5:
                return 50
            else:
                return 75  # Heavy penalty for multiple reports

        except Exception as e:
            logger.error(f"Error calculating report penalty: {str(e)}")
            return 0

    async def _get_verification_status(
        self,
        user_id: str,
        verification_type: VerificationType,
        session: AsyncSession
    ) -> Optional[VerificationStatus]:
        """Get the current verification status for a user and type."""
        try:
            result = await session.execute(
                select(UserVerification.status).where(
                    and_(
                        UserVerification.user_id == user_id,
                        UserVerification.verification_type == verification_type.value
                    )
                ).order_by(UserVerification.created_at.desc())
            )
            return result.scalar()
        except Exception:
            return None

    async def _get_verification_data(
        self,
        user_id: str,
        verification_type: VerificationType,
        session: AsyncSession
    ) -> Optional[Dict]:
        """Get verification data for a user and type."""
        try:
            result = await session.execute(
                select(UserVerification.verification_data).where(
                    and_(
                        UserVerification.user_id == user_id,
                        UserVerification.verification_type == verification_type.value,
                        UserVerification.status == VerificationStatus.VERIFIED.value
                    )
                ).order_by(UserVerification.created_at.desc())
            )
            return result.scalar()
        except Exception:
            return None

    async def save_trust_score(
        self,
        user: User,
        overall_score: int,
        factors: TrustScoreFactors,
        session: AsyncSession
    ) -> UserTrustScore:
        """Save calculated trust score to database."""
        try:
            # Check if trust score record exists
            existing_score = await session.execute(
                select(UserTrustScore).where(UserTrustScore.user_id == user.id)
            )
            trust_score_record = existing_score.scalar_one_or_none()

            factor_breakdown = {
                'email_domain_score': factors.email_domain_score,
                'github_activity_score': factors.github_activity_score,
                'linkedin_completeness_score': factors.linkedin_completeness_score,
                'portfolio_quality_score': factors.portfolio_quality_score,
                'platform_tenure_score': factors.platform_tenure_score,
                'engagement_score': factors.engagement_score,
                'intro_acceptance_rate': factors.intro_acceptance_rate,
                'report_penalty': factors.report_penalty,
                'calculation_timestamp': datetime.utcnow().isoformat()
            }

            if trust_score_record:
                # Update existing record
                trust_score_record.score = overall_score
                trust_score_record.email_domain_score = factors.email_domain_score
                trust_score_record.github_activity_score = factors.github_activity_score
                trust_score_record.linkedin_completeness_score = factors.linkedin_completeness_score
                trust_score_record.portfolio_quality_score = factors.portfolio_quality_score
                trust_score_record.platform_tenure_score = factors.platform_tenure_score
                trust_score_record.engagement_score = factors.engagement_score
                trust_score_record.intro_acceptance_rate = factors.intro_acceptance_rate
                trust_score_record.report_penalty = factors.report_penalty
                trust_score_record.score_factors = factor_breakdown
                trust_score_record.last_calculated = datetime.utcnow()
                trust_score_record.updated_at = datetime.utcnow()
            else:
                # Create new record
                trust_score_record = UserTrustScore(
                    user_id=user.id,
                    score=overall_score,
                    email_domain_score=factors.email_domain_score,
                    github_activity_score=factors.github_activity_score,
                    linkedin_completeness_score=factors.linkedin_completeness_score,
                    portfolio_quality_score=factors.portfolio_quality_score,
                    platform_tenure_score=factors.platform_tenure_score,
                    engagement_score=factors.engagement_score,
                    intro_acceptance_rate=factors.intro_acceptance_rate,
                    report_penalty=factors.report_penalty,
                    score_factors=factor_breakdown,
                    last_calculated=datetime.utcnow(),
                    calculation_version="1.0"
                )
                session.add(trust_score_record)

            await session.commit()
            await session.refresh(trust_score_record)

            return trust_score_record

        except Exception as e:
            await session.rollback()
            logger.error(f"Error saving trust score: {str(e)}")
            raise


# Background job functions
async def recalculate_all_trust_scores():
    """Background job to recalculate all user trust scores."""
    calculator = TrustScoreCalculator()

    async for session in get_database_session():
        try:
            # Get all active users
            users_result = await session.execute(
                select(User).where(
                    and_(User.is_active, ~User.is_banned)
                )
            )
            users = users_result.scalars().all()

            logger.info(f"Starting trust score recalculation for {len(users)} users")

            for user in users:
                try:
                    overall_score, factors = await calculator.calculate_user_trust_score(
                        user, session
                    )
                    await calculator.save_trust_score(user, overall_score, factors, session)

                    # Small delay to avoid overwhelming external APIs
                    await asyncio.sleep(0.1)

                except Exception as e:
                    logger.error(
                        f"Error recalculating trust score for user {user.id}: {str(e)}"
                    )
                    continue

            logger.info("Completed trust score recalculation for all users")

        except Exception as e:
            logger.error(f"Error in trust score recalculation job: {str(e)}")
            raise
        finally:
            await session.close()


async def recalculate_user_trust_score(user_id: str) -> Optional[UserTrustScore]:
    """Recalculate trust score for a specific user."""
    calculator = TrustScoreCalculator()

    async for session in get_database_session():
        try:
            # Get user
            user_result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()

            if not user:
                logger.warning(f"User not found: {user_id}")
                return None

            overall_score, factors = await calculator.calculate_user_trust_score(
                user, session
            )

            return await calculator.save_trust_score(
                user, overall_score, factors, session
            )

        except Exception as e:
            logger.error(f"Error recalculating trust score for user {user_id}: {str(e)}")
            return None
        finally:
            await session.close()