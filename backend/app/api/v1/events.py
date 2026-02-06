from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.event import Event, UserEventRSVP
from app.models.organization import OrganizationMember
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate, EventRSVP, EventResponse
from app.api.deps import get_current_user, get_optional_current_user

router = APIRouter()


@router.get("", response_model=List[EventResponse])
async def list_events(
    q: str = Query(None, description="Search query for title or description"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    location_type: Optional[str] = Query(None, description="Filter by location type"),
    organization_id: Optional[str] = Query(None, description="Filter by organization"),
    upcoming_only: bool = Query(True, description="Show only upcoming events"),
    featured_only: bool = Query(False, description="Show only featured events"),
    sort_by: str = Query("date", description="Sort by: date, relevance, featured"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """List events with search and filters - public endpoint"""
    from sqlalchemy import or_
    
    query = db.query(Event).filter(Event.is_active)

    # Full-text search on title and description
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                Event.title.ilike(search_term),
                Event.description.ilike(search_term)
            )
        )

    # Filters
    if event_type:
        query = query.filter(Event.event_type == event_type)
    if location_type:
        query = query.filter(Event.location_type == location_type)
    if organization_id:
        query = query.filter(Event.organization_id == organization_id)
    if upcoming_only:
        query = query.filter(Event.start_datetime >= datetime.utcnow())
    if featured_only:
        query = query.filter(Event.is_featured)

    # Sorting
    if sort_by == "relevance":
        # For relevance, prioritize featured and upcoming
        query = query.order_by(
            Event.is_featured.desc(),
            Event.start_datetime.asc()
        )
    elif sort_by == "featured":
        query = query.order_by(
            Event.is_featured.desc(),
            Event.start_datetime.asc()
        )
    else:  # date (default)
        query = query.order_by(Event.start_datetime.asc())

    events = query.offset(skip).limit(limit).all()

    return events


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Get event by ID - public endpoint"""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.is_active
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    return event


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    organization_id: Optional[str] = Query(None, description="Associate with organization"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new event - requires authentication"""
    event_dict = event_data.model_dump()
    event_dict["created_by"] = current_user.id

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
                detail="You don't have permission to create events for this organization"
            )

        event_dict["organization_id"] = organization_id

    if event_dict.get("end_datetime") and event_dict["end_datetime"] < event_dict["start_datetime"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End datetime must be after start datetime"
        )

    event = Event(**event_dict)
    db.add(event)
    db.commit()
    db.refresh(event)

    return event


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    event_update: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update event - requires authentication and ownership or organization membership"""
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Check if user is creator or organization member
    is_creator = event.created_by == current_user.id
    is_org_member = False

    if event.organization_id:
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == event.organization_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role.in_(["admin", "staff"])
        ).first()
        is_org_member = member is not None

    if not is_creator and not is_org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this event"
        )

    update_data = event_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    for field, value in update_data.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    return event


@router.post("/{event_id}/rsvp", status_code=status.HTTP_201_CREATED)
async def rsvp_to_event(
    event_id: str,
    rsvp_data: EventRSVP,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """RSVP to an event - requires authentication"""
    event = db.query(Event).filter(
        Event.id == event_id,
        Event.is_active
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Get existing RSVP to determine net change in attendees
    existing_rsvp = db.query(UserEventRSVP).filter(
        UserEventRSVP.user_id == current_user.id,
        UserEventRSVP.event_id == event_id
    ).first()

    # Calculate net change in "going" attendees
    old_is_going = existing_rsvp and existing_rsvp.rsvp_status == "going"
    new_is_going = rsvp_data.rsvp_status == "going"
    net_attendee_change = 0

    if not old_is_going and new_is_going:
        net_attendee_change = 1
    elif old_is_going and not new_is_going:
        net_attendee_change = -1

    # Check capacity AFTER calculating net change
    if net_attendee_change > 0 and event.max_attendees:
        if event.current_attendees >= event.max_attendees:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event is at full capacity"
            )

    # Apply the RSVP change
    if existing_rsvp:
        existing_rsvp.rsvp_status = rsvp_data.rsvp_status
    else:
        rsvp = UserEventRSVP(
            user_id=current_user.id,
            event_id=event_id,
            rsvp_status=rsvp_data.rsvp_status
        )
        db.add(rsvp)

    # Update attendee count
    if net_attendee_change != 0:
        event.current_attendees = max(0, event.current_attendees + net_attendee_change)

    db.commit()

    return {
        "message": "RSVP updated successfully",
        "event_id": event_id,
        "rsvp_status": rsvp_data.rsvp_status,
        "current_attendees": event.current_attendees
    }


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete event - requires authentication and ownership or organization membership"""
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Check if user is creator or organization member
    is_creator = event.created_by == current_user.id
    is_org_member = False

    if event.organization_id:
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == event.organization_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.role.in_(["admin", "staff"])
        ).first()
        is_org_member = member is not None

    if not is_creator and not is_org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this event"
        )

    event.is_active = False
    db.commit()

    return None
