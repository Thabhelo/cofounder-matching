from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

from app.schemas.user import UserPublicResponse


class IntroRequest(BaseModel):
    message: str = Field(..., min_length=100, max_length=500, description="Personalized introduction message (100-500 characters)")


class IntroResponse(BaseModel):
    accept: bool = Field(..., description="Whether to accept the introduction request")
    message: Optional[str] = Field(None, max_length=500, description="Optional response message")


class MatchStatusUpdate(BaseModel):
    status: str = Field(..., description="New status: viewed, saved, dismissed")


class MatchResponse(BaseModel):
    id: UUID
    user_id: UUID
    target_user_id: UUID
    match_score: int
    match_explanation: Optional[str] = None
    complementarity_score: Optional[int] = None
    stage_alignment_score: Optional[int] = None
    commitment_alignment_score: Optional[int] = None
    working_style_score: Optional[int] = None
    location_fit_score: Optional[int] = None
    intent_score: Optional[int] = None
    status: str
    intro_requested_at: Optional[datetime] = None
    intro_accepted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    target_user: Optional[UserPublicResponse] = None

    class Config:
        from_attributes = True


class MatchWithUserResponse(BaseModel):
    id: UUID
    user_id: UUID
    target_user_id: UUID
    match_score: int
    match_explanation: Optional[str] = None
    complementarity_score: Optional[int] = None
    stage_alignment_score: Optional[int] = None
    commitment_alignment_score: Optional[int] = None
    working_style_score: Optional[int] = None
    location_fit_score: Optional[int] = None
    intent_score: Optional[int] = None
    status: str
    intro_requested_at: Optional[datetime] = None
    intro_accepted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    target_user: UserPublicResponse

    class Config:
        from_attributes = True
