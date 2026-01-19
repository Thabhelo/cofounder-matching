from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class EventCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20, max_length=5000)
    event_type: Optional[str] = Field(None, description="workshop, networking, pitch, conference, webinar, other")
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    timezone: str = Field("America/Chicago", max_length=50)
    location_type: Optional[str] = Field(None, description="in_person, virtual, hybrid")
    location_address: Optional[str] = Field(None, max_length=500)
    location_url: Optional[str] = Field(None, max_length=500)
    registration_url: Optional[str] = Field(None, max_length=500)
    registration_required: bool = False
    max_attendees: Optional[int] = Field(None, ge=1, le=100000)
    tags: Optional[list[str]] = Field(None, max_items=20)

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ["workshop", "networking", "pitch", "conference", "webinar", "other"]
        if v not in allowed:
            raise ValueError(f"event_type must be one of {allowed}")
        return v

    @field_validator("location_type")
    @classmethod
    def validate_location_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ["in_person", "virtual", "hybrid"]
        if v not in allowed:
            raise ValueError(f"location_type must be one of {allowed}")
        return v


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=20, max_length=5000)
    event_type: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    timezone: Optional[str] = Field(None, max_length=50)
    location_type: Optional[str] = None
    location_address: Optional[str] = Field(None, max_length=500)
    location_url: Optional[str] = Field(None, max_length=500)
    registration_url: Optional[str] = Field(None, max_length=500)
    registration_required: Optional[bool] = None
    max_attendees: Optional[int] = Field(None, ge=1, le=100000)
    tags: Optional[list[str]] = Field(None, max_items=20)
    is_active: Optional[bool] = None


class EventRSVP(BaseModel):
    rsvp_status: str = Field(..., description="going, maybe, not_going")

    @field_validator("rsvp_status")
    @classmethod
    def validate_rsvp_status(cls, v: str) -> str:
        allowed = ["going", "maybe", "not_going"]
        if v not in allowed:
            raise ValueError(f"rsvp_status must be one of {allowed}")
        return v


class EventResponse(BaseModel):
    id: UUID
    organization_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    title: str
    description: str
    event_type: Optional[str] = None
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    timezone: str
    location_type: Optional[str] = None
    location_address: Optional[str] = None
    location_url: Optional[str] = None
    registration_url: Optional[str] = None
    registration_required: bool
    max_attendees: Optional[int] = None
    current_attendees: int
    tags: Optional[list] = None
    is_featured: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
