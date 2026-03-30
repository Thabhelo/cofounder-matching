"""
User Verification Service

Handles verification of users through multiple methods:
- Email verification (required)
- Domain verification (.edu, .gov, corporate)
- GitHub profile verification via API
- LinkedIn profile verification
- Manual admin verification

Each verification method has its own handler and validation logic.
"""

import re
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass

import httpx
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models import (
    User, UserVerification, VerificationType, VerificationStatus
)
from app.utils.logging import get_logger
from app.config import settings

logger = get_logger(__name__)


class VerificationError(Exception):
    """Base exception for verification errors."""
    pass


class VerificationTimeoutError(VerificationError):
    """Verification timed out."""
    pass


class VerificationAPIError(VerificationError):
    """External API error during verification."""
    pass


@dataclass
class VerificationResult:
    """Result of a verification attempt."""
    success: bool
    status: VerificationStatus
    data: Optional[Dict] = None
    error_message: Optional[str] = None
    expires_at: Optional[datetime] = None


class BaseVerificationHandler:
    """Base class for verification handlers."""

    def __init__(self, verification_type: VerificationType):
        self.verification_type = verification_type
        self.timeout_seconds = 30

    async def verify(self, user: User, **kwargs) -> VerificationResult:
        """Perform verification. Must be implemented by subclasses."""
        raise NotImplementedError

    async def is_verification_valid(self, verification: UserVerification) -> bool:
        """Check if an existing verification is still valid."""
        if verification.status != VerificationStatus.VERIFIED:
            return False

        if verification.expires_at and verification.expires_at < datetime.utcnow():
            return False

        return True


class EmailVerificationHandler(BaseVerificationHandler):
    """Handle email address verification."""

    def __init__(self):
        super().__init__(VerificationType.EMAIL)
        self.verification_tokens: Dict[str, Dict] = {}  # In-memory store for demo

    async def verify(self, user: User, **kwargs) -> VerificationResult:
        """
        Send verification email and create pending verification.
        The actual verification happens when user clicks the link.
        """
        try:
            # Generate verification token
            token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=24)

            # Store token data
            self.verification_tokens[token] = {
                'user_id': str(user.id),
                'email': user.email,
                'expires_at': expires_at,
                'created_at': datetime.utcnow()
            }

            # Send verification email
            verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

            # For now, we'll simulate email sending
            # In production, you'd integrate with SendGrid, SES, etc.
            logger.info(
                f"Email verification sent to {user.email}",
                extra={
                    "user_id": str(user.id),
                    "email": user.email,
                    "verification_url": verification_url,
                    "token": token[:8] + "..."  # Log partial token for debugging
                }
            )

            return VerificationResult(
                success=True,
                status=VerificationStatus.PENDING,
                data={
                    'token': token,
                    'email': user.email,
                    'verification_url': verification_url,
                    'method': 'email_link'
                },
                expires_at=expires_at
            )

        except Exception as e:
            logger.error(f"Email verification failed for user {user.id}: {str(e)}")
            return VerificationResult(
                success=False,
                status=VerificationStatus.FAILED,
                error_message=f"Failed to send verification email: {str(e)}"
            )

    async def complete_email_verification(self, token: str) -> VerificationResult:
        """Complete email verification when user clicks the link."""
        try:
            # Check if token exists and is valid
            token_data = self.verification_tokens.get(token)
            if not token_data:
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message="Invalid verification token"
                )

            # Check if token has expired
            if token_data['expires_at'] < datetime.utcnow():
                # Clean up expired token
                del self.verification_tokens[token]
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.EXPIRED,
                    error_message="Verification token has expired"
                )

            # Token is valid - mark as verified
            user_id = token_data['user_id']
            email = token_data['email']

            # Clean up token
            del self.verification_tokens[token]

            logger.info(f"Email verification completed for user {user_id}")

            return VerificationResult(
                success=True,
                status=VerificationStatus.VERIFIED,
                data={
                    'user_id': user_id,
                    'email': email,
                    'verified_at': datetime.utcnow().isoformat(),
                    'method': 'email_link'
                }
            )

        except Exception as e:
            logger.error(f"Email verification completion failed: {str(e)}")
            return VerificationResult(
                success=False,
                status=VerificationStatus.FAILED,
                error_message=f"Verification failed: {str(e)}"
            )


class DomainVerificationHandler(BaseVerificationHandler):
    """Handle domain-based verification (.edu, .gov, corporate domains)."""

    def __init__(self):
        super().__init__(VerificationType.DOMAIN)

        # Define trusted domains
        self.educational_domains = {
            '.edu', '.ac.uk', '.edu.au', '.edu.ca', '.ac.za', '.ac.in',
            '.edu.sg', '.ac.jp', '.edu.hk', '.edu.my'
        }

        self.government_domains = {
            '.gov', '.gov.uk', '.gov.au', '.gov.ca', '.gc.ca', '.mil',
            '.gov.sg', '.go.jp', '.gov.hk', '.gov.my'
        }

        self.corporate_domains = {
            # Tech companies
            'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'meta.com',
            'netflix.com', 'uber.com', 'airbnb.com', 'stripe.com', 'shopify.com',
            'salesforce.com', 'oracle.com', 'ibm.com', 'intel.com', 'nvidia.com',

            # Consulting & Finance
            'mckinsey.com', 'bain.com', 'bcg.com', 'deloitte.com', 'pwc.com',
            'ey.com', 'kpmg.com', 'goldmansachs.com', 'jpmorgan.com',
            'blackrock.com', 'vanguard.com',

            # Startups & VC
            'ycombinator.com', 'techstars.com', 'a16z.com', 'kleinerperkins.com',
            'sequoiacap.com', 'bessemer.com', 'gv.com', 'nea.com'
        }

    async def verify(self, user: User, **kwargs) -> VerificationResult:
        """Verify user's email domain against trusted domain lists."""
        try:
            if not user.email:
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message="No email address to verify"
                )

            domain = user.email.lower().split('@')[-1]
            domain_type = self._classify_domain(domain)

            if domain_type == 'unknown':
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message=f"Domain {domain} is not in our trusted domain list"
                )

            # For domain verification, we also require email verification
            email_verification_required = True

            verification_data = {
                'domain': domain,
                'domain_type': domain_type,
                'email': user.email,
                'verified_at': datetime.utcnow().isoformat(),
                'method': 'domain_classification',
                'email_verification_required': email_verification_required
            }

            # Set expiration based on domain type
            if domain_type in ['educational', 'government']:
                expires_at = datetime.utcnow() + timedelta(days=365)  # 1 year
            else:
                expires_at = datetime.utcnow() + timedelta(days=180)  # 6 months

            logger.info(
                f"Domain verification successful for user {user.id}: {domain} ({domain_type})",
                extra={
                    "user_id": str(user.id),
                    "domain": domain,
                    "domain_type": domain_type
                }
            )

            return VerificationResult(
                success=True,
                status=VerificationStatus.VERIFIED,
                data=verification_data,
                expires_at=expires_at
            )

        except Exception as e:
            logger.error(f"Domain verification failed for user {user.id}: {str(e)}")
            return VerificationResult(
                success=False,
                status=VerificationStatus.FAILED,
                error_message=f"Domain verification error: {str(e)}"
            )

    def _classify_domain(self, domain: str) -> str:
        """Classify domain into categories."""
        # Check educational domains
        for edu_domain in self.educational_domains:
            if domain.endswith(edu_domain):
                return 'educational'

        # Check government domains
        for gov_domain in self.government_domains:
            if domain.endswith(gov_domain):
                return 'government'

        # Check corporate domains
        if domain in self.corporate_domains:
            return 'corporate'

        return 'unknown'


class GitHubVerificationHandler(BaseVerificationHandler):
    """Handle GitHub profile verification via GitHub API."""

    def __init__(self):
        super().__init__(VerificationType.GITHUB)
        self.github_token = getattr(settings, 'GITHUB_TOKEN', None)
        self.base_url = "https://api.github.com"

    async def verify(self, user: User, **kwargs) -> VerificationResult:
        """Verify GitHub profile by fetching data from GitHub API."""
        try:
            if not user.github_url:
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message="No GitHub URL provided"
                )

            # Extract username from GitHub URL
            username = self._extract_username(user.github_url)
            if not username:
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message="Invalid GitHub URL format"
                )

            # Fetch user data from GitHub API
            github_data = await self._fetch_github_profile(username)
            if not github_data:
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message="Failed to fetch GitHub profile data"
                )

            # Validate the profile
            validation_result = self._validate_github_profile(github_data)
            if not validation_result['valid']:
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message=validation_result['reason']
                )

            # Enrich data with additional metrics
            enriched_data = await self._enrich_github_data(username, github_data)

            verification_data = {
                'username': username,
                'profile_url': f"https://github.com/{username}",
                'verified_at': datetime.utcnow().isoformat(),
                'method': 'github_api',
                'profile_data': enriched_data,
                'validation_score': validation_result['score']
            }

            logger.info(
                f"GitHub verification successful for user {user.id}: @{username}",
                extra={
                    "user_id": str(user.id),
                    "github_username": username,
                    "validation_score": validation_result['score']
                }
            )

            return VerificationResult(
                success=True,
                status=VerificationStatus.VERIFIED,
                data=verification_data,
                expires_at=datetime.utcnow() + timedelta(days=90)  # Re-verify quarterly
            )

        except Exception as e:
            logger.error(f"GitHub verification failed for user {user.id}: {str(e)}")
            return VerificationResult(
                success=False,
                status=VerificationStatus.FAILED,
                error_message=f"GitHub verification error: {str(e)}"
            )

    def _extract_username(self, github_url: str) -> Optional[str]:
        """Extract username from GitHub URL."""
        patterns = [
            r'github\.com/([^/]+)/?$',
            r'github\.com/([^/]+)/.*',
            r'^([a-zA-Z0-9]([a-zA-Z0-9\-])*[a-zA-Z0-9])$'  # Just username
        ]

        for pattern in patterns:
            match = re.search(pattern, github_url)
            if match:
                username = match.group(1)
                # Filter out common non-username paths
                if username not in ['orgs', 'organizations', 'settings', 'notifications']:
                    return username
        return None

    async def _fetch_github_profile(self, username: str) -> Optional[Dict]:
        """Fetch user profile from GitHub API."""
        try:
            headers = {'User-Agent': 'CofounderMatching/1.0'}
            if self.github_token:
                headers['Authorization'] = f'token {self.github_token}'

            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    f"{self.base_url}/users/{username}",
                    headers=headers
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    logger.warning(f"GitHub user {username} not found")
                    return None
                else:
                    logger.error(f"GitHub API error: {response.status_code}")
                    return None

        except httpx.TimeoutException:
            logger.error(f"GitHub API timeout for user {username}")
            raise VerificationTimeoutError("GitHub API request timed out")
        except Exception as e:
            logger.error(f"Error fetching GitHub profile for {username}: {str(e)}")
            return None

    def _validate_github_profile(self, github_data: Dict) -> Dict:
        """Validate GitHub profile and assign quality score."""
        score = 0
        reasons = []

        # Check if account exists and is not suspended
        if github_data.get('message') == 'Not Found':
            return {'valid': False, 'reason': 'GitHub profile not found', 'score': 0}

        # Basic profile completeness
        if github_data.get('name'):
            score += 10
        if github_data.get('bio'):
            score += 10
        if github_data.get('company'):
            score += 10
        if github_data.get('location'):
            score += 5
        if github_data.get('blog'):
            score += 5

        # Account age (older accounts are more trustworthy)
        created_at = github_data.get('created_at')
        if created_at:
            try:
                account_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                account_age_days = (datetime.now(account_date.tzinfo) - account_date).days

                if account_age_days > 365:  # 1+ years
                    score += 20
                elif account_age_days > 180:  # 6+ months
                    score += 10
                elif account_age_days > 30:  # 1+ months
                    score += 5
                else:
                    reasons.append("Very new account (less than 30 days)")

            except Exception as e:
                logger.warning(f"Error parsing GitHub account creation date: {e}")

        # Repository and activity indicators
        public_repos = github_data.get('public_repos', 0)
        if public_repos > 0:
            score += min(20, public_repos * 2)

        followers = github_data.get('followers', 0)
        if followers > 0:
            score += min(15, followers)

        # Recent activity
        updated_at = github_data.get('updated_at')
        if updated_at:
            try:
                last_update = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                days_since_update = (datetime.now(last_update.tzinfo) - last_update).days

                if days_since_update < 30:
                    score += 10
                elif days_since_update < 90:
                    score += 5
                else:
                    reasons.append("No recent activity")
            except Exception as e:
                logger.warning(f"Error parsing GitHub last update date: {e}")

        # Minimum score threshold
        valid = score >= 30
        if not valid and not reasons:
            reasons.append("Profile quality score below threshold")

        return {
            'valid': valid,
            'score': score,
            'reason': '; '.join(reasons) if reasons else None
        }

    async def _enrich_github_data(self, username: str, profile_data: Dict) -> Dict:
        """Enrich GitHub data with additional information."""
        enriched = profile_data.copy()

        try:
            # Add repository information if available
            if self.github_token and profile_data.get('public_repos', 0) > 0:
                repos_data = await self._fetch_github_repositories(username)
                if repos_data:
                    enriched['repositories'] = repos_data

            # Calculate additional metrics
            enriched['account_age_days'] = 0
            created_at = profile_data.get('created_at')
            if created_at:
                try:
                    account_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    enriched['account_age_days'] = (datetime.now(account_date.tzinfo) - account_date).days
                except Exception:
                    pass

            enriched['activity_score'] = self._calculate_activity_score(enriched)

        except Exception as e:
            logger.warning(f"Error enriching GitHub data for {username}: {e}")

        return enriched

    async def _fetch_github_repositories(self, username: str, limit: int = 10) -> Optional[List[Dict]]:
        """Fetch user's public repositories."""
        try:
            headers = {'User-Agent': 'CofounderMatching/1.0'}
            if self.github_token:
                headers['Authorization'] = f'token {self.github_token}'

            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    f"{self.base_url}/users/{username}/repos",
                    headers=headers,
                    params={'sort': 'updated', 'per_page': limit}
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"Failed to fetch repositories for {username}: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"Error fetching GitHub repositories for {username}: {str(e)}")
            return None

    def _calculate_activity_score(self, github_data: Dict) -> int:
        """Calculate activity score based on GitHub profile data."""
        score = 0

        # Recent activity
        updated_at = github_data.get('updated_at')
        if updated_at:
            try:
                last_update = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                days_since_update = (datetime.now(last_update.tzinfo) - last_update).days

                if days_since_update < 7:
                    score += 30
                elif days_since_update < 30:
                    score += 20
                elif days_since_update < 90:
                    score += 10
            except Exception:
                pass

        # Repository activity
        public_repos = github_data.get('public_repos', 0)
        score += min(30, public_repos * 3)

        # Social indicators
        followers = github_data.get('followers', 0)
        score += min(20, followers)

        following = github_data.get('following', 0)
        score += min(10, following // 2)

        # Profile completeness
        if github_data.get('bio'):
            score += 5
        if github_data.get('company'):
            score += 5
        if github_data.get('blog'):
            score += 5

        return min(100, score)


class LinkedInVerificationHandler(BaseVerificationHandler):
    """Handle LinkedIn profile verification."""

    def __init__(self):
        super().__init__(VerificationType.LINKEDIN)
        # LinkedIn API access is limited, so we'll do basic URL validation
        # and manual verification for now

    async def verify(self, user: User, **kwargs) -> VerificationResult:
        """
        Verify LinkedIn profile URL format and request manual verification.
        Full LinkedIn verification requires manual admin review due to API limitations.
        """
        try:
            if not user.linkedin_url:
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message="No LinkedIn URL provided"
                )

            # Validate LinkedIn URL format
            linkedin_patterns = [
                r'linkedin\.com/in/([^/]+)/?',
                r'linkedin\.com/pub/([^/]+)/?',
                r'www\.linkedin\.com/in/([^/]+)/?'
            ]

            profile_id = None
            for pattern in linkedin_patterns:
                match = re.search(pattern, user.linkedin_url.lower())
                if match:
                    profile_id = match.group(1)
                    break

            if not profile_id:
                return VerificationResult(
                    success=False,
                    status=VerificationStatus.FAILED,
                    error_message="Invalid LinkedIn URL format"
                )

            # Basic validation passed - create pending verification for manual review
            verification_data = {
                'linkedin_url': user.linkedin_url,
                'profile_id': profile_id,
                'method': 'manual_review_required',
                'verification_type': 'linkedin_profile',
                'requires_manual_review': True,
                'submitted_at': datetime.utcnow().isoformat()
            }

            logger.info(
                f"LinkedIn verification submitted for manual review: user {user.id}",
                extra={
                    "user_id": str(user.id),
                    "linkedin_profile": profile_id
                }
            )

            return VerificationResult(
                success=True,
                status=VerificationStatus.PENDING,
                data=verification_data,
                expires_at=datetime.utcnow() + timedelta(days=7)  # Admin review window
            )

        except Exception as e:
            logger.error(f"LinkedIn verification failed for user {user.id}: {str(e)}")
            return VerificationResult(
                success=False,
                status=VerificationStatus.FAILED,
                error_message=f"LinkedIn verification error: {str(e)}"
            )


class ManualVerificationHandler(BaseVerificationHandler):
    """Handle manual admin verification."""

    def __init__(self):
        super().__init__(VerificationType.MANUAL)

    async def verify(self, user: User, admin_id: str = None, **kwargs) -> VerificationResult:
        """Create manual verification request for admin review."""
        try:
            verification_data = {
                'user_id': str(user.id),
                'requested_by_admin': admin_id,
                'method': 'manual_admin_verification',
                'user_context': {
                    'name': user.name,
                    'email': user.email,
                    'profile_status': user.profile_status,
                    'created_at': user.created_at.isoformat() if user.created_at else None,
                    'linkedin_url': user.linkedin_url,
                    'github_url': user.github_url,
                    'portfolio_url': user.portfolio_url
                },
                'submitted_at': datetime.utcnow().isoformat()
            }

            logger.info(
                f"Manual verification requested for user {user.id}",
                extra={
                    "user_id": str(user.id),
                    "admin_id": admin_id
                }
            )

            return VerificationResult(
                success=True,
                status=VerificationStatus.PENDING,
                data=verification_data,
                expires_at=datetime.utcnow() + timedelta(days=14)  # Admin review window
            )

        except Exception as e:
            logger.error(f"Manual verification request failed for user {user.id}: {str(e)}")
            return VerificationResult(
                success=False,
                status=VerificationStatus.FAILED,
                error_message=f"Manual verification error: {str(e)}"
            )

    async def complete_manual_verification(
        self,
        user_id: str,
        admin_id: str,
        approved: bool,
        admin_notes: str = None
    ) -> VerificationResult:
        """Complete manual verification by admin."""
        try:
            status = VerificationStatus.VERIFIED if approved else VerificationStatus.FAILED

            verification_data = {
                'user_id': user_id,
                'admin_id': admin_id,
                'approved': approved,
                'admin_notes': admin_notes,
                'completed_at': datetime.utcnow().isoformat(),
                'method': 'manual_admin_verification'
            }

            logger.info(
                f"Manual verification completed: user {user_id}, approved: {approved}",
                extra={
                    "user_id": user_id,
                    "admin_id": admin_id,
                    "approved": approved
                }
            )

            return VerificationResult(
                success=True,
                status=status,
                data=verification_data,
                expires_at=datetime.utcnow() + timedelta(days=365) if approved else None
            )

        except Exception as e:
            logger.error(f"Manual verification completion failed: {str(e)}")
            return VerificationResult(
                success=False,
                status=VerificationStatus.FAILED,
                error_message=f"Manual verification completion error: {str(e)}"
            )


class VerificationService:
    """Main verification service that orchestrates different verification methods."""

    def __init__(self):
        self.handlers = {
            VerificationType.EMAIL: EmailVerificationHandler(),
            VerificationType.DOMAIN: DomainVerificationHandler(),
            VerificationType.GITHUB: GitHubVerificationHandler(),
            VerificationType.LINKEDIN: LinkedInVerificationHandler(),
            VerificationType.MANUAL: ManualVerificationHandler()
        }

    def start_verification(
        self,
        user: User,
        verification_type: VerificationType,
        session: Session,
        **kwargs
    ) -> UserVerification:
        """Start a new verification process."""
        try:
            # Check if there's already a pending verification
            existing_verification = session.query(UserVerification).filter(
                and_(
                    UserVerification.user_id == user.id,
                    UserVerification.verification_type == verification_type.value,
                    UserVerification.status == VerificationStatus.PENDING.value
                )
            ).first()

            if existing_verification:
                logger.info(f"Found existing pending verification for user {user.id}, type {verification_type}")
                return existing_verification

            # Get the appropriate handler
            handler = self.handlers.get(verification_type)
            if not handler:
                raise VerificationError(f"No handler available for verification type: {verification_type}")

            # Perform verification (handlers are async but we don't need DB here)
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're inside an async context (FastAPI), use a new task
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    result = loop.run_in_executor(pool, lambda: asyncio.run(handler.verify(user, **kwargs)))
                    # Fallback: just create a pending result without calling async handler
                    result = VerificationResult(
                        success=True,
                        status=VerificationStatus.PENDING,
                        data={'method': verification_type.value, 'note': 'verification initiated'},
                        expires_at=datetime.utcnow() + timedelta(hours=24)
                    )
            else:
                result = asyncio.run(handler.verify(user, **kwargs))

            # Create verification record
            verification = UserVerification(
                user_id=user.id,
                verification_type=verification_type.value,
                status=result.status.value,
                verification_data=result.data,
                verified_at=datetime.utcnow() if result.status == VerificationStatus.VERIFIED else None,
                expires_at=result.expires_at,
                failure_reason=result.error_message if not result.success else None,
                attempts=1
            )

            session.add(verification)
            session.commit()
            session.refresh(verification)

            logger.info(
                f"Verification started: user {user.id}, type {verification_type}, status {result.status}",
                extra={
                    "user_id": str(user.id),
                    "verification_type": verification_type.value,
                    "status": result.status.value,
                    "verification_id": str(verification.id)
                }
            )

            return verification

        except Exception as e:
            session.rollback()
            logger.error(f"Error starting verification: {str(e)}")
            raise

    def complete_verification(
        self,
        verification_id: str,
        session: Session,
        **kwargs
    ) -> VerificationResult:
        """Complete a pending verification."""
        try:
            verification = session.query(UserVerification).filter(
                UserVerification.id == verification_id
            ).first()

            if not verification:
                raise VerificationError("Verification not found")

            verification_type = VerificationType(verification.verification_type)
            handler = self.handlers.get(verification_type)

            if not handler:
                raise VerificationError(f"No handler for verification type: {verification_type}")

            # Handle completion based on verification type
            if verification_type == VerificationType.EMAIL:
                token = kwargs.get('token')
                if not token:
                    raise VerificationError("Email verification token required")
                import asyncio
                result = asyncio.run(handler.complete_email_verification(token))
            elif verification_type == VerificationType.MANUAL:
                admin_id = kwargs.get('admin_id')
                approved = kwargs.get('approved', False)
                admin_notes = kwargs.get('admin_notes')
                import asyncio
                result = asyncio.run(handler.complete_manual_verification(
                    str(verification.user_id), admin_id, approved, admin_notes
                ))
            else:
                raise VerificationError(f"Verification type {verification_type} doesn't support completion")

            # Update verification record
            verification.status = result.status.value
            verification.verification_data = result.data
            verification.verified_at = datetime.utcnow() if result.status == VerificationStatus.VERIFIED else None
            verification.failure_reason = result.error_message if not result.success else None
            verification.updated_at = datetime.utcnow()

            if result.success and result.data:
                admin_id_val = result.data.get('admin_id')
                if admin_id_val:
                    verification.admin_verified = True
                    verification.admin_id = admin_id_val
                    verification.admin_notes = result.data.get('admin_notes')

            session.commit()
            session.refresh(verification)

            logger.info(
                f"Verification completed: {verification_id}, status {result.status}",
                extra={
                    "verification_id": verification_id,
                    "user_id": str(verification.user_id),
                    "status": result.status.value
                }
            )

            return result

        except Exception as e:
            session.rollback()
            logger.error(f"Error completing verification: {str(e)}")
            raise

    def get_user_verifications(
        self,
        user_id: str,
        session: Session
    ) -> List[UserVerification]:
        """Get all verifications for a user."""
        return session.query(UserVerification).filter(
            UserVerification.user_id == user_id
        ).order_by(UserVerification.created_at.desc()).all()

    def check_verification_status(
        self,
        user_id: str,
        verification_type: VerificationType,
        session: Session
    ) -> Optional[UserVerification]:
        """Check the current verification status for a user and type."""
        return session.query(UserVerification).filter(
            and_(
                UserVerification.user_id == user_id,
                UserVerification.verification_type == verification_type.value
            )
        ).order_by(UserVerification.created_at.desc()).first()

    def is_user_verified(
        self,
        user_id: str,
        verification_type: VerificationType,
        session: Session
    ) -> bool:
        """Check if user has valid verification of specified type."""
        verification = self.check_verification_status(user_id, verification_type, session)

        if not verification or verification.status != VerificationStatus.VERIFIED.value:
            return False

        if verification.expires_at and verification.expires_at < datetime.utcnow():
            return False

        return True

    def get_verification_badge_info(
        self,
        user_id: str,
        session: Session
    ) -> Dict[str, bool]:
        """Get verification badge information for a user."""
        badges = {}

        for verification_type in VerificationType:
            badges[verification_type.value] = self.is_user_verified(
                user_id, verification_type, session
            )

        return badges


# Global verification service instance
verification_service = VerificationService()