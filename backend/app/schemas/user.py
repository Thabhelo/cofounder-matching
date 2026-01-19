from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime, date
from uuid import UUID


class SkillItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    level: str = Field(..., description="Skill level: beginner, intermediate, advanced, expert")
    years: int = Field(..., ge=0, le=50)


class ProofOfWork(BaseModel):
    type: str = Field(..., description="Type: github, portfolio, project, publication, etc.")
    url: str = Field(..., description="URL to the proof of work")
    description: Optional[str] = Field(None, max_length=500)


class UserOnboarding(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=255)
    role_intent: str = Field(..., description="founder, cofounder, early_employee")
    bio: Optional[str] = Field(None, max_length=2000)
    stage_preference: Optional[str] = Field(None, description="idea, mvp, revenue, growth")
    commitment: Optional[str] = Field(None, description="full_time, part_time, exploratory")
    location: Optional[str] = Field(None, max_length=255)
    working_style: Optional[str] = Field(None, description="structured, chaotic, flexible")
    communication_preference: Optional[str] = Field(None, description="async, sync, mixed")
    skills: Optional[list[SkillItem]] = None
    experience_years: Optional[int] = Field(None, ge=0, le=70)
    previous_startups: int = Field(0, ge=0, le=50)
    github_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    linkedin_url: Optional[str] = Field(None, max_length=500)

    @field_validator("role_intent")
    @classmethod
    def validate_role_intent(cls, v: str) -> str:
        allowed = ["founder", "cofounder", "early_employee"]
        if v not in allowed:
            raise ValueError(f"role_intent must be one of {allowed}")
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    bio: Optional[str] = Field(None, max_length=2000)
    avatar_url: Optional[str] = Field(None, max_length=500)
    role_intent: Optional[str] = None
    stage_preference: Optional[str] = None
    commitment: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    location_preference: Optional[list[str]] = None
    travel_tolerance: Optional[str] = None
    working_style: Optional[str] = None
    communication_preference: Optional[str] = None
    skills: Optional[list[SkillItem]] = None
    experience_years: Optional[int] = Field(None, ge=0, le=70)
    previous_startups: Optional[int] = Field(None, ge=0, le=50)
    proof_of_work: Optional[list[ProofOfWork]] = None
    github_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    availability_status: Optional[str] = None
    availability_date: Optional[date] = None


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role_intent: str
    stage_preference: Optional[str] = None
    commitment: Optional[str] = None
    location: Optional[str] = None
    location_preference: Optional[list] = None
    travel_tolerance: Optional[str] = None
    working_style: Optional[str] = None
    communication_preference: Optional[str] = None
    skills: Optional[list] = None
    experience_years: Optional[int] = None
    previous_startups: int
    proof_of_work: Optional[list] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    trust_score: int
    is_verified: bool
    verification_method: Optional[str] = None
    availability_status: Optional[str] = None
    availability_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    last_active_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class UserPublicResponse(BaseModel):
    """Public user profile - limited information for non-matched users"""
    id: UUID
    name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role_intent: str
    stage_preference: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[list] = None
    experience_years: Optional[int] = None
    previous_startups: int
    trust_score: int
    is_verified: bool
    availability_status: Optional[str] = None

    class Config:
        from_attributes = True
