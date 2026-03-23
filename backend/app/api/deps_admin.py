"""
Admin-specific dependencies for FastAPI endpoints.
Provides authentication and authorization for admin functions.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User


async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current admin user.
    Ensures the current user has admin privileges.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is inactive"
        )

    if current_user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is banned"
        )

    return current_user


async def get_current_super_admin_user(
    current_admin: User = Depends(get_current_admin_user)
) -> User:
    """
    Dependency for super admin functions.
    Add this if you have different admin levels.
    """
    # This is a placeholder - you'd implement super admin logic based on your needs
    # For example, checking a specific role or permission level

    # For now, just return the admin user
    return current_admin