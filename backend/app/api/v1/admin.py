from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
from datetime import datetime, timezone

from app.database import get_db
from app.models.report import Report
from app.models.user import User
from app.models.organization import Organization
from app.schemas.report import ReportReview, ReportListItem
from app.schemas.user import UserResponse
from app.schemas.organization import OrganizationResponse
from app.api.deps import get_current_user, get_current_admin_user, get_admin_clerk_ids
from app.config import settings

router = APIRouter()


@router.get("/check")
def admin_check(current_user: User = Depends(get_current_user)):
    """Return whether the current user is an admin (for UI to show/hide admin link)."""
    admin_ids = get_admin_clerk_ids()
    is_admin = current_user.clerk_id in admin_ids
    out: dict = {"is_admin": is_admin}
    if not is_admin and settings.ENVIRONMENT != "production":
        if not admin_ids:
            out["hint"] = "ADMIN_CLERK_IDS is not set. Add it to backend/.env (see backend/.env.example)."
        else:
            out["hint"] = "Your Clerk user ID is not in ADMIN_CLERK_IDS. Check backend/.env."
    return out


@router.get("/stats")
def admin_stats(
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Return counts for admin overview (users, reports, organizations)."""
    users_total = db.query(func.count(User.id)).scalar() or 0
    users_banned = db.query(func.count(User.id)).filter(User.is_banned.is_(True)).scalar() or 0
    users_pending_review = (
        db.query(func.count(User.id)).filter(User.profile_status == "pending_review").scalar() or 0
    )
    reports_pending = db.query(func.count(Report.id)).filter(Report.status == "pending").scalar() or 0
    reports_total = db.query(func.count(Report.id)).scalar() or 0
    organizations_total = db.query(func.count(Organization.id)).scalar() or 0
    return {
        "users_total": users_total,
        "users_banned": users_banned,
        "users_pending_review": users_pending_review,
        "reports_pending": reports_pending,
        "reports_total": reports_total,
        "organizations_total": organizations_total,
    }


@router.get("/reports", response_model=list[ReportListItem])
def list_reports(
    status_filter: str | None = Query(None, description="Filter by status: pending, reviewed, resolved, dismissed"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List reports with optional status filter. Paginated."""
    q = db.query(Report).order_by(Report.created_at.desc())
    if status_filter and status_filter in ("pending", "reviewed", "resolved", "dismissed"):
        q = q.filter(Report.status == status_filter)
    reports = q.offset(skip).limit(limit).all()
    return [
        ReportListItem(
            id=r.id,
            reporter_id=r.reporter_id,
            reported_user_id=r.reported_user_id,
            report_type=r.report_type,
            description=r.description,
            status=r.status,
            reviewed_by=r.reviewed_by,
            reviewed_at=r.reviewed_at,
            resolution_notes=r.resolution_notes,
            created_at=r.created_at,
            reporter_name=r.reporter.name if r.reporter else None,
            reporter_email=r.reporter.email if r.reporter else None,
            reported_user_name=r.reported_user.name if r.reported_user else None,
            reported_user_email=r.reported_user.email if r.reported_user else None,
        )
        for r in reports
    ]


@router.put("/reports/{report_id}", response_model=ReportListItem)
def review_report(
    report_id: UUID,
    body: ReportReview,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Update report status and resolution notes."""
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    r.status = body.status
    r.resolution_notes = body.resolution_notes
    r.reviewed_by = admin.id
    r.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return ReportListItem(
        id=r.id,
        reporter_id=r.reporter_id,
        reported_user_id=r.reported_user_id,
        report_type=r.report_type,
        description=r.description,
        status=r.status,
        reviewed_by=r.reviewed_by,
        reviewed_at=r.reviewed_at,
        resolution_notes=r.resolution_notes,
        created_at=r.created_at,
        reporter_name=r.reporter.name if r.reporter else None,
        reporter_email=r.reporter.email if r.reporter else None,
        reported_user_name=r.reported_user.name if r.reported_user else None,
        reported_user_email=r.reported_user.email if r.reported_user else None,
    )


@router.get("/users", response_model=list[UserResponse])
def list_users(
    profile_status: str | None = Query(None, description="Filter by profile_status"),
    is_banned: bool | None = Query(None, description="Filter by is_banned"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List users for moderation. Paginated."""
    q = db.query(User).order_by(User.created_at.desc())
    if profile_status:
        q = q.filter(User.profile_status == profile_status)
    if is_banned is not None:
        q = q.filter(User.is_banned == is_banned)
    users = q.offset(skip).limit(limit).all()
    return users


@router.put("/users/{user_id}/ban")
def ban_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Ban a user. They will receive 403 on authenticated requests."""
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot ban yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_banned = True
    db.commit()
    db.refresh(user)
    return {"message": "User banned", "user_id": str(user_id)}


@router.put("/users/{user_id}/unban")
def unban_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Remove ban from a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_banned = False
    db.commit()
    db.refresh(user)
    return {"message": "User unbanned", "user_id": str(user_id)}


@router.put("/users/{user_id}/approve")
def approve_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Set user profile_status to approved (e.g. after review)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.profile_status = "approved"
    db.commit()
    db.refresh(user)
    return {"message": "User approved", "user_id": str(user_id)}


@router.put("/users/{user_id}/reject")
def reject_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Set user profile_status to rejected."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.profile_status = "rejected"
    db.commit()
    db.refresh(user)
    return {"message": "User rejected", "user_id": str(user_id)}


@router.get("/organizations", response_model=list[OrganizationResponse])
def list_organizations_admin(
    verified: bool | None = Query(None, description="Filter by is_verified"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List all organizations for admin. Paginated."""
    q = db.query(Organization).order_by(Organization.name)
    if verified is not None:
        q = q.filter(Organization.is_verified == verified)
    orgs = q.offset(skip).limit(limit).all()
    return orgs


@router.put("/organizations/{org_id}/verify")
def verify_organization(
    org_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Mark organization as verified."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    org.is_verified = True
    org.verification_method = "manual"
    org.verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)
    return {"message": "Organization verified", "org_id": str(org_id)}
