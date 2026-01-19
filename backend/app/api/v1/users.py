from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOnboarding, UserUpdate, UserResponse, UserPublicResponse
from app.api.deps import get_current_user, get_clerk_id_from_token

router = APIRouter()


@router.post("/onboarding", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def onboarding_user(
    user_data: UserOnboarding,
    clerk_id: str = Depends(get_clerk_id_from_token),
    db: Session = Depends(get_db)
):
    """Complete user onboarding - create user profile after Clerk signup

    SECURITY: This endpoint requires a valid Clerk JWT token. The clerk_id is extracted
    from the validated JWT token (not from request body/query params) to prevent account takeover.
    """
    # Check if user already exists with this clerk_id
    existing_user = db.query(User).filter(User.clerk_id == clerk_id).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists. Use PUT /users/me to update profile."
        )

    # Check if email is already in use
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already in use"
        )

    user_dict = user_data.model_dump()
    user_dict["clerk_id"] = clerk_id

    user = User(**user_dict)
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user's full profile"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    update_data = user_update.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return current_user


@router.get("/{user_id}", response_model=UserPublicResponse)
async def get_user_profile(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Get public user profile - limited information for privacy"""
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True,
        User.is_banned == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.get("", response_model=List[UserPublicResponse])
async def search_users(
    role_intent: str = Query(None, description="Filter by role intent"),
    stage_preference: str = Query(None, description="Filter by stage preference"),
    location: str = Query(None, description="Filter by location"),
    availability_status: str = Query(None, description="Filter by availability status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Search users with filters"""
    query = db.query(User).filter(
        User.is_active == True,
        User.is_banned == False
    )

    if role_intent:
        query = query.filter(User.role_intent == role_intent)
    if stage_preference:
        query = query.filter(User.stage_preference == stage_preference)
    if location:
        query = query.filter(User.location.ilike(f"%{location}%"))
    if availability_status:
        query = query.filter(User.availability_status == availability_status)

    users = query.order_by(User.trust_score.desc()).offset(skip).limit(limit).all()
    return users
