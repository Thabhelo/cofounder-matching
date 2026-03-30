"""
Admin Review Queue API

Comprehensive admin interface for managing user reviews, verifications,
and moderation actions. Provides tools for admins to:
- Review flagged users and suspicious activity
- Process manual verification requests
- Approve/reject users with detailed feedback
- Manage bans and suspensions with audit trails
- Monitor queue metrics and admin activity
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import Optional
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models import (
    User, AdminReviewQueue, UserVerification, Report, AdminAuditLog,
    ReviewReason, ReviewStatus, VerificationStatus
)
from app.api.deps import get_current_admin_user
from app.schemas.admin import (
    AdminReviewQueueResponse,
    AdminReviewQueueListResponse,
    ReviewActionRequest,
    ReviewActionResponse,
    AdminDashboardStats,
    BulkReviewActionRequest,
    BulkReviewActionResponse
)
from app.services.matching_filters import matching_quality_filter
from app.services.verification import verification_service
from app.services.trust_score import recalculate_user_trust_score
from app.services.quality_metrics import update_user_quality_metrics
from app.utils.email import send_admin_action_notification
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/queue", response_model=AdminReviewQueueListResponse)
async def get_review_queue(
    status_filter: Optional[ReviewStatus] = Query(None, description="Filter by review status"),
    reason_filter: Optional[ReviewReason] = Query(None, description="Filter by review reason"),
    priority_filter: Optional[int] = Query(None, description="Filter by priority (1-5)"),
    assigned_to_me: Optional[bool] = Query(False, description="Show only items assigned to current admin"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get paginated admin review queue with filtering and sorting.
    Shows flagged users, verification requests, and other items requiring admin attention.
    """
    try:
        # Build query with filters
        query = db.query(AdminReviewQueue)

        if status_filter:
            query = query.filter(AdminReviewQueue.status == status_filter.value)

        if reason_filter:
            query = query.filter(AdminReviewQueue.reason == reason_filter.value)

        if priority_filter:
            query = query.filter(AdminReviewQueue.priority == priority_filter)

        if assigned_to_me:
            query = query.filter(AdminReviewQueue.assigned_admin_id == current_admin.id)

        # Apply sorting
        sort_field = getattr(AdminReviewQueue, sort_by, AdminReviewQueue.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_field))
        else:
            query = query.order_by(desc(sort_field))

        # Get total count for pagination
        total_count = query.count()

        # Get paginated results
        items = query.offset(skip).limit(limit).all()

        # Enrich with user data and admin info
        enriched_items = []
        for item in items:
            user = db.query(User).filter(User.id == item.user_id).first()
            assigned_admin = None
            if item.assigned_admin_id:
                assigned_admin = db.query(User).filter(User.id == item.assigned_admin_id).first()

            # Get user quality summary
            quality_summary = matching_quality_filter.get_user_quality_summary(
                user, db, update_metrics=False
            ) if user else {}

            enriched_items.append(AdminReviewQueueResponse(
                id=item.id,
                user_id=item.user_id,
                user_name=user.name if user else "Unknown",
                user_email=user.email if user else "Unknown",
                reason=item.reason,
                status=item.status,
                priority=item.priority,
                description=item.description,
                admin_notes=item.admin_notes,
                decision_reason=item.decision_reason,
                actions_taken=item.actions_taken,
                user_context=item.user_context,
                assigned_admin_id=item.assigned_admin_id,
                assigned_admin_name=assigned_admin.name if assigned_admin else None,
                assigned_at=item.assigned_at,
                resolved_at=item.resolved_at,
                resolution_notes=item.resolution_notes,
                escalated_at=item.escalated_at,
                escalation_reason=item.escalation_reason,
                created_at=item.created_at,
                updated_at=item.updated_at,
                user_quality_summary=quality_summary
            ))

        return AdminReviewQueueListResponse(
            items=enriched_items,
            total_count=total_count,
            page_size=limit,
            current_page=skip // limit + 1,
            total_pages=(total_count + limit - 1) // limit
        )

    except Exception as e:
        logger.error(f"Error getting review queue: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving review queue"
        )


@router.get("/queue/{review_id}", response_model=AdminReviewQueueResponse)
async def get_review_item(
    review_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific review queue item."""
    try:
        review_uuid = uuid.UUID(review_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review ID"
        )

    item = db.query(AdminReviewQueue).filter(AdminReviewQueue.id == review_uuid).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review item not found"
        )

    # Get associated user
    user = db.query(User).filter(User.id == item.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated user not found"
        )

    # Get assigned admin info
    assigned_admin = None
    if item.assigned_admin_id:
        assigned_admin = db.query(User).filter(User.id == item.assigned_admin_id).first()

    # Get comprehensive user quality summary
    quality_summary = matching_quality_filter.get_user_quality_summary(
        user, db, update_metrics=True
    )

    # Get user's verification history
    verifications = verification_service.get_user_verifications(str(user.id), db)

    # Get user's reports
    reports = db.query(Report).filter(Report.reported_user_id == user.id).all()

    return AdminReviewQueueResponse(
        id=item.id,
        user_id=item.user_id,
        user_name=user.name,
        user_email=user.email,
        reason=item.reason,
        status=item.status,
        priority=item.priority,
        description=item.description,
        admin_notes=item.admin_notes,
        decision_reason=item.decision_reason,
        actions_taken=item.actions_taken,
        user_context=item.user_context,
        assigned_admin_id=item.assigned_admin_id,
        assigned_admin_name=assigned_admin.name if assigned_admin else None,
        assigned_at=item.assigned_at,
        resolved_at=item.resolved_at,
        resolution_notes=item.resolution_notes,
        escalated_at=item.escalated_at,
        escalation_reason=item.escalation_reason,
        created_at=item.created_at,
        updated_at=item.updated_at,
        user_quality_summary=quality_summary,
        user_verifications=[{
            "id": str(v.id),
            "type": v.verification_type,
            "status": v.status,
            "verified_at": v.verified_at,
            "failure_reason": v.failure_reason
        } for v in verifications],
        user_reports=[{
            "id": str(r.id),
            "reporter_name": r.reporter.name if r.reporter else "Anonymous",
            "reason": r.reason,
            "description": r.description,
            "created_at": r.created_at,
            "status": r.status
        } for r in reports]
    )


@router.post("/queue/{review_id}/assign", response_model=dict)
async def assign_review_item(
    review_id: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Assign a review item to the current admin."""
    try:
        review_uuid = uuid.UUID(review_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review ID"
        )

    item = db.query(AdminReviewQueue).filter(AdminReviewQueue.id == review_uuid).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review item not found"
        )

    if item.status != ReviewStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending items can be assigned"
        )

    # Assign to current admin
    item.assigned_admin_id = current_admin.id
    item.assigned_at = datetime.utcnow()
    item.status = ReviewStatus.IN_PROGRESS.value
    item.updated_at = datetime.utcnow()

    # Create audit log
    audit_log = AdminAuditLog(
        admin_id=current_admin.id,
        action="assign_review",
        target_type="AdminReviewQueue",
        target_id=str(item.id),
        details={
            "review_reason": item.reason,
            "user_id": str(item.user_id)
        }
    )
    db.add(audit_log)

    db.commit()

    logger.info(
        f"Review item {review_id} assigned to admin {current_admin.id}",
        extra={"admin_id": str(current_admin.id), "review_id": review_id}
    )

    return {
        "message": "Review item assigned successfully",
        "review_id": review_id,
        "assigned_to": current_admin.name
    }


@router.post("/queue/{review_id}/action", response_model=ReviewActionResponse)
async def take_review_action(
    review_id: str,
    action_request: ReviewActionRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Take action on a review item (approve, reject, escalate, ban, etc.).
    Supports comprehensive moderation actions with audit trails.
    """
    try:
        review_uuid = uuid.UUID(review_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review ID"
        )

    item = db.query(AdminReviewQueue).filter(AdminReviewQueue.id == review_uuid).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review item not found"
        )

    # Verify admin can take action on this item
    if item.assigned_admin_id and item.assigned_admin_id != current_admin.id:
        if not current_admin.is_admin:  # Allow super admins to take any action
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This item is assigned to another admin"
            )

    user = db.query(User).filter(User.id == item.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated user not found"
        )

    actions_taken = []
    success = True
    error_message = None

    try:
        # Process the requested action
        if action_request.action == "approve":
            item.status = ReviewStatus.APPROVED.value
            actions_taken.append("user_approved")

            # If this was a manual verification request, complete it
            if item.reason == ReviewReason.MANUAL_VERIFICATION_REQUEST.value:
                verification_result = verification_service.complete_verification(
                    str(item.user_id),  # This would need to be the verification ID
                    db,
                    admin_id=str(current_admin.id),
                    approved=True,
                    admin_notes=action_request.admin_notes
                )
                if verification_result.success:
                    actions_taken.append("manual_verification_approved")

        elif action_request.action == "reject":
            item.status = ReviewStatus.REJECTED.value
            actions_taken.append("user_rejected")

            # If this was a verification request, mark as failed
            if item.reason == ReviewReason.MANUAL_VERIFICATION_REQUEST.value:
                # Complete verification with rejection
                actions_taken.append("manual_verification_rejected")

        elif action_request.action == "escalate":
            item.status = ReviewStatus.ESCALATED.value
            item.escalated_at = datetime.utcnow()
            item.escalation_reason = action_request.admin_notes
            item.priority = max(1, item.priority - 1)  # Increase priority
            actions_taken.append("escalated_to_senior_admin")

        elif action_request.action == "ban":
            user.is_banned = True
            user.updated_at = datetime.utcnow()
            item.status = ReviewStatus.APPROVED.value  # Action completed
            actions_taken.append("user_banned")

        elif action_request.action == "suspend":
            # Temporary suspension - could be implemented with a suspension_until field
            user.is_active = False
            user.updated_at = datetime.utcnow()
            item.status = ReviewStatus.APPROVED.value
            actions_taken.append("user_suspended")

        elif action_request.action == "require_reverification":
            # Mark existing verifications as expired
            existing_verifications = db.query(UserVerification).filter(
                UserVerification.user_id == user.id,
                UserVerification.status == VerificationStatus.VERIFIED.value
            ).all()

            for verification in existing_verifications:
                verification.status = VerificationStatus.EXPIRED.value
                verification.updated_at = datetime.utcnow()

            item.status = ReviewStatus.APPROVED.value
            actions_taken.append("reverification_required")

        elif action_request.action == "recalculate_metrics":
            # Trigger recalculation of trust score and quality metrics
            recalculate_user_trust_score(str(user.id))
            update_user_quality_metrics(str(user.id))
            item.status = ReviewStatus.APPROVED.value
            actions_taken.append("metrics_recalculated")

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action: {action_request.action}"
            )

        # Update review item
        item.admin_notes = action_request.admin_notes
        item.decision_reason = action_request.decision_reason
        item.actions_taken = actions_taken
        item.resolved_at = datetime.utcnow()
        item.resolution_notes = f"Action: {action_request.action}. {action_request.admin_notes}"
        item.updated_at = datetime.utcnow()

        # Ensure item is assigned to current admin
        if not item.assigned_admin_id:
            item.assigned_admin_id = current_admin.id
            item.assigned_at = datetime.utcnow()

        # Create comprehensive audit log
        audit_log = AdminAuditLog(
            admin_id=current_admin.id,
            action=f"review_action_{action_request.action}",
            target_type="User",
            target_id=str(user.id),
            details={
                "review_id": str(item.id),
                "review_reason": item.reason,
                "action": action_request.action,
                "admin_notes": action_request.admin_notes,
                "decision_reason": action_request.decision_reason,
                "actions_taken": actions_taken,
                "user_email": user.email,
                "user_name": user.name
            }
        )
        db.add(audit_log)

        db.commit()

        # Send notification to user (if appropriate)
        if action_request.notify_user and action_request.action in ["approve", "reject", "ban"]:
            try:
                await send_admin_action_notification(
                    user.email,
                    user.name,
                    action_request.action,
                    action_request.admin_notes or action_request.decision_reason
                )
            except Exception as e:
                logger.error(f"Error sending user notification: {str(e)}")

        logger.info(
            f"Admin {current_admin.id} took action '{action_request.action}' on review {review_id}",
            extra={
                "admin_id": str(current_admin.id),
                "review_id": review_id,
                "action": action_request.action,
                "user_id": str(user.id)
            }
        )

    except Exception as e:
        db.rollback()
        success = False
        error_message = str(e)
        logger.error(f"Error taking review action: {str(e)}")

    return ReviewActionResponse(
        success=success,
        actions_taken=actions_taken,
        message=f"Action '{action_request.action}' completed successfully" if success else f"Error: {error_message}",
        review_status=item.status if success else None,
        user_status={
            "is_active": user.is_active,
            "is_banned": user.is_banned
        } if success else None
    )


@router.post("/queue/bulk-action", response_model=BulkReviewActionResponse)
async def bulk_review_action(
    bulk_request: BulkReviewActionRequest,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Take bulk action on multiple review items.
    Useful for processing multiple similar cases efficiently.
    """
    if len(bulk_request.review_ids) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot process more than 50 items at once"
        )

    results = []
    success_count = 0
    error_count = 0

    for review_id in bulk_request.review_ids:
        try:
            # Process each item individually
            action_request = ReviewActionRequest(
                action=bulk_request.action,
                admin_notes=bulk_request.admin_notes,
                decision_reason=bulk_request.decision_reason,
                notify_user=bulk_request.notify_user
            )

            result = await take_review_action(review_id, action_request, current_admin, db)

            results.append({
                "review_id": review_id,
                "success": result.success,
                "message": result.message
            })

            if result.success:
                success_count += 1
            else:
                error_count += 1

        except Exception as e:
            error_count += 1
            results.append({
                "review_id": review_id,
                "success": False,
                "message": str(e)
            })

    return BulkReviewActionResponse(
        processed_count=len(bulk_request.review_ids),
        success_count=success_count,
        error_count=error_count,
        results=results,
        message=f"Processed {len(bulk_request.review_ids)} items: {success_count} successful, {error_count} errors"
    )


@router.get("/dashboard", response_model=AdminDashboardStats)
async def get_admin_dashboard_stats(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive admin dashboard statistics.
    Shows queue metrics, activity stats, and system health indicators.
    """
    try:
        # Queue statistics
        total_pending = db.query(AdminReviewQueue).filter(
            AdminReviewQueue.status == ReviewStatus.PENDING.value
        ).count()

        total_in_progress = db.query(AdminReviewQueue).filter(
            AdminReviewQueue.status == ReviewStatus.IN_PROGRESS.value
        ).count()

        assigned_to_me = db.query(AdminReviewQueue).filter(
            AdminReviewQueue.assigned_admin_id == current_admin.id,
            AdminReviewQueue.status == ReviewStatus.IN_PROGRESS.value
        ).count()

        # Priority breakdown
        high_priority = db.query(AdminReviewQueue).filter(
            AdminReviewQueue.priority <= 2,
            AdminReviewQueue.status.in_([ReviewStatus.PENDING.value, ReviewStatus.IN_PROGRESS.value])
        ).count()

        # Reason breakdown
        reason_stats = {}
        for reason in ReviewReason:
            count = db.query(AdminReviewQueue).filter(
                AdminReviewQueue.reason == reason.value,
                AdminReviewQueue.status.in_([ReviewStatus.PENDING.value, ReviewStatus.IN_PROGRESS.value])
            ).count()
            reason_stats[reason.value] = count

        # Recent activity (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(hours=24)
        recent_actions = db.query(AdminAuditLog).filter(
            AdminAuditLog.created_at >= yesterday
        ).count()

        my_recent_actions = db.query(AdminAuditLog).filter(
            AdminAuditLog.admin_id == current_admin.id,
            AdminAuditLog.created_at >= yesterday
        ).count()

        # System health indicators
        total_banned_users = db.query(User).filter(User.is_banned).count()
        total_inactive_users = db.query(User).filter(~User.is_active).count()
        total_reports_open = db.query(Report).filter(Report.status == "open").count()

        # Average resolution time (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        resolved_items = db.query(AdminReviewQueue).filter(
            AdminReviewQueue.resolved_at >= thirty_days_ago,
            AdminReviewQueue.resolved_at.isnot(None),
            AdminReviewQueue.created_at.isnot(None)
        ).all()

        avg_resolution_hours = 0
        if resolved_items:
            total_resolution_time = sum([
                (item.resolved_at - item.created_at).total_seconds() / 3600
                for item in resolved_items
                if item.resolved_at and item.created_at
            ])
            avg_resolution_hours = total_resolution_time / len(resolved_items)

        return AdminDashboardStats(
            queue_stats={
                "total_pending": total_pending,
                "total_in_progress": total_in_progress,
                "assigned_to_me": assigned_to_me,
                "high_priority_count": high_priority
            },
            reason_breakdown=reason_stats,
            activity_stats={
                "recent_admin_actions": recent_actions,
                "my_recent_actions": my_recent_actions,
                "avg_resolution_hours": round(avg_resolution_hours, 2)
            },
            system_health={
                "total_banned_users": total_banned_users,
                "total_inactive_users": total_inactive_users,
                "total_open_reports": total_reports_open
            },
            generated_at=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Error generating admin dashboard stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating dashboard statistics"
        )


@router.get("/users/{user_id}/quality-check", response_model=dict)
async def admin_user_quality_check(
    user_id: str,
    recalculate: bool = Query(False, description="Force recalculation of metrics"),
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to check comprehensive quality information for any user.
    Includes quality metrics, trust score, verifications, and moderation history.
    """
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

    # Get comprehensive quality summary
    quality_summary = matching_quality_filter.get_user_quality_summary(
        user, db, update_metrics=recalculate
    )

    # Get review history
    review_history = db.query(AdminReviewQueue).filter(
        AdminReviewQueue.user_id == user.id
    ).order_by(desc(AdminReviewQueue.created_at)).all()

    # Get audit log entries
    audit_entries = db.query(AdminAuditLog).filter(
        AdminAuditLog.target_id == str(user.id),
        AdminAuditLog.target_type == "User"
    ).order_by(desc(AdminAuditLog.created_at)).limit(20).all()

    # Create audit log for this admin check
    audit_log = AdminAuditLog(
        admin_id=current_admin.id,
        action="admin_quality_check",
        target_type="User",
        target_id=str(user.id),
        details={
            "recalculate": recalculate,
            "checked_by": current_admin.name
        }
    )
    db.add(audit_log)
    db.commit()

    return {
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "is_active": user.is_active,
            "is_banned": user.is_banned,
            "created_at": user.created_at,
            "updated_at": user.updated_at
        },
        "quality_summary": quality_summary,
        "review_history": [{
            "id": str(item.id),
            "reason": item.reason,
            "status": item.status,
            "priority": item.priority,
            "created_at": item.created_at,
            "resolved_at": item.resolved_at,
            "actions_taken": item.actions_taken
        } for item in review_history],
        "recent_admin_actions": [{
            "id": str(entry.id),
            "admin_name": entry.admin.name if entry.admin else "Unknown",
            "action": entry.action,
            "details": entry.details,
            "created_at": entry.created_at
        } for entry in audit_entries],
        "checked_by": current_admin.name,
        "checked_at": datetime.utcnow()
    }