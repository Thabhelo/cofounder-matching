from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional
from datetime import datetime, date
from uuid import UUID

from app.constants.enums import (
    IDEA_STATUSES,
    READY_TO_START_OPTIONS,
    AREAS_OF_OWNERSHIP,
    IMPORTANCE_LEVELS,
    GENDERS,
    PROFILE_STATUSES,
)


class SkillItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    level: str = Field(..., description="Skill level: beginner, intermediate, advanced, expert")
    years: int = Field(..., ge=0, le=50)


class ProofOfWork(BaseModel):
    type: str = Field(..., description="Type: github, portfolio, project, publication, etc.")
    url: str = Field(..., description="URL to the proof of work")
    description: Optional[str] = Field(None, max_length=500)


def _normalize_int(v):
    """Normalize integer inputs: '02' -> 2, '' -> None."""
    if v is None or v == "":
        return None
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
        return int(v)
    return v


def _validate_one_of_required(value: str, allowed: list[str], field_name: str) -> str:
    """Validate that value is in allowed list (for required fields)."""
    if value not in allowed:
        raise ValueError(f"{field_name} must be one of {allowed}")
    return value


def _validate_one_of_optional(value: Optional[str], allowed: list[str], field_name: str) -> Optional[str]:
    """Validate that value is in allowed list or None (for optional fields)."""
    if value is None:
        return value
    if value not in allowed:
        raise ValueError(f"{field_name} must be one of {allowed}")
    return value


def _validate_list_items(value: list[str], allowed: list[str], field_name: str) -> list[str]:
    """Validate that each item in value is in allowed list."""
    for item in value:
        if item not in allowed:
            raise ValueError(f"Invalid {field_name}: {item}. Must be one of {allowed}")
    return value


class UserOnboarding(BaseModel):
    """Full onboarding payload. Email/name optional (from Clerk token)."""

    email: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None

    # Required
    linkedin_url: str = Field(..., max_length=500)
    location: str = Field(..., max_length=500)
    introduction: str = Field(..., max_length=2000)
    is_technical: bool = Field(...)
    idea_status: str = Field(..., description="not_set_on_idea | have_ideas_flexible | building_specific_idea")
    ready_to_start: str = Field(..., description="now | 1_month | 3_months | 6_months | exploring")
    areas_of_ownership: list[str] = Field(..., min_length=1)
    topics_of_interest: list[str] = Field(..., min_length=1)
    equity_expectation: str = Field(..., max_length=500)
    looking_for_description: str = Field(..., max_length=1000)

    # Optional basics
    gender: Optional[str] = Field(None, max_length=20)
    birthdate: Optional[date] = None
    location_city: Optional[str] = Field(None, max_length=100)
    location_state: Optional[str] = Field(None, max_length=100)
    location_country: Optional[str] = Field(None, max_length=100)
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    twitter_url: Optional[str] = Field(None, max_length=500)
    instagram_url: Optional[str] = Field(None, max_length=500)
    calendly_url: Optional[str] = Field(None, max_length=500)
    video_intro_url: Optional[str] = Field(None, max_length=500)
    life_story: Optional[str] = Field(None, max_length=2000)
    hobbies: Optional[str] = Field(None, max_length=1000)
    impressive_accomplishment: Optional[str] = Field(None, max_length=2000)
    education_history: Optional[str] = Field(None, max_length=2000)
    employment_history: Optional[str] = Field(None, max_length=2000)
    experience_years: Optional[int] = Field(None, ge=0, le=70)
    previous_startups: int = Field(0, ge=0, le=50)
    github_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    commitment: Optional[str] = Field(None, max_length=50)
    work_location_preference: Optional[str] = Field(None, max_length=50)

    # Optional startup (if building)
    startup_name: Optional[str] = Field(None, max_length=255)
    startup_description: Optional[str] = Field(None, max_length=2000)
    startup_progress: Optional[str] = None
    startup_funding: Optional[str] = None
    domain_expertise: Optional[list[str]] = None

    # Preferences (optional)
    pref_idea_status: Optional[str] = None
    pref_idea_importance: Optional[str] = None
    pref_technical: Optional[bool] = None
    pref_technical_importance: Optional[str] = None
    pref_match_timing: Optional[bool] = None
    pref_timing_importance: Optional[str] = None
    pref_location_type: Optional[str] = None
    pref_location_distance_miles: Optional[int] = Field(None, ge=1, le=5000)
    pref_location_importance: Optional[str] = None
    pref_age_min: Optional[int] = Field(None, ge=18, le=100)
    pref_age_max: Optional[int] = Field(None, ge=18, le=100)
    pref_age_importance: Optional[str] = None
    pref_cofounder_areas: Optional[list[str]] = None
    pref_areas_importance: Optional[str] = None
    pref_shared_interests: Optional[bool] = None
    pref_interests_importance: Optional[str] = None
    alert_on_new_matches: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_empty_fields(cls, data):
        if isinstance(data, dict):
            for field_name in ["email", "name"]:
                if field_name in data:
                    v = data[field_name]
                    if v == "" or v is None or (isinstance(v, str) and not v.strip()):
                        data.pop(field_name, None)
        return data

    @field_validator("idea_status")
    @classmethod
    def validate_idea_status(cls, v: str) -> str:
        return _validate_one_of_required(v, IDEA_STATUSES, "idea_status")

    @field_validator("ready_to_start")
    @classmethod
    def validate_ready_to_start(cls, v: str) -> str:
        return _validate_one_of_required(v, READY_TO_START_OPTIONS, "ready_to_start")

    @field_validator("areas_of_ownership")
    @classmethod
    def validate_areas(cls, v: list[str]) -> list[str]:
        return _validate_list_items(v, AREAS_OF_OWNERSHIP, "areas_of_ownership")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        return _validate_one_of_optional(v, GENDERS, "gender")

    @field_validator(
        "pref_idea_importance",
        "pref_technical_importance",
        "pref_timing_importance",
        "pref_location_importance",
        "pref_age_importance",
        "pref_areas_importance",
        "pref_interests_importance",
    )
    @classmethod
    def validate_importance(cls, v: Optional[str]) -> Optional[str]:
        return _validate_one_of_optional(v, IMPORTANCE_LEVELS, "importance")

    @field_validator(
        "experience_years",
        "pref_age_min",
        "pref_age_max",
        "pref_location_distance_miles",
        mode="before",
    )
    @classmethod
    def normalize_integers(cls, v):
        return _normalize_int(v) if v is not None and (isinstance(v, str) or v == "") else v

    @field_validator("previous_startups", mode="before")
    @classmethod
    def normalize_previous_startups(cls, v):
        n = _normalize_int(v) if (v is not None and (isinstance(v, str) or v == "")) else v
        return 0 if n is None else n

    @model_validator(mode="after")
    def validate_age_range(self):
        if self.pref_age_min is not None and self.pref_age_max is not None:
            if self.pref_age_min > self.pref_age_max:
                raise ValueError("pref_age_min must be <= pref_age_max")
        return self

    model_config = ConfigDict(populate_by_name=True)


class UserUpdate(BaseModel):
    """Partial update; all fields optional."""

    name: Optional[str] = Field(None, min_length=2, max_length=255)
    avatar_url: Optional[str] = Field(None, max_length=500)
    introduction: Optional[str] = Field(None, max_length=2000)
    location: Optional[str] = Field(None, max_length=500)
    location_city: Optional[str] = Field(None, max_length=100)
    location_state: Optional[str] = Field(None, max_length=100)
    location_country: Optional[str] = Field(None, max_length=100)
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    gender: Optional[str] = Field(None, max_length=20)
    birthdate: Optional[date] = None
    linkedin_url: Optional[str] = Field(None, max_length=500)
    twitter_url: Optional[str] = Field(None, max_length=500)
    instagram_url: Optional[str] = Field(None, max_length=500)
    calendly_url: Optional[str] = Field(None, max_length=500)
    video_intro_url: Optional[str] = Field(None, max_length=500)
    github_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    life_story: Optional[str] = Field(None, max_length=2000)
    hobbies: Optional[str] = Field(None, max_length=1000)
    impressive_accomplishment: Optional[str] = Field(None, max_length=2000)
    education_history: Optional[str] = Field(None, max_length=2000)
    employment_history: Optional[str] = Field(None, max_length=2000)
    experience_years: Optional[int] = Field(None, ge=0, le=70)
    previous_startups: Optional[int] = Field(None, ge=0, le=50)
    idea_status: Optional[str] = None
    is_technical: Optional[bool] = None
    startup_name: Optional[str] = Field(None, max_length=255)
    startup_description: Optional[str] = Field(None, max_length=2000)
    startup_progress: Optional[str] = None
    startup_funding: Optional[str] = None
    ready_to_start: Optional[str] = None
    commitment: Optional[str] = None
    areas_of_ownership: Optional[list[str]] = None
    topics_of_interest: Optional[list[str]] = None
    domain_expertise: Optional[list[str]] = None
    equity_expectation: Optional[str] = Field(None, max_length=500)
    work_location_preference: Optional[str] = None
    looking_for_description: Optional[str] = Field(None, max_length=1000)
    pref_idea_status: Optional[str] = None
    pref_idea_importance: Optional[str] = None
    pref_technical: Optional[bool] = None
    pref_technical_importance: Optional[str] = None
    pref_match_timing: Optional[bool] = None
    pref_timing_importance: Optional[str] = None
    pref_location_type: Optional[str] = None
    pref_location_distance_miles: Optional[int] = Field(None, ge=1, le=5000)
    pref_location_importance: Optional[str] = None
    pref_age_min: Optional[int] = Field(None, ge=18, le=100)
    pref_age_max: Optional[int] = Field(None, ge=18, le=100)
    pref_age_importance: Optional[str] = None
    pref_cofounder_areas: Optional[list[str]] = None
    pref_areas_importance: Optional[str] = None
    pref_shared_interests: Optional[bool] = None
    pref_interests_importance: Optional[str] = None
    alert_on_new_matches: Optional[bool] = None

    @field_validator("idea_status")
    @classmethod
    def validate_idea_status(cls, v: Optional[str]) -> Optional[str]:
        return _validate_one_of_optional(v, IDEA_STATUSES, "idea_status")

    @field_validator("ready_to_start")
    @classmethod
    def validate_ready_to_start(cls, v: Optional[str]) -> Optional[str]:
        return _validate_one_of_optional(v, READY_TO_START_OPTIONS, "ready_to_start")

    @field_validator("areas_of_ownership")
    @classmethod
    def validate_areas(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return v
        return _validate_list_items(v, AREAS_OF_OWNERSHIP, "areas_of_ownership")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        return _validate_one_of_optional(v, GENDERS, "gender")

    @field_validator(
        "pref_idea_importance",
        "pref_technical_importance",
        "pref_timing_importance",
        "pref_location_importance",
        "pref_age_importance",
        "pref_areas_importance",
        "pref_interests_importance",
    )
    @classmethod
    def validate_importance(cls, v: Optional[str]) -> Optional[str]:
        return _validate_one_of_optional(v, IMPORTANCE_LEVELS, "importance")

    @field_validator(
        "experience_years",
        "pref_age_min",
        "pref_age_max",
        "pref_location_distance_miles",
        mode="before",
    )
    @classmethod
    def normalize_integers(cls, v):
        return _normalize_int(v) if (v is not None and (isinstance(v, str) or v == "")) else v

    @model_validator(mode="after")
    def validate_age_range(self):
        if self.pref_age_min is not None and self.pref_age_max is not None:
            if self.pref_age_min > self.pref_age_max:
                raise ValueError("pref_age_min must be <= pref_age_max")
        return self


class AdminUserUpdate(UserUpdate):
    """Admin-only: update any user field plus profile_status and is_active."""
    profile_status: Optional[str] = Field(None, description="incomplete, pending_review, approved, rejected")
    is_active: Optional[bool] = None

    @field_validator("profile_status")
    @classmethod
    def validate_profile_status(cls, v: Optional[str]) -> Optional[str]:
        return _validate_one_of_optional(v, PROFILE_STATUSES, "profile_status")


class UserResponse(BaseModel):
    """Full profile response for GET /users/me."""

    id: UUID
    email: str
    name: str
    avatar_url: Optional[str] = None
    introduction: Optional[str] = None
    location: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_country: Optional[str] = None
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    gender: Optional[str] = None
    birthdate: Optional[date] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    instagram_url: Optional[str] = None
    calendly_url: Optional[str] = None
    video_intro_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    life_story: Optional[str] = None
    hobbies: Optional[str] = None
    impressive_accomplishment: Optional[str] = None
    education_history: Optional[str] = None
    employment_history: Optional[str] = None
    experience_years: Optional[int] = None
    previous_startups: Optional[int] = Field(default=0, ge=0, le=50)
    idea_status: Optional[str] = None
    is_technical: Optional[bool] = None
    startup_name: Optional[str] = None
    startup_description: Optional[str] = None
    startup_progress: Optional[str] = None
    startup_funding: Optional[str] = None
    ready_to_start: Optional[str] = None
    commitment: Optional[str] = None
    areas_of_ownership: Optional[list] = None
    topics_of_interest: Optional[list] = None
    domain_expertise: Optional[list] = None
    equity_expectation: Optional[str] = None
    work_location_preference: Optional[str] = None
    looking_for_description: Optional[str] = None
    pref_idea_status: Optional[str] = None
    pref_idea_importance: Optional[str] = None
    pref_technical: Optional[bool] = None
    pref_technical_importance: Optional[str] = None
    pref_match_timing: Optional[bool] = None
    pref_timing_importance: Optional[str] = None
    pref_location_type: Optional[str] = None
    pref_location_distance_miles: Optional[int] = None
    pref_location_importance: Optional[str] = None
    pref_age_min: Optional[int] = None
    pref_age_max: Optional[int] = None
    pref_age_importance: Optional[str] = None
    pref_cofounder_areas: Optional[list] = None
    pref_areas_importance: Optional[str] = None
    pref_shared_interests: Optional[bool] = None
    pref_interests_importance: Optional[str] = None
    alert_on_new_matches: bool = False
    behavior_agreement_accepted_at: Optional[datetime] = None
    profile_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool = True
    is_banned: bool = False

    @field_validator("previous_startups", mode="before")
    @classmethod
    def normalize_previous_startups(cls, v):
        return 0 if v is None else v

    @field_validator("alert_on_new_matches", mode="before")
    @classmethod
    def normalize_alert_on_new_matches(cls, v):
        return False if v is None else v

    model_config = ConfigDict(from_attributes=True)


class UserPublicResponse(BaseModel):
    """Public profile for GET /users/{id} and recommendations."""

    id: UUID
    name: str
    avatar_url: Optional[str] = None
    introduction: Optional[str] = None
    location: Optional[str] = None
    location_city: Optional[str] = None
    location_country: Optional[str] = None
    idea_status: Optional[str] = None
    is_technical: Optional[bool] = None
    commitment: Optional[str] = None
    areas_of_ownership: Optional[list] = None
    topics_of_interest: Optional[list] = None
    experience_years: Optional[int] = None
    previous_startups: Optional[int] = Field(default=0, ge=0, le=50)
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None

    @field_validator("previous_startups", mode="before")
    @classmethod
    def normalize_previous_startups(cls, v):
        return 0 if v is None else v

    model_config = ConfigDict(from_attributes=True)


class ProfileDiscoverResponse(BaseModel):
    """Profile in discover/recommendations with optional 'matched before' tag."""
    profile: UserPublicResponse
    matched_before: bool = False
