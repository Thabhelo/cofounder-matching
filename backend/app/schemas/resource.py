from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class ResourceCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20, max_length=5000)
    category: str = Field(..., description="funding, mentorship, legal, accounting, prototyping, program, other")
    resource_type: Optional[str] = Field(None, description="grant, loan, service, program, tool")
    stage_eligibility: Optional[list[str]] = Field(None, max_items=10)
    location_eligibility: Optional[list[str]] = Field(None, max_items=50)
    other_eligibility: Optional[str] = Field(None, max_length=1000)
    amount_min: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    amount_max: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    currency: str = Field("USD", min_length=3, max_length=3)
    application_url: Optional[str] = Field(None, max_length=500)
    deadline: Optional[date] = None
    tags: Optional[list[str]] = Field(None, max_items=20)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = ["funding", "mentorship", "legal", "accounting", "prototyping", "program", "other"]
        if v not in allowed:
            raise ValueError(f"category must be one of {allowed}")
        return v


class ResourceUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=20, max_length=5000)
    category: Optional[str] = None
    resource_type: Optional[str] = None
    stage_eligibility: Optional[list[str]] = Field(None, max_items=10)
    location_eligibility: Optional[list[str]] = Field(None, max_items=50)
    other_eligibility: Optional[str] = Field(None, max_length=1000)
    amount_min: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    amount_max: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    application_url: Optional[str] = Field(None, max_length=500)
    deadline: Optional[date] = None
    tags: Optional[list[str]] = Field(None, max_items=20)
    is_active: Optional[bool] = None


class ResourceResponse(BaseModel):
    id: UUID
    organization_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    title: str
    description: str
    category: str
    resource_type: Optional[str] = None
    stage_eligibility: Optional[list] = None
    location_eligibility: Optional[list] = None
    other_eligibility: Optional[str] = None
    amount_min: Optional[Decimal] = None
    amount_max: Optional[Decimal] = None
    currency: str
    application_url: Optional[str] = None
    deadline: Optional[date] = None
    tags: Optional[list] = None
    is_featured: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
