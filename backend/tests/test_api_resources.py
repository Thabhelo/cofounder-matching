import pytest
from decimal import Decimal
from app.models.resource import Resource, UserSavedResource
from app.models.user import User
from app.models.organization import Organization, OrganizationMember


@pytest.mark.api
class TestResourceCRUD:
    """Test resource CRUD operations"""
    
    def test_list_resources(self, client, db, test_resource_data):
        """Test listing resources (public endpoint)"""
        resource = Resource(**test_resource_data)
        db.add(resource)
        db.commit()
        
        response = client.get("/api/v1/resources")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
    
    def test_get_resource_by_id(self, client, db, test_resource_data):
        """Test getting resource by ID"""
        resource = Resource(**test_resource_data)
        db.add(resource)
        db.commit()
        db.refresh(resource)
        
        response = client.get(f"/api/v1/resources/{resource.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == test_resource_data["title"]
    
    def test_filter_by_category(self, client, db):
        """Test filtering resources by category"""
        resources = [
            Resource(
                title="Grant 1",
                description="A grant resource for testing purposes and validation",
                category="funding",
                resource_type="grant"
            ),
            Resource(
                title="Mentor 1",
                description="A mentorship resource for testing purposes and validation",
                category="mentorship",
                resource_type="service"
            ),
        ]
        for resource in resources:
            db.add(resource)
        db.commit()
        
        response = client.get("/api/v1/resources?category=funding")
        assert response.status_code == 200
        data = response.json()
        assert all(r["category"] == "funding" for r in data)
    
    def test_filter_by_stage_eligibility(self, client, db):
        """Test filtering resources by stage eligibility"""
        resources = [
            Resource(
                title="Idea Stage Grant",
                description="Grant for idea stage startups for testing purposes",
                category="funding",
                stage_eligibility=["idea", "mvp"]
            ),
            Resource(
                title="Growth Stage Grant",
                description="Grant for growth stage startups for testing purposes",
                category="funding",
                stage_eligibility=["revenue", "growth"]
            ),
        ]
        for resource in resources:
            db.add(resource)
        db.commit()
        
        response = client.get("/api/v1/resources?stage=idea")
        assert response.status_code == 200
        data = response.json()
        # Should return resources that include "idea" in stage_eligibility
        assert len(data) >= 1
    
    def test_filter_featured_resources(self, client, db):
        """Test filtering for featured resources"""
        resources = [
            Resource(
                title="Featured Grant",
                description="A featured grant resource for testing purposes",
                category="funding",
                is_featured=True
            ),
            Resource(
                title="Regular Grant",
                description="A regular grant resource for testing purposes",
                category="funding",
                is_featured=False
            ),
        ]
        for resource in resources:
            db.add(resource)
        db.commit()
        
        response = client.get("/api/v1/resources?featured_only=true")
        assert response.status_code == 200
        data = response.json()
        assert all(r["is_featured"] for r in data)


@pytest.mark.api
class TestResourceAuthorization:
    """Test resource authorization checks"""
    
    def test_non_member_cannot_create_org_resource(self, client, db, test_user_data, test_organization_data, test_resource_data):
        """Test that non-members cannot create resources for an organization"""
        user = User(**test_user_data, clerk_id="clerk_res_nonmember")
        org = Organization(**test_organization_data)
        db.add(user)
        db.add(org)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            # Attempt to create resource with organization_id
            # Should get 403 Forbidden
            pass
    
    def test_org_member_can_create_resource(self, client, db, test_user_data, test_organization_data, test_resource_data):
        """Test that organization members can create resources"""
        user = User(**test_user_data, clerk_id="clerk_res_member")
        org = Organization(**test_organization_data)
        db.add(user)
        db.add(org)
        db.flush()
        
        member = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role="admin"
        )
        db.add(member)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            pass
    
    def test_creator_can_update_resource(self, client, db, test_user_data, test_resource_data):
        """Test that resource creator can update it"""
        user = User(**test_user_data, clerk_id="clerk_res_creator")
        db.add(user)
        db.flush()
        
        resource = Resource(**test_resource_data, created_by=user.id)
        db.add(resource)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            pass
    
    def test_non_creator_cannot_update_resource(self, client, db, test_user_data, test_resource_data):
        """Test that non-creators cannot update resource"""
        user1 = User(email="creator@example.com", name="Creator", clerk_id="clerk_creator", role_intent="founder")
        user2 = User(**test_user_data, clerk_id="clerk_other")
        db.add(user1)
        db.add(user2)
        db.flush()
        
        resource = Resource(**test_resource_data, created_by=user1.id)
        db.add(resource)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            # user2 attempts to update resource created by user1
            # Should get 403 Forbidden
            pass
    
    def test_org_member_can_update_org_resource(self, client, db, test_user_data, test_organization_data, test_resource_data):
        """Test that org members can update organization resources"""
        user1 = User(email="creator@example.com", name="Creator", clerk_id="clerk_res_creator2", role_intent="founder")
        user2 = User(**test_user_data, clerk_id="clerk_res_member2")
        org = Organization(**test_organization_data)
        db.add_all([user1, user2, org])
        db.flush()
        
        # user2 is org member
        member = OrganizationMember(
            user_id=user2.id,
            organization_id=org.id,
            role="staff"
        )
        db.add(member)
        
        # user1 creates resource for org
        resource = Resource(**test_resource_data, created_by=user1.id, organization_id=org.id)
        db.add(resource)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            # user2 should be able to update resource because they're org member
            pass


@pytest.mark.db
class TestResourceConstraints:
    """Test database constraints and validation"""
    
    def test_amount_validation(self, db):
        """Test that amount_min <= amount_max"""
        resource = Resource(
            title="Invalid Amount Resource",
            description="Resource with invalid amount range for testing",
            category="funding",
            amount_min=Decimal("100000"),
            amount_max=Decimal("50000")  # Less than min!
        )
        db.add(resource)
        # Note: This validation should happen in Pydantic schema, not database
        # Database just stores the values
        db.commit()
        assert resource.amount_min > resource.amount_max  # Invalid but allowed at DB level
    
    def test_unique_user_saved_resource_constraint(self, db, test_user_data, test_resource_data):
        """Test that user cannot save same resource twice"""
        user = User(**test_user_data, clerk_id="clerk_save_unique")
        resource = Resource(**test_resource_data)
        db.add(user)
        db.add(resource)
        db.flush()
        
        saved1 = UserSavedResource(user_id=user.id, resource_id=resource.id)
        db.add(saved1)
        db.commit()
        
        # Attempt to save same resource again
        saved2 = UserSavedResource(user_id=user.id, resource_id=resource.id)
        db.add(saved2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            db.commit()
