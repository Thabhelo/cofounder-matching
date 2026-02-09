from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict
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
    # Name and email are optional - will be extracted from Clerk JWT token if not provided
    # This allows seamless OAuth onboarding without re-asking for verified information
    # Using plain str instead of EmailStr to avoid validation issues with empty strings
    # Backend endpoint will validate email format if provided, or extract from Clerk token
    # In Pydantic v2, Optional[type] = None makes field truly optional (can be omitted)
    # These fields are NOT required - they will be extracted from Clerk JWT token if missing
    # Using simple = None syntax (most reliable for Pydantic v2)
    email: Optional[str] = None
    name: Optional[str] = None
    role_intent: str = Field(..., description="founder, cofounder, early_employee")
    bio: Optional[str] = Field(None, max_length=2000)
    commitment: Optional[str] = Field(None, description="full_time, part_time, exploratory")
    location: Optional[str] = Field(None, max_length=255, description="City, State/Province format recommended (e.g., 'San Francisco, CA' or 'Remote')")
    skills: Optional[list[SkillItem]] = None
    experience_years: Optional[int] = Field(None, ge=0, le=70)
    previous_startups: int = Field(0, ge=0, le=50)
    github_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    linkedin_url: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="before")
    @classmethod
    def normalize_empty_fields(cls, data):
        """Remove empty/null email/name fields entirely - backend extracts from Clerk token
        
        This validator runs BEFORE Pydantic's field validation, ensuring that empty strings
        or null values for email/name are completely removed from the data dict.
        This prevents Pydantic from trying to validate them, since they're optional and
        will be extracted from the Clerk JWT token by the endpoint if missing.
        """
        if isinstance(data, dict):
            # Remove email/name if they're empty strings, null, or None
            # This prevents Pydantic from trying to validate them
            # Backend will extract these from Clerk JWT token if missing
            for field_name in ["email", "name"]:
                if field_name in data:
                    field_val = data[field_name]
                    # Remove if empty string, None, or whitespace-only string
                    if field_val == "" or field_val is None or (isinstance(field_val, str) and not field_val.strip()):
                        data.pop(field_name, None)  # Remove entirely, don't set to None
        return data

    @field_validator("role_intent")
    @classmethod
    def validate_role_intent(cls, v: str) -> str:
        allowed = ["founder", "cofounder", "early_employee"]
        if v not in allowed:
            raise ValueError(f"role_intent must be one of {allowed}")
        return v

    model_config = ConfigDict(
        # Allow fields to be missing if they have defaults
        # This ensures email and name can be completely omitted from request body
        populate_by_name=True,
    )


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    bio: Optional[str] = Field(None, max_length=2000)
    avatar_url: Optional[str] = Field(None, max_length=500)
    role_intent: Optional[str] = None
    commitment: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    location_preference: Optional[list[str]] = None
    travel_tolerance: Optional[str] = None
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
    role_intent: Optional[str] = None  # Made optional to match model
    commitment: Optional[str] = None
    location: Optional[str] = None
    # Fields not in User model - made optional with defaults
    location_preference: Optional[list] = None
    travel_tolerance: Optional[str] = None
    skills: Optional[list] = None
    experience_years: Optional[int] = None
    previous_startups: Optional[int] = Field(default=0, ge=0, le=50)  # Optional to handle None from DB, default to 0
    proof_of_work: Optional[list] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    # Fields not in User model - provide defaults
    trust_score: int = 0
    is_verified: bool = False
    verification_method: Optional[str] = None
    availability_status: Optional[str] = None
    availability_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    last_active_at: Optional[datetime] = None  # Not in model, make optional
    is_active: bool = True
    is_banned: bool = False  # Add missing field from model

    @field_validator("previous_startups", mode="before")
    @classmethod
    def normalize_previous_startups(cls, v):
        """Convert None to 0 for previous_startups"""
        return 0 if v is None else v

    class Config:
        from_attributes = True


class UserPublicResponse(BaseModel):
    """Public user profile - limited information for non-matched users"""
    id: UUID
    name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role_intent: Optional[str] = None  # Made optional to match model
    commitment: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[list] = None
    experience_years: Optional[int] = None
    previous_startups: Optional[int] = Field(default=0, ge=0, le=50)  # Optional to handle None from DB, default to 0
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    trust_score: int = 0  # Default since not in model
    is_verified: bool = False  # Default since not in model
    availability_status: Optional[str] = None

    @field_validator("previous_startups", mode="before")
    @classmethod
    def normalize_previous_startups(cls, v):
        """Convert None to 0 for previous_startups"""
        return 0 if v is None else v

    class Config:
        from_attributes = True
