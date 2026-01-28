from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.resource import Resource
from app.models.organization import OrganizationMember
from app.schemas.resource import ResourceCreate, ResourceUpdate, ResourceResponse
from app.api.deps import get_current_user, get_optional_current_user
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[ResourceResponse])
async def list_resources(
    category: Optional[str] = Query(None, description="Filter by category"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    stage: Optional[str] = Query(None, description="Filter by stage eligibility"),
    featured_only: bool = Query(False, description="Show only featured resources"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """List resources with optional filters - public endpoint"""
    query = db.query(Resource).filter(Resource.is_active)

    if category:
        query = query.filter(Resource.category == category)
    if resource_type:
        query = query.filter(Resource.resource_type == resource_type)
    if stage:
        query = query.filter(Resource.stage_eligibility.contains([stage]))
    if featured_only:
        query = query.filter(Resource.is_featured)

    resources = query.order_by(
        Resource.is_featured.desc(),
        Resource.created_at.desc()
    ).offset(skip).limit(limit).all()

    return resources


@router.get("/{resource_id}", response_model=ResourceResponse)
async def get_resource(
    resource_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Get resource by ID - public endpoint"""
    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.is_active
    ).first()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )

    return resource


@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(
    resource_data: ResourceCreate,
    organization_id: Optional[str] = Query(None, description="Associate with organization"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new resource - requires authentication"""
    resource_dict = resource_data.model_dump()
    resource_dict["created_by"] = current_user.id

    if organization_id:
        # Verify user is a member of the organization with appropriate permissions
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role.in_(["admin", "staff"])
        ).first()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to create resources for this organization"
            )

        resource_dict["organization_id"] = organization_id

    resource = Resource(**resource_dict)
    db.add(resource)
    db.commit()
    db.refresh(resource)

    return resource


@router.put("/{resource_id}", response_model=ResourceResponse)
async def update_resource(
    resource_id: str,
    resource_update: ResourceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update resource - requires authentication and ownership or organization membership"""
    resource = db.query(Resource).filter(Resource.id == resource_id).first()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )

    # Check if user is creator or organization member
    is_creator = resource.created_by == current_user.id
    is_org_member = False

    if resource.organization_id:
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == resource.organization_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role.in_(["admin", "staff"])
        ).first()
        is_org_member = member is not None

    if not is_creator and not is_org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this resource"
        )

    update_data = resource_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    for field, value in update_data.items():
        setattr(resource, field, value)

    db.commit()
    db.refresh(resource)

    return resource


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete resource - requires authentication and ownership or organization membership"""
    resource = db.query(Resource).filter(Resource.id == resource_id).first()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )

    # Check if user is creator or organization member
    is_creator = resource.created_by == current_user.id
    is_org_member = False

    if resource.organization_id:
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == resource.organization_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role.in_(["admin", "staff"])
        ).first()
        is_org_member = member is not None

    if not is_creator and not is_org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this resource"
        )

    resource.is_active = False
    db.commit()

    return None
