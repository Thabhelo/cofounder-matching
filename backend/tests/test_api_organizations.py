import pytest
from app.models.organization import Organization, OrganizationMember
from app.models.user import User


@pytest.mark.api
class TestOrganizationCRUD:
    """Test organization CRUD operations"""
    
    def test_list_organizations(self, client, db, test_organization_data):
        """Test listing organizations (public endpoint)"""
        org = Organization(**test_organization_data)
        db.add(org)
        db.commit()
        
        response = client.get("/api/v1/organizations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == test_organization_data["name"]
    
    def test_get_organization_by_id(self, client, db, test_organization_data):
        """Test getting organization by ID"""
        org = Organization(**test_organization_data)
        db.add(org)
        db.commit()
        db.refresh(org)
        
        response = client.get(f"/api/v1/organizations/{org.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_organization_data["name"]
    
    def test_get_organization_by_slug(self, client, db, test_organization_data):
        """Test getting organization by slug"""
        org = Organization(**test_organization_data)
        db.add(org)
        db.commit()
        
        response = client.get(f"/api/v1/organizations/{test_organization_data['slug']}")
        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == test_organization_data["slug"]
    
    def test_duplicate_slug_rejected(self, client, db, test_organization_data):
        """Test that duplicate organization slug is rejected"""
        org1 = Organization(**test_organization_data)
        db.add(org1)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            pass
    
    def test_filter_by_type(self, client, db):
        """Test filtering organizations by type"""
        orgs = [
            Organization(name="Accelerator 1", slug="accel-1", org_type="accelerator"),
            Organization(name="University 1", slug="uni-1", org_type="university"),
        ]
        for org in orgs:
            db.add(org)
        db.commit()
        
        response = client.get("/api/v1/organizations?org_type=accelerator")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["org_type"] == "accelerator"
    
    def test_filter_verified_only(self, client, db):
        """Test filtering for verified organizations"""
        orgs = [
            Organization(name="Verified Org", slug="verified-1", is_verified=True),
            Organization(name="Unverified Org", slug="unverified-1", is_verified=False),
        ]
        for org in orgs:
            db.add(org)
        db.commit()
        
        response = client.get("/api/v1/organizations?verified_only=true")
        assert response.status_code == 200
        data = response.json()
        assert all(org["is_verified"] for org in data)


@pytest.mark.api
class TestOrganizationAuthorization:
    """Test organization authorization checks"""
    
    def test_creator_auto_added_as_admin(self, client, db, test_user_data, test_organization_data):
        """Test that organization creator is automatically added as admin member"""
        with pytest.skip("Requires authentication mock"):
            # Create organization
            # Verify creator is added as admin member with is_primary=True
            pass
    
    def test_non_member_cannot_update(self, client, db, test_user_data, test_organization_data):
        """Test that non-members cannot update organization"""
        org = Organization(**test_organization_data)
        db.add(org)
        db.commit()
        
        with pytest.skip("Requires authentication mock"):
            pass
    
    def test_staff_member_can_update(self, client, db, test_user_data, test_organization_data):
        """Test that staff members can update organization"""
        user = User(**test_user_data, clerk_id="clerk_staff_test")
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
    
    def test_admin_member_can_update(self, client, db, test_user_data, test_organization_data):
        """Test that admin members can update organization"""
        user = User(**test_user_data, clerk_id="clerk_admin_test")
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


@pytest.mark.db
class TestOrganizationMemberConstraints:
    """Test database constraints on organization membership"""
    
    def test_unique_user_organization_constraint(self, db, test_user_data, test_organization_data):
        """Test that user cannot be added to same organization twice"""
        user = User(**test_user_data, clerk_id="clerk_unique_test")
        org = Organization(**test_organization_data)
        db.add(user)
        db.add(org)
        db.flush()
        
        member1 = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role="admin"
        )
        db.add(member1)
        db.commit()
        
        # Attempt to add same user again
        member2 = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role="staff"
        )
        db.add(member2)
        
        with pytest.raises(Exception):  # Should raise IntegrityError
            db.commit()
