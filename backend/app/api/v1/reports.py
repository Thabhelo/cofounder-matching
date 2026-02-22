from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    body: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a report against a user (e.g. abuse, spam)."""
    if body.reported_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot report yourself",
        )
    reported = db.query(User).filter(User.id == body.reported_user_id).first()
    if not reported:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if reported.is_banned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already banned",
        )
    report = Report(
        reporter_id=current_user.id,
        reported_user_id=body.reported_user_id,
        report_type=body.report_type,
        description=body.description,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
