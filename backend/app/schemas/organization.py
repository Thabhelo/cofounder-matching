from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=255, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = Field(None, max_length=5000)
    website_url: Optional[str] = Field(None, max_length=500)
    logo_url: Optional[str] = Field(None, max_length=500)
    org_type: Optional[str] = Field(None, description="accelerator, university, nonprofit, coworking, government, other")
    focus_areas: Optional[list[str]] = Field(None, max_items=20)
    location: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)

    @field_validator("org_type")
    @classmethod
    def validate_org_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ["accelerator", "university", "nonprofit", "coworking", "government", "other"]
        if v not in allowed:
            raise ValueError(f"org_type must be one of {allowed}")
        return v


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    website_url: Optional[str] = Field(None, max_length=500)
    logo_url: Optional[str] = Field(None, max_length=500)
    org_type: Optional[str] = None
    focus_areas: Optional[list[str]] = Field(None, max_items=20)
    location: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=50)


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    org_type: Optional[str] = None
    focus_areas: Optional[list] = None
    location: Optional[str] = None
    is_verified: bool
    verification_method: Optional[str] = None
    verified_at: Optional[datetime] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True
