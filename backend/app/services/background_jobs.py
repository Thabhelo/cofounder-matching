"""
Background Job System for User Vetting

Manages periodic tasks like trust score recalculation, quality metrics updates,
and verification expiry cleanup.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import select, and_, or_

from app.database import get_database_session
from app.models import User, UserTrustScore, UserVerification
from app.services.trust_score import recalculate_all_trust_scores, recalculate_user_trust_score
from app.services.quality_metrics import update_all_quality_metrics
from app.utils.logging import get_logger

logger = get_logger(__name__)


class JobStatus(str, Enum):
    """Status of background jobs."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class JobResult:
    """Result of a background job execution."""
    job_name: str
    status: JobStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    processed_count: int = 0
    error_count: int = 0
    error_message: Optional[str] = None

    @property
    def duration(self) -> Optional[timedelta]:
        if self.end_time and self.start_time:
            return self.end_time - self.start_time
        return None


class BackgroundJobManager:
    """Manages and schedules background jobs for the vetting system."""

    def __init__(self):
        self.running_jobs: Dict[str, asyncio.Task] = {}
        self.job_history: List[JobResult] = []
        self.max_history = 100  # Keep last 100 job results

    async def start_periodic_jobs(self):
        """Start all periodic background jobs."""
        logger.info("Starting background job manager")

        # Schedule periodic trust score recalculation (daily at 2 AM)
        asyncio.create_task(self._schedule_daily_job(
            "trust_score_recalculation",
            self.recalculate_all_trust_scores,
            hour=2, minute=0
        ))

        # Schedule quality metrics update (daily at 3 AM)
        asyncio.create_task(self._schedule_daily_job(
            "quality_metrics_update",
            self.update_all_quality_metrics,
            hour=3, minute=0
        ))

        # Schedule verification cleanup (daily at 4 AM)
        asyncio.create_task(self._schedule_daily_job(
            "verification_cleanup",
            self.cleanup_expired_verifications,
            hour=4, minute=0
        ))

        # Schedule trust score updates for recently active users (every 6 hours)
        asyncio.create_task(self._schedule_periodic_job(
            "active_user_trust_score_update",
            self.update_active_user_scores,
            interval_hours=6
        ))

        logger.info("Background jobs scheduled successfully")

    async def _schedule_daily_job(self, job_name: str, job_func, hour: int, minute: int):
        """Schedule a job to run daily at specified time."""
        while True:
            try:
                # Calculate next run time
                now = datetime.now()
                next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

                # If the time has passed today, schedule for tomorrow
                if next_run <= now:
                    next_run += timedelta(days=1)

                # Wait until the scheduled time
                wait_seconds = (next_run - now).total_seconds()
                logger.info(f"Job {job_name} scheduled to run in {wait_seconds/3600:.1f} hours")

                await asyncio.sleep(wait_seconds)

                # Run the job
                await self.run_job(job_name, job_func)

            except asyncio.CancelledError:
                logger.info(f"Daily job {job_name} cancelled")
                break
            except Exception as e:
                logger.error(f"Error in daily job scheduler for {job_name}: {str(e)}")
                # Wait an hour before retrying
                await asyncio.sleep(3600)

    async def _schedule_periodic_job(self, job_name: str, job_func, interval_hours: int):
        """Schedule a job to run periodically."""
        while True:
            try:
                await self.run_job(job_name, job_func)
                await asyncio.sleep(interval_hours * 3600)
            except asyncio.CancelledError:
                logger.info(f"Periodic job {job_name} cancelled")
                break
            except Exception as e:
                logger.error(f"Error in periodic job scheduler for {job_name}: {str(e)}")
                # Wait before retrying (but not the full interval)
                await asyncio.sleep(1800)  # 30 minutes

    async def run_job(self, job_name: str, job_func) -> JobResult:
        """Run a background job and track its progress."""
        if job_name in self.running_jobs:
            logger.warning(f"Job {job_name} is already running, skipping")
            return JobResult(job_name, JobStatus.CANCELLED, datetime.now())

        job_result = JobResult(job_name, JobStatus.PENDING, datetime.now())

        try:
            logger.info(f"Starting background job: {job_name}")
            job_result.status = JobStatus.RUNNING

            # Create and track the job task
            task = asyncio.create_task(job_func())
            self.running_jobs[job_name] = task

            # Wait for completion
            result = await task

            job_result.status = JobStatus.COMPLETED
            job_result.end_time = datetime.now()

            if hasattr(result, 'processed_count'):
                job_result.processed_count = result.processed_count
            if hasattr(result, 'error_count'):
                job_result.error_count = result.error_count

            logger.info(
                f"Completed job {job_name} in {job_result.duration}. "
                f"Processed: {job_result.processed_count}, Errors: {job_result.error_count}"
            )

        except asyncio.CancelledError:
            job_result.status = JobStatus.CANCELLED
            job_result.end_time = datetime.now()
            logger.info(f"Job {job_name} was cancelled")

        except Exception as e:
            job_result.status = JobStatus.FAILED
            job_result.end_time = datetime.now()
            job_result.error_message = str(e)
            logger.error(f"Job {job_name} failed: {str(e)}")

        finally:
            # Clean up
            if job_name in self.running_jobs:
                del self.running_jobs[job_name]

            # Add to history
            self._add_to_history(job_result)

        return job_result

    def _add_to_history(self, job_result: JobResult):
        """Add job result to history and maintain size limit."""
        self.job_history.append(job_result)

        # Keep only the most recent entries
        if len(self.job_history) > self.max_history:
            self.job_history = self.job_history[-self.max_history:]

    async def recalculate_all_trust_scores(self) -> Dict:
        """Background job to recalculate all trust scores."""
        processed_count = 0
        error_count = 0

        try:
            await recalculate_all_trust_scores()

            # Count processed users
            async for session in get_database_session():
                try:
                    result = await session.execute(
                        select(User.id).where(
                            and_(User.is_active, ~User.is_banned)
                        )
                    )
                    processed_count = len(result.scalars().all())
                finally:
                    await session.close()

        except Exception as e:
            error_count = 1
            logger.error(f"Error in trust score recalculation job: {str(e)}")
            raise

        return {
            'processed_count': processed_count,
            'error_count': error_count
        }

    async def update_all_quality_metrics(self) -> Dict:
        """Background job to update all user quality metrics."""
        processed_count = 0
        error_count = 0

        try:
            await update_all_quality_metrics()

            # Count processed users
            async for session in get_database_session():
                try:
                    result = await session.execute(
                        select(User.id).where(
                            and_(User.is_active, ~User.is_banned)
                        )
                    )
                    processed_count = len(result.scalars().all())
                finally:
                    await session.close()

        except Exception as e:
            error_count = 1
            logger.error(f"Error in quality metrics update job: {str(e)}")
            raise

        return {
            'processed_count': processed_count,
            'error_count': error_count
        }

    async def cleanup_expired_verifications(self) -> Dict:
        """Background job to clean up expired verifications."""
        processed_count = 0
        error_count = 0

        async for session in get_database_session():
            try:
                # Find expired verifications
                expired_verifications = await session.execute(
                    select(UserVerification).where(
                        and_(
                            UserVerification.expires_at < datetime.utcnow(),
                            UserVerification.status == "verified"
                        )
                    )
                )

                verifications = expired_verifications.scalars().all()
                processed_count = len(verifications)

                # Update status to expired
                for verification in verifications:
                    verification.status = "expired"
                    verification.updated_at = datetime.utcnow()

                await session.commit()

                logger.info(f"Marked {processed_count} verifications as expired")

            except Exception as e:
                error_count += 1
                await session.rollback()
                logger.error(f"Error cleaning up expired verifications: {str(e)}")
                raise
            finally:
                await session.close()

        return {
            'processed_count': processed_count,
            'error_count': error_count
        }

    async def update_active_user_scores(self) -> Dict:
        """Update trust scores for recently active users."""
        processed_count = 0
        error_count = 0

        async for session in get_database_session():
            try:
                # Find users active in the last 24 hours
                cutoff_time = datetime.utcnow() - timedelta(hours=24)

                active_users = await session.execute(
                    select(User).where(
                        and_(
                            User.is_active,
                            ~User.is_banned,
                            or_(
                                User.updated_at > cutoff_time,
                                # Users without recent trust score calculation
                                ~User.id.in_(
                                    select(UserTrustScore.user_id).where(
                                        UserTrustScore.last_calculated > cutoff_time
                                    )
                                )
                            )
                        )
                    )
                )

                users = active_users.scalars().all()

                for user in users:
                    try:
                        await recalculate_user_trust_score(str(user.id))
                        processed_count += 1

                        # Small delay to avoid overwhelming the system
                        await asyncio.sleep(0.1)

                    except Exception as e:
                        error_count += 1
                        logger.error(
                            f"Error updating trust score for user {user.id}: {str(e)}"
                        )

                logger.info(
                    f"Updated trust scores for {processed_count} active users, "
                    f"{error_count} errors"
                )

            except Exception as e:
                logger.error(f"Error in active user score update job: {str(e)}")
                raise
            finally:
                await session.close()

        return {
            'processed_count': processed_count,
            'error_count': error_count
        }

    async def cancel_job(self, job_name: str) -> bool:
        """Cancel a running job."""
        if job_name in self.running_jobs:
            task = self.running_jobs[job_name]
            task.cancel()
            logger.info(f"Cancelled job: {job_name}")
            return True
        return False

    def get_job_status(self, job_name: str) -> Optional[JobStatus]:
        """Get the current status of a job."""
        if job_name in self.running_jobs:
            return JobStatus.RUNNING

        # Check recent history
        for job_result in reversed(self.job_history):
            if job_result.job_name == job_name:
                return job_result.status

        return None

    def get_job_history(self, limit: int = 20) -> List[JobResult]:
        """Get recent job execution history."""
        return self.job_history[-limit:]

    async def shutdown(self):
        """Gracefully shutdown the job manager."""
        logger.info("Shutting down background job manager")

        # Cancel all running jobs
        for job_name, task in self.running_jobs.items():
            logger.info(f"Cancelling job: {job_name}")
            task.cancel()

        # Wait for all jobs to complete/cancel
        if self.running_jobs:
            await asyncio.gather(*self.running_jobs.values(), return_exceptions=True)

        logger.info("Background job manager shutdown complete")


# Global job manager instance
job_manager = BackgroundJobManager()


# Convenience functions for manual job execution
async def trigger_trust_score_recalculation():
    """Manually trigger trust score recalculation for all users."""
    return await job_manager.run_job(
        "manual_trust_score_recalculation",
        job_manager.recalculate_all_trust_scores
    )

async def trigger_quality_metrics_update():
    """Manually trigger quality metrics update for all users."""
    return await job_manager.run_job(
        "manual_quality_metrics_update",
        job_manager.update_all_quality_metrics
    )

async def trigger_user_trust_score_update(user_id: str):
    """Manually trigger trust score update for a specific user."""
    async def update_single_user():
        result = await recalculate_user_trust_score(user_id)
        return {
            'processed_count': 1 if result else 0,
            'error_count': 0 if result else 1
        }

    return await job_manager.run_job(
        f"manual_user_trust_score_update_{user_id}",
        update_single_user
    )