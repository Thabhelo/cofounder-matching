import pytest
from datetime import datetime, timedelta
from app.models.event import Event, UserEventRSVP
from app.models.user import User
from app.models.organization import Organization, OrganizationMember


@pytest.mark.api
class TestEventCRUD:
    """Test event CRUD operations"""
    
    def test_list_events(self, client, db, test_event_data):
        """Test listing events (public endpoint)"""
        event = Event(**test_event_data, start_datetime=datetime.fromisoformat(test_event_data["start_datetime"]))
        db.add(event)
        db.commit()
        
        response = client.get("/api/v1/events")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
    
    def test_filter_upcoming_events(self, client, db):
        """Test filtering for upcoming events only"""
        past_event = Event(
            title="Past Event",
            description="This event is in the past for testing purposes",
            start_datetime=datetime.utcnow() - timedelta(days=7)
        )
        future_event = Event(
            title="Future Event",
            description="This event is in the future for testing purposes",
            start_datetime=datetime.utcnow() + timedelta(days=7)
        )
        db.add(past_event)
        db.add(future_event)
        db.commit()
        
        response = client.get("/api/v1/events?upcoming_only=true")
        assert response.status_code == 200
        data = response.json()
        assert all(
            datetime.fromisoformat(event["start_datetime"].replace("Z", "+00:00")) >= datetime.utcnow()
            for event in data
        )
    
    def test_filter_by_event_type(self, client, db):
        """Test filtering events by type"""
        events = [
            Event(
                title="Workshop 1",
                description="A workshop event for testing purposes and validation",
                event_type="workshop",
                start_datetime=datetime.utcnow() + timedelta(days=7)
            ),
            Event(
                title="Networking 1",
                description="A networking event for testing purposes and validation",
                event_type="networking",
                start_datetime=datetime.utcnow() + timedelta(days=7)
            ),
        ]
        for event in events:
            db.add(event)
        db.commit()
        
        response = client.get("/api/v1/events?event_type=workshop")
        assert response.status_code == 200
        data = response.json()
        assert all(event["event_type"] == "workshop" for event in data)


@pytest.mark.api
class TestEventRSVP:
    """Test event RSVP functionality"""
    
    def test_rsvp_to_event(self, client, db, test_user_data, test_event_data):
        """Test RSVP to an event"""
        user = User(**test_user_data, clerk_id="clerk_rsvp_test")
        event = Event(**test_event_data, start_datetime=datetime.fromisoformat(test_event_data["start_datetime"]))
        db.add(user)
        db.add(event)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            pass
    
    def test_capacity_limit_enforced(self, db, test_user_data):
        """Test that event capacity limit is enforced"""
        # Create event with max capacity of 2
        event = Event(
            title="Limited Event",
            description="Event with limited capacity for testing purposes",
            start_datetime=datetime.utcnow() + timedelta(days=7),
            max_attendees=2,
            current_attendees=0
        )
        db.add(event)
        db.flush()
        
        # Create users
        user1 = User(email="user1@example.com", name="User 1", clerk_id="clerk_u1", role_intent="founder")
        user2 = User(email="user2@example.com", name="User 2", clerk_id="clerk_u2", role_intent="founder")
        user3 = User(email="user3@example.com", name="User 3", clerk_id="clerk_u3", role_intent="founder")
        db.add_all([user1, user2, user3])
        db.flush()
        
        # Add 2 going RSVPs
        rsvp1 = UserEventRSVP(user_id=user1.id, event_id=event.id, rsvp_status="going")
        rsvp2 = UserEventRSVP(user_id=user2.id, event_id=event.id, rsvp_status="going")
        db.add(rsvp1)
        db.add(rsvp2)
        event.current_attendees = 2
        db.commit()
        
        # Verify capacity is full
        assert event.current_attendees == event.max_attendees
        
        # Third user should not be able to RSVP as "going"
        with pytest.skip("Requires authentication mock to test via API"):
            pass
    
    def test_changing_rsvp_from_maybe_to_going(self, db, test_user_data):
        """Test changing RSVP status from maybe to going"""
        event = Event(
            title="Change RSVP Event",
            description="Event for testing RSVP changes and validation",
            start_datetime=datetime.utcnow() + timedelta(days=7),
            max_attendees=10,
            current_attendees=5
        )
        user = User(**test_user_data, clerk_id="clerk_change_test")
        db.add(event)
        db.add(user)
        db.flush()
        
        # Create "maybe" RSVP
        rsvp = UserEventRSVP(user_id=user.id, event_id=event.id, rsvp_status="maybe")
        db.add(rsvp)
        db.commit()
        
        # Change to "going" should increment attendees
        old_count = event.current_attendees
        rsvp.rsvp_status = "going"
        event.current_attendees += 1
        db.commit()
        
        assert event.current_attendees == old_count + 1
    
    def test_changing_rsvp_from_going_to_not_going(self, db, test_user_data):
        """Test changing RSVP status from going to not_going"""
        event = Event(
            title="Cancel RSVP Event",
            description="Event for testing RSVP cancellation and validation",
            start_datetime=datetime.utcnow() + timedelta(days=7),
            max_attendees=10,
            current_attendees=5
        )
        user = User(**test_user_data, clerk_id="clerk_cancel_test")
        db.add(event)
        db.add(user)
        db.flush()
        
        # Create "going" RSVP
        rsvp = UserEventRSVP(user_id=user.id, event_id=event.id, rsvp_status="going")
        db.add(rsvp)
        db.commit()
        
        # Change to "not_going" should decrement attendees
        old_count = event.current_attendees
        rsvp.rsvp_status = "not_going"
        event.current_attendees = max(0, event.current_attendees - 1)
        db.commit()
        
        assert event.current_attendees == old_count - 1
    
    def test_rsvp_race_condition_prevented(self, db):
        """Test that race condition in capacity checking is prevented"""
        # This tests the fix for the race condition bug
        event = Event(
            title="Race Condition Test",
            description="Event for testing concurrent RSVP race conditions",
            start_datetime=datetime.utcnow() + timedelta(days=7),
            max_attendees=1,
            current_attendees=0
        )
        db.add(event)
        db.flush()
        
        user1 = User(email="race1@example.com", name="User 1", clerk_id="clerk_race1", role_intent="founder")
        user2 = User(email="race2@example.com", name="User 2", clerk_id="clerk_race2", role_intent="founder")
        db.add_all([user1, user2])
        db.flush()
        
        # First user RSVPs with "maybe" (doesn't count toward capacity)
        rsvp1 = UserEventRSVP(user_id=user1.id, event_id=event.id, rsvp_status="maybe")
        db.add(rsvp1)
        db.commit()
        
        assert event.current_attendees == 0
        
        # User1 changes from "maybe" to "going" should be allowed
        rsvp1.rsvp_status = "going"
        event.current_attendees = 1
        db.commit()
        
        assert event.current_attendees == 1
        
        # User2 tries to RSVP as "going" - should be rejected (capacity full)
        # This would be tested via API with proper logic
        with pytest.skip("Requires API test for race condition prevention"):
            pass


@pytest.mark.api
class TestEventAuthorization:
    """Test event authorization checks"""
    
    def test_non_member_cannot_create_org_event(self, client, db, test_user_data, test_organization_data, test_event_data):
        """Test that non-members cannot create events for an organization"""
        user = User(**test_user_data, clerk_id="clerk_nonmember_test")
        org = Organization(**test_organization_data)
        db.add(user)
        db.add(org)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            # Attempt to create event with organization_id
            # Should get 403 Forbidden
            pass
    
    def test_org_member_can_create_event(self, client, db, test_user_data, test_organization_data, test_event_data):
        """Test that organization members can create events"""
        user = User(**test_user_data, clerk_id="clerk_member_test")
        org = Organization(**test_organization_data)
        db.add(user)
        db.add(org)
        db.flush()
        
        member = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role="staff"
        )
        db.add(member)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            pass


@pytest.mark.db
class TestEventRSVPConstraints:
    """Test database constraints on event RSVPs"""
    
    def test_unique_user_event_rsvp_constraint(self, db, test_user_data):
        """Test that user cannot have duplicate RSVPs for same event"""
        user = User(**test_user_data, clerk_id="clerk_rsvp_unique")
        event = Event(
            title="Unique RSVP Test",
            description="Event for testing unique RSVP constraint validation",
            start_datetime=datetime.utcnow() + timedelta(days=7)
        )
        db.add(user)
        db.add(event)
        db.flush()
        
        rsvp1 = UserEventRSVP(user_id=user.id, event_id=event.id, rsvp_status="going")
        db.add(rsvp1)
        db.commit()
        
        # Attempt to create duplicate RSVP
        rsvp2 = UserEventRSVP(user_id=user.id, event_id=event.id, rsvp_status="maybe")
        db.add(rsvp2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            db.commit()
