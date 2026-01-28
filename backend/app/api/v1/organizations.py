from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.organization import Organization, OrganizationMember
from app.schemas.organization import OrganizationCreate, OrganizationUpdate, OrganizationResponse
from app.api.deps import get_current_user, get_optional_current_user
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    org_type: Optional[str] = Query(None, description="Filter by organization type"),
    verified_only: bool = Query(False, description="Show only verified organizations"),
    location: Optional[str] = Query(None, description="Filter by location"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """List organizations with optional filters - public endpoint"""
    query = db.query(Organization).filter(Organization.is_active)

    if org_type:
        query = query.filter(Organization.org_type == org_type)
    if verified_only:
        query = query.filter(Organization.is_verified)
    if location:
        query = query.filter(Organization.location.ilike(f"%{location}%"))

    organizations = query.order_by(
        Organization.is_verified.desc(),
        Organization.created_at.desc()
    ).offset(skip).limit(limit).all()

    return organizations


@router.get("/{org_id_or_slug}", response_model=OrganizationResponse)
async def get_organization(
    org_id_or_slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Get organization by ID or slug - public endpoint"""
    org = db.query(Organization).filter(
        (Organization.id == org_id_or_slug) | (Organization.slug == org_id_or_slug),
        Organization.is_active
    ).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    return org


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new organization - requires authentication"""
    existing_slug = db.query(Organization).filter(Organization.slug == org_data.slug).first()
    if existing_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization slug already exists"
        )

    org = Organization(**org_data.model_dump())
    db.add(org)
    db.flush()

    # Add creator as admin member
    member = OrganizationMember(
        organization_id=org.id,
        user_id=current_user.id,
        role="admin",
        is_primary=True
    )
    db.add(member)
    db.commit()
    db.refresh(org)

    return org


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: str,
    org_update: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update organization - requires authentication and ownership"""
    org = db.query(Organization).filter(Organization.id == org_id).first()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Verify user has permission to update this organization
    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org.id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.role.in_(["admin", "staff"])
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to update this organization"
        )

    update_data = org_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    for field, value in update_data.items():
        setattr(org, field, value)

    db.commit()
    db.refresh(org)

    return org
