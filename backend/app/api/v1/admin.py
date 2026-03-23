import re
import uuid as _uuid_module
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, cast
from sqlalchemy.types import Date
from uuid import UUID
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models.report import Report
from app.models.user import User
from app.models.organization import Organization
from app.models.match import Match
from app.models.message import Message
from app.models.resource import Resource
from app.models.event import Event
from app.models.resource import UserSavedResource
from app.models.event import UserEventRSVP
from app.models.admin_audit import AdminAuditLog
from app.models.analytics import (
    AnalyticsEvent,
    UserMetrics,
    FeatureMetrics,
    ConversionFunnel,
    RetentionMetrics,
    PerformanceMetrics,
    RevenueMetrics,
)
from app.schemas.report import ReportReview, ReportListItem
from app.schemas.user import UserResponse, AdminUserUpdate
from app.schemas.organization import OrganizationResponse, OrganizationUpdate, AdminOrganizationCreate
from app.schemas.resource import ResourceResponse, ResourceUpdate, ResourceCreate
from app.schemas.event import EventResponse, EventUpdate, EventCreate
from app.api.deps import get_current_user, get_current_admin_user, get_admin_clerk_ids
from app.config import settings
from app.services.email import send_profile_status_notification
from app.services.feature_flags import get_all_flags, set_flag, FLAG_LABELS

router = APIRouter()


def _log_admin_action(
    db: Session,
    admin_id: UUID,
    action: str,
    target_type: str | None = None,
    target_id: UUID | None = None,
    details: dict | None = None,
) -> None:
    db.add(
        AdminAuditLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        )
    )


@router.get("/check")
def admin_check(current_user: User = Depends(get_current_user)):
    """Return whether the current user is an admin (for UI to show/hide admin link)."""
    admin_ids = get_admin_clerk_ids()
    is_admin = current_user.is_admin or current_user.clerk_id in admin_ids
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
    """Return counts for admin overview (users, matches, messages, reports, growth)."""
    users_total = db.query(func.count(User.id)).scalar() or 0
    users_banned = db.query(func.count(User.id)).filter(User.is_banned.is_(True)).scalar() or 0
    users_pending_review = (
        db.query(func.count(User.id)).filter(User.profile_status == "pending_review").scalar() or 0
    )
    reports_pending = db.query(func.count(Report.id)).filter(Report.status == "pending").scalar() or 0
    reports_total = db.query(func.count(Report.id)).scalar() or 0
    organizations_total = db.query(func.count(Organization.id)).scalar() or 0
    matches_total = db.query(func.count(Match.id)).scalar() or 0
    messages_total = db.query(func.count(Message.id)).scalar() or 0
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    users_last_7_days = (
        db.query(func.count(User.id)).filter(User.created_at >= seven_days_ago).scalar() or 0
    )
    users_last_30_days = (
        db.query(func.count(User.id)).filter(User.created_at >= thirty_days_ago).scalar() or 0
    )
    matches_last_7_days = (
        db.query(func.count(Match.id)).filter(Match.created_at >= seven_days_ago).scalar() or 0
    )
    return {
        "users_total": users_total,
        "users_banned": users_banned,
        "users_pending_review": users_pending_review,
        "reports_pending": reports_pending,
        "reports_total": reports_total,
        "organizations_total": organizations_total,
        "matches_total": matches_total,
        "messages_total": messages_total,
        "users_last_7_days": users_last_7_days,
        "users_last_30_days": users_last_30_days,
        "matches_last_7_days": matches_last_7_days,
    }


@router.get("/analytics")
def admin_analytics(
    days: int = Query(30, ge=7, le=90, description="Number of days for time series"),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Analytics for admin: signups, matches, intros, messages over time; engagement counts."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    signups_by_day = (
        db.query(cast(User.created_at, Date).label("day"), func.count(User.id).label("count"))
        .filter(User.created_at >= since)
        .group_by(cast(User.created_at, Date))
        .order_by(cast(User.created_at, Date))
        .all()
    )
    matches_by_day = (
        db.query(cast(Match.created_at, Date).label("day"), func.count(Match.id).label("count"))
        .filter(Match.created_at >= since)
        .group_by(cast(Match.created_at, Date))
        .order_by(cast(Match.created_at, Date))
        .all()
    )

    intro_requested = db.query(func.count(Match.id)).filter(
        Match.intro_requested_at.isnot(None), Match.created_at >= since
    ).scalar() or 0
    intro_accepted = db.query(func.count(Match.id)).filter(
        Match.intro_accepted_at.isnot(None), Match.created_at >= since
    ).scalar() or 0
    messages_count = db.query(func.count(Message.id)).filter(Message.created_at >= since).scalar() or 0

    resource_saves = (
        db.query(func.count(UserSavedResource.id)).filter(UserSavedResource.saved_at >= since).scalar() or 0
    )
    event_rsvps = (
        db.query(func.count(UserEventRSVP.id)).filter(UserEventRSVP.rsvp_at >= since).scalar() or 0
    )

    orgs_with_events = (
        db.query(func.count(func.distinct(Event.organization_id)))
        .filter(Event.created_at >= since)
        .scalar() or 0
    )

    return {
        "signups_by_day": [{"day": str(d), "count": c} for d, c in signups_by_day],
        "matches_by_day": [{"day": str(d), "count": c} for d, c in matches_by_day],
        "intro_requested_count": intro_requested,
        "intro_accepted_count": intro_accepted,
        "intro_acceptance_rate": (intro_accepted / intro_requested * 100) if intro_requested else 0,
        "messages_count": messages_count,
        "resource_saves_count": resource_saves,
        "event_rsvps_count": event_rsvps,
        "organizations_with_activity_count": orgs_with_events,
    }


@router.get("/audit-log")
def list_audit_log(
    action: str | None = Query(None, description="Filter by action"),
    target_type: str | None = Query(None, description="Filter by target_type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List admin audit log entries (who did what, when)."""
    q = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    if action:
        q = q.filter(AdminAuditLog.action == action)
    if target_type:
        q = q.filter(AdminAuditLog.target_type == target_type)
    rows = q.offset(skip).limit(limit).all()
    admin_ids = [r.admin_id for r in rows if r.admin_id]
    admin_names: dict = {}
    if admin_ids:
        users = db.query(User.id, User.name, User.email).filter(User.id.in_(admin_ids)).all()
        admin_names = {str(u.id): u.name or u.email for u in users}
    return [
        {
            "id": str(r.id),
            "admin_id": str(r.admin_id) if r.admin_id else None,
            "admin_name": admin_names.get(str(r.admin_id), "Unknown") if r.admin_id else None,
            "action": r.action,
            "target_type": r.target_type,
            "target_id": str(r.target_id) if r.target_id else None,
            "details": r.details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/reports", response_model=list[ReportListItem])
def list_reports(
    status_filter: str | None = Query(None, description="Filter by status: pending, reviewed, resolved, dismissed"),
    report_type: str | None = Query(None, description="Filter by type: spam, harassment, inappropriate, fake, other"),
    sort_by: str = Query("created_at", description="created_at, report_type, status"),
    sort_order: str = Query("desc", description="asc or desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List reports with optional status and type filters. Sorted by date (default), type, or status."""
    q = db.query(Report)
    if status_filter and status_filter in ("pending", "reviewed", "resolved", "dismissed"):
        q = q.filter(Report.status == status_filter)
    if report_type:
        q = q.filter(Report.report_type == report_type)
    if sort_by not in ("created_at", "report_type", "status"):
        sort_by = "created_at"
    order_col = getattr(Report, sort_by)
    if sort_order == "asc":
        q = q.order_by(order_col.asc())
    else:
        q = q.order_by(order_col.desc())
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
    _log_admin_action(db, admin.id, "report_review", "report", report_id, {"status": body.status})
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
    q_search: str | None = Query(None, alias="q", description="Search by name or email (partial match)"),
    profile_status: str | None = Query(None, description="Filter by profile_status"),
    is_banned: bool | None = Query(None, description="Filter by is_banned"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List users for moderation. Search by name/email, filter, paginated."""
    q = db.query(User).order_by(User.created_at.desc())
    if q_search and q_search.strip():
        term = f"%{q_search.strip()}%"
        q = q.filter(
            (User.name.ilike(term)) | (User.email.ilike(term))
        )
    if profile_status:
        q = q.filter(User.profile_status == profile_status)
    if is_banned is not None:
        q = q.filter(User.is_banned == is_banned)
    users = q.offset(skip).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get any user by ID (admin)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    body: AdminUserUpdate,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Update any user (admin). Can set profile_status, is_active, and all profile fields."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(user, key, value)
    _log_admin_action(db, admin.id, "user_update", "user", user_id, {"fields": list(data.keys())})
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Deactivate a user (set is_active=False). Does not delete from DB."""
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    _log_admin_action(db, admin.id, "user_deactivate", "user", user_id)
    db.commit()
    return {"message": "User deactivated", "user_id": str(user_id)}


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
    _log_admin_action(db, admin.id, "user_ban", "user", user_id)
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
    _log_admin_action(db, admin.id, "user_unban", "user", user_id)
    db.commit()
    db.refresh(user)
    return {"message": "User unbanned", "user_id": str(user_id)}


@router.put("/users/{user_id}/reactivate")
def reactivate_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Reactivate a previously deactivated user (set is_active=True)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = True
    _log_admin_action(db, admin.id, "user_reactivate", "user", user_id)
    db.commit()
    return {"message": "User reactivated", "user_id": str(user_id)}


@router.put("/users/{user_id}/approve")
async def approve_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Set user profile_status to approved (e.g. after review)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.profile_status = "approved"
    _log_admin_action(db, admin.id, "user_approve", "user", user_id)
    db.commit()
    db.refresh(user)
    await send_profile_status_notification(user)
    return {"message": "User approved", "user_id": str(user_id)}


@router.put("/users/{user_id}/reject")
async def reject_user(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Set user profile_status to rejected."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.profile_status = "rejected"
    _log_admin_action(db, admin.id, "user_reject", "user", user_id)
    db.commit()
    db.refresh(user)
    await send_profile_status_notification(user)
    return {"message": "User rejected", "user_id": str(user_id)}


@router.put("/users/{user_id}/make-admin")
def make_admin(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Grant admin status to a user."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own admin status")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = True
    _log_admin_action(db, admin.id, "user_make_admin", "user", user_id)
    db.commit()
    return {"message": "Admin granted", "user_id": str(user_id)}


@router.put("/users/{user_id}/remove-admin")
def remove_admin(
    user_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Revoke admin status from a user."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own admin status")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = False
    _log_admin_action(db, admin.id, "user_remove_admin", "user", user_id)
    db.commit()
    return {"message": "Admin revoked", "user_id": str(user_id)}


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
    _log_admin_action(db, admin.id, "org_verify", "organization", org_id)
    db.commit()
    db.refresh(org)
    return {"message": "Organization verified", "org_id": str(org_id)}


@router.put("/organizations/{org_id}", response_model=OrganizationResponse)
def update_organization(
    org_id: UUID,
    body: OrganizationUpdate,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Update organization (admin)."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(org, key, value)
    _log_admin_action(db, admin.id, "org_update", "organization", org_id, {"fields": list(data.keys())})
    db.commit()
    db.refresh(org)
    return org


@router.delete("/organizations/{org_id}")
def delete_organization(
    org_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Deactivate organization (set is_active=False)."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    org.is_active = False
    _log_admin_action(db, admin.id, "org_deactivate", "organization", org_id)
    db.commit()
    return {"message": "Organization deactivated", "org_id": str(org_id)}


@router.post("/organizations", response_model=OrganizationResponse)
def create_organization_admin(
    body: AdminOrganizationCreate,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Create an organization as admin. Slug is auto-generated from name."""
    slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")
    existing = db.query(Organization).filter(Organization.slug == slug).first()
    if existing:
        slug = f"{slug}-{str(_uuid_module.uuid4())[:8]}"
    data = body.model_dump()
    data["slug"] = slug
    org = Organization(**data)
    db.add(org)
    db.flush()
    _log_admin_action(db, admin.id, "org_create", "organization", org.id, {"name": org.name})
    db.commit()
    db.refresh(org)
    return org


@router.get("/resources", response_model=list[ResourceResponse])
def list_resources_admin(
    featured_only: bool | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List all resources (admin)."""
    q = db.query(Resource).order_by(Resource.created_at.desc())
    if featured_only is not None:
        q = q.filter(Resource.is_featured == featured_only)
    if is_active is not None:
        q = q.filter(Resource.is_active == is_active)
    return q.offset(skip).limit(limit).all()


@router.put("/resources/{resource_id}", response_model=ResourceResponse)
def update_resource_admin(
    resource_id: UUID,
    body: ResourceUpdate,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Update or feature/deactivate a resource (admin)."""
    res = db.query(Resource).filter(Resource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(res, key, value)
    _log_admin_action(db, admin.id, "resource_update", "resource", resource_id, {"fields": list(data.keys())})
    db.commit()
    db.refresh(res)
    return res


@router.delete("/resources/{resource_id}")
def deactivate_resource_admin(
    resource_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Deactivate resource (admin)."""
    res = db.query(Resource).filter(Resource.id == resource_id).first()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    res.is_active = False
    _log_admin_action(db, admin.id, "resource_deactivate", "resource", resource_id)
    db.commit()
    return {"message": "Resource deactivated", "resource_id": str(resource_id)}


@router.post("/resources", response_model=ResourceResponse)
def create_resource_admin(
    body: ResourceCreate,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Create a resource as admin."""
    res = Resource(**body.model_dump(), created_by=admin.id)
    db.add(res)
    db.flush()
    _log_admin_action(db, admin.id, "resource_create", "resource", res.id, {"title": res.title})
    db.commit()
    db.refresh(res)
    return res


@router.get("/events", response_model=list[EventResponse])
def list_events_admin(
    featured_only: bool | None = Query(None),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List all events (admin)."""
    q = db.query(Event).order_by(Event.start_datetime.desc())
    if featured_only is not None:
        q = q.filter(Event.is_featured == featured_only)
    if is_active is not None:
        q = q.filter(Event.is_active == is_active)
    return q.offset(skip).limit(limit).all()


@router.put("/events/{event_id}", response_model=EventResponse)
def update_event_admin(
    event_id: UUID,
    body: EventUpdate,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Update or feature/deactivate an event (admin)."""
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(ev, key, value)
    _log_admin_action(db, admin.id, "event_update", "event", event_id, {"fields": list(data.keys())})
    db.commit()
    db.refresh(ev)
    return ev


@router.delete("/events/{event_id}")
def deactivate_event_admin(
    event_id: UUID,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Deactivate event (admin)."""
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    ev.is_active = False
    _log_admin_action(db, admin.id, "event_deactivate", "event", event_id)
    db.commit()
    return {"message": "Event deactivated", "event_id": str(event_id)}


@router.post("/events", response_model=EventResponse)
async def create_event_admin(
    body: EventCreate,
    notify_users: bool = Query(False, description="Send announcement email to all active users"),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Create an event as admin. Optionally broadcast announcement email to all active users."""
    from app.services.email import send_event_announcement
    ev = Event(**body.model_dump(), created_by=admin.id)
    db.add(ev)
    db.flush()
    _log_admin_action(db, admin.id, "event_create", "event", ev.id, {"title": ev.title})
    db.commit()
    db.refresh(ev)
    if notify_users:
        users = (
            db.query(User)
            .filter(User.is_active.is_(True), User.is_banned.is_(False), User.email.isnot(None))
            .all()
        )
        for user in users:
            await send_event_announcement(
                user,
                ev.title,
                str(ev.start_datetime),
                ev.location_address or ev.location_url or "",
            )
        _log_admin_action(db, admin.id, "event_broadcast", "event", ev.id, {"recipients": len(users)})
        db.commit()
    return ev


class BroadcastEmailBody(BaseModel):
    subject: str
    message: str


@router.post("/broadcast")
async def broadcast_email(
    body: BroadcastEmailBody,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Send a custom email to all active, non-banned users."""
    from app.services.email import send_email
    users = (
        db.query(User)
        .filter(User.is_active.is_(True), User.is_banned.is_(False), User.email.isnot(None))
        .all()
    )
    for user in users:
        html = (
            f"<p>Hi {user.name or 'there'},</p>"
            f"<p>{body.message}</p>"
            "<p>Best,<br>Cofounder Matching Team</p>"
        )
        text = (
            f"Hi {user.name or 'there'},\n\n"
            f"{body.message}\n\n"
            "Best,\nCofounder Matching Team"
        )
        await send_email(user.email, body.subject, html, text)
    _log_admin_action(db, admin.id, "broadcast_email", details={"subject": body.subject, "recipients": len(users)})
    db.commit()
    return {"recipients": len(users), "status": "ok"}


# ---------------------------------------------------------------------------
# Notifications / Email configuration
# ---------------------------------------------------------------------------

@router.get("/notifications/config")
def get_notifications_config(
    admin: User = Depends(get_current_admin_user),
):
    """Return current email service status and feature flag states."""
    resend_key_set = bool(settings.RESEND_API_KEY)
    email_from_set = bool(settings.EMAIL_FROM)
    flags = get_all_flags()
    return {
        "email_service_configured": resend_key_set and email_from_set,
        "resend_key_set": resend_key_set,
        "email_from_set": email_from_set,
        "frontend_url": settings.FRONTEND_URL,
        "feature_flags": flags,
        "flag_labels": FLAG_LABELS,
    }


@router.patch("/notifications/config")
def update_notifications_config(
    body: dict,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Toggle feature flags at runtime. Pass {\"feature_flags\": {\"welcome_email\": false, ...}}."""
    flags = body.get("feature_flags", {})
    updated = {}
    for name, value in flags.items():
        if not isinstance(value, bool):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Flag value for '{name}' must be a boolean",
            )
        set_flag(name, value)
        updated[name] = value
    if updated:
        _log_admin_action(db, admin.id, "notifications_config_update", details={"flags": updated})
        db.commit()
    return {"updated": updated, "feature_flags": get_all_flags()}


@router.post("/notifications/trigger/profile-reminders")
async def trigger_profile_reminders(
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Manually run the incomplete profile reminder job right now."""
    from app.tasks.scheduler import run_incomplete_profile_reminders
    count = await run_incomplete_profile_reminders()
    _log_admin_action(db, admin.id, "notifications_trigger_profile_reminders", details={"sent": count})
    db.commit()
    return {"users_notified": count, "status": "ok"}


@router.post("/notifications/trigger/event-reminders")
async def trigger_event_reminders(
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Manually run the event reminder job right now."""
    from app.tasks.scheduler import run_event_reminders
    count = await run_event_reminders()
    _log_admin_action(db, admin.id, "notifications_trigger_event_reminders", details={"sent": count})
    db.commit()
    return {"rsvps_notified": count, "status": "ok"}


# Enhanced Analytics Endpoints

@router.get("/analytics/user-metrics")
def get_user_metrics(
    days: int = Query(30, ge=1, le=365, description="Number of days to retrieve"),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get daily user metrics for the specified period."""
    since = datetime.now(timezone.utc).date() - timedelta(days=days)

    metrics = (
        db.query(UserMetrics)
        .filter(UserMetrics.date >= since)
        .order_by(UserMetrics.date.desc())
        .all()
    )

    return {
        "period_days": days,
        "metrics": [
            {
                "date": str(metric.date),
                "total_users": metric.total_users,
                "new_signups": metric.new_signups,
                "active_users_daily": metric.active_users_daily,
                "active_users_weekly": metric.active_users_weekly,
                "active_users_monthly": metric.active_users_monthly,
                "profiles_completed": metric.profiles_completed,
                "avg_profile_completion": metric.avg_profile_completion,
                "total_sessions": metric.total_sessions,
                "avg_session_duration_seconds": metric.avg_session_duration_seconds,
            }
            for metric in metrics
        ]
    }


@router.get("/analytics/feature-metrics")
def get_feature_metrics(
    days: int = Query(30, ge=1, le=365, description="Number of days to retrieve"),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get daily feature usage metrics for the specified period."""
    since = datetime.now(timezone.utc).date() - timedelta(days=days)

    metrics = (
        db.query(FeatureMetrics)
        .filter(FeatureMetrics.date >= since)
        .order_by(FeatureMetrics.date.desc())
        .all()
    )

    return {
        "period_days": days,
        "metrics": [
            {
                "date": str(metric.date),
                "matches_generated": metric.matches_generated,
                "matches_viewed": metric.matches_viewed,
                "introduction_requests": metric.introduction_requests,
                "introduction_acceptances": metric.introduction_acceptances,
                "introduction_rejections": metric.introduction_rejections,
                "messages_sent": metric.messages_sent,
                "conversations_started": metric.conversations_started,
                "resources_viewed": metric.resources_viewed,
                "resources_saved": metric.resources_saved,
                "events_viewed": metric.events_viewed,
                "event_rsvps": metric.event_rsvps,
                "searches_performed": metric.searches_performed,
            }
            for metric in metrics
        ]
    }


@router.get("/analytics/conversion-funnel")
def get_conversion_funnel(
    days: int = Query(30, ge=1, le=365, description="Number of days to retrieve"),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get conversion funnel metrics for the specified period."""
    since = datetime.now(timezone.utc).date() - timedelta(days=days)

    metrics = (
        db.query(ConversionFunnel)
        .filter(ConversionFunnel.date >= since)
        .order_by(ConversionFunnel.date.desc())
        .all()
    )

    return {
        "period_days": days,
        "metrics": [
            {
                "date": str(metric.date),
                "visitors": metric.visitors,
                "signups": metric.signups,
                "signup_conversion_rate": metric.signup_conversion_rate,
                "profile_starts": metric.profile_starts,
                "profile_completions": metric.profile_completions,
                "profile_completion_rate": metric.profile_completion_rate,
                "first_match_views": metric.first_match_views,
                "intro_requests": metric.intro_requests,
                "intro_request_rate": metric.intro_request_rate,
                "connections_made": metric.connections_made,
                "first_messages": metric.first_messages,
                "conversation_start_rate": metric.conversation_start_rate,
            }
            for metric in metrics
        ]
    }


@router.get("/analytics/performance-metrics")
def get_performance_metrics(
    days: int = Query(7, ge=1, le=30, description="Number of days to retrieve"),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get API performance metrics for the specified period."""
    since = datetime.now(timezone.utc).date() - timedelta(days=days)

    metrics = (
        db.query(PerformanceMetrics)
        .filter(PerformanceMetrics.date >= since)
        .order_by(PerformanceMetrics.date.desc(), PerformanceMetrics.hour.desc())
        .all()
    )

    return {
        "period_days": days,
        "metrics": [
            {
                "date": str(metric.date),
                "hour": metric.hour,
                "total_requests": metric.total_requests,
                "successful_requests": metric.successful_requests,
                "error_requests": metric.error_requests,
                "success_rate": round(metric.successful_requests / metric.total_requests * 100, 2) if metric.total_requests > 0 else 0,
                "avg_response_time_ms": metric.avg_response_time_ms,
                "p95_response_time_ms": metric.p95_response_time_ms,
                "p99_response_time_ms": metric.p99_response_time_ms,
                "error_4xx": metric.error_4xx,
                "error_5xx": metric.error_5xx,
            }
            for metric in metrics
        ]
    }


@router.get("/analytics/retention-metrics")
def get_retention_metrics(
    cohort_months: int = Query(6, ge=1, le=24, description="Number of cohort months to retrieve"),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get user retention cohort analysis for the specified period."""
    since = datetime.now(timezone.utc).date().replace(day=1) - timedelta(days=cohort_months * 31)

    metrics = (
        db.query(RetentionMetrics)
        .filter(RetentionMetrics.cohort_month >= since)
        .order_by(RetentionMetrics.cohort_month.desc(), RetentionMetrics.period)
        .all()
    )

    # Group by cohort month
    cohort_data = {}
    for metric in metrics:
        cohort_key = str(metric.cohort_month)
        if cohort_key not in cohort_data:
            cohort_data[cohort_key] = {
                "cohort_month": cohort_key,
                "cohort_size": metric.cohort_size,
                "periods": []
            }

        cohort_data[cohort_key]["periods"].append({
            "period": metric.period,
            "retained_users": metric.retained_users,
            "retention_rate": metric.retention_rate,
        })

    return {
        "cohort_months": cohort_months,
        "cohorts": list(cohort_data.values())
    }


@router.get("/analytics/events")
def get_analytics_events(
    event_name: str = Query(None, description="Filter by specific event name"),
    days: int = Query(7, ge=1, le=30, description="Number of days to retrieve"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of events to return"),
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Get analytics events for the specified period."""
    since = datetime.now(timezone.utc).date() - timedelta(days=days)

    query = db.query(AnalyticsEvent).filter(AnalyticsEvent.event_date >= since)

    if event_name:
        query = query.filter(AnalyticsEvent.event_name == event_name)

    events = (
        query
        .order_by(AnalyticsEvent.event_date.desc(), AnalyticsEvent.hour.desc())
        .limit(limit)
        .all()
    )

    return {
        "period_days": days,
        "event_name_filter": event_name,
        "events": [
            {
                "event_name": event.event_name,
                "event_date": str(event.event_date),
                "hour": event.hour,
                "count": event.count,
                "properties": event.properties,
            }
            for event in events
        ]
    }
