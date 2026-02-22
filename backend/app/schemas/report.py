from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional

from app.constants.enums import REPORT_TYPES


class ReportCreate(BaseModel):
    reported_user_id: UUID
    report_type: str = Field(..., description="One of: spam, abuse, inappropriate, fake, other")
    description: str = Field(..., min_length=10, max_length=2000)

    @field_validator("report_type")
    @classmethod
    def report_type_one_of(cls, v: str) -> str:
        if v not in REPORT_TYPES:
            raise ValueError(f"report_type must be one of {REPORT_TYPES}")
        return v


class ReportReview(BaseModel):
    status: str = Field(..., description="One of: reviewed, resolved, dismissed")
    resolution_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("status")
    @classmethod
    def status_one_of(cls, v: str) -> str:
        if v not in ("reviewed", "resolved", "dismissed"):
            raise ValueError("status must be one of: reviewed, resolved, dismissed")
        return v


class ReportResponse(BaseModel):
    id: UUID
    reporter_id: Optional[UUID]
    reported_user_id: Optional[UUID]
    report_type: str
    description: str
    status: str
    reviewed_by: Optional[UUID]
    reviewed_at: Optional[datetime]
    resolution_notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportListItem(ReportResponse):
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    reported_user_name: Optional[str] = None
    reported_user_email: Optional[str] = None
