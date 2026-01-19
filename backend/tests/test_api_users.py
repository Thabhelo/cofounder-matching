import pytest
from app.models.user import User


@pytest.mark.api
class TestUserOnboarding:
    """Test user onboarding endpoints"""
    
    def test_create_user_success(self, client, db, test_user_data):
        """Test successful user creation during onboarding"""
        with pytest.skip("Requires mock Clerk token verification"):
            pass
    
    def test_duplicate_clerk_id_rejected(self, client, db, test_user_data):
        """Test that duplicate clerk_id is rejected"""
        # Create first user
        user = User(**test_user_data, clerk_id="clerk_duplicate_test")
        db.add(user)
        db.commit()
        
        # Attempt to create second user with same clerk_id
        with pytest.skip("Requires mock Clerk token verification"):
            pass
    
    def test_duplicate_email_rejected(self, client, db, test_user_data):
        """Test that duplicate email is rejected"""
        user1_data = test_user_data.copy()
        user1_data["clerk_id"] = "clerk_user_1"
        user1 = User(**user1_data)
        db.add(user1)
        db.commit()
        
        # Attempt to create second user with same email
        with pytest.skip("Requires mock Clerk token verification"):
            pass


@pytest.mark.api
class TestUserProfile:
    """Test user profile endpoints"""
    
    def test_get_own_profile(self, client, db, test_user_data):
        """Test getting authenticated user's own profile"""
        user = User(**test_user_data, clerk_id="clerk_profile_test")
        db.add(user)
        db.commit()
        
        with pytest.skip("Requires mock Clerk token verification"):
            pass
    
    def test_update_own_profile(self, client, db, test_user_data):
        """Test updating authenticated user's profile"""
        user = User(**test_user_data, clerk_id="clerk_update_test")
        db.add(user)
        db.commit()
        
        with pytest.skip("Requires mock Clerk token verification"):
            pass
    
    def test_get_public_profile(self, client, db, test_user_data):
        """Test getting public user profile (no auth required)"""
        user = User(**test_user_data, clerk_id="clerk_public_test")
        db.add(user)
        db.commit()
        db.refresh(user)
        
        response = client.get(f"/api/v1/users/{user.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_user_data["name"]
        assert "email" not in data or data["email"] == test_user_data["email"]
    
    def test_banned_user_not_in_public_search(self, client, db, test_user_data):
        """Test that banned users don't appear in search results"""
        user = User(**test_user_data, clerk_id="clerk_banned_search", is_banned=True)
        db.add(user)
        db.commit()
        
        response = client.get("/api/v1/users")
        assert response.status_code == 200
        data = response.json()
        assert len([u for u in data if u["id"] == str(user.id)]) == 0


@pytest.mark.api
class TestUserSearch:
    """Test user search functionality"""
    
    def test_search_by_role_intent(self, client, db):
        """Test filtering users by role intent"""
        users = [
            User(email="founder1@example.com", name="Founder 1", clerk_id="clerk_f1", role_intent="founder"),
            User(email="cofounder1@example.com", name="CoFounder 1", clerk_id="clerk_c1", role_intent="cofounder"),
            User(email="employee1@example.com", name="Employee 1", clerk_id="clerk_e1", role_intent="early_employee"),
        ]
        for user in users:
            db.add(user)
        db.commit()
        
        response = client.get("/api/v1/users?role_intent=cofounder")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["role_intent"] == "cofounder"
    
    def test_search_by_location(self, client, db):
        """Test filtering users by location (case-insensitive)"""
        users = [
            User(email="sf1@example.com", name="SF User", clerk_id="clerk_sf1", role_intent="founder", location="San Francisco, CA"),
            User(email="ny1@example.com", name="NY User", clerk_id="clerk_ny1", role_intent="founder", location="New York, NY"),
        ]
        for user in users:
            db.add(user)
        db.commit()
        
        response = client.get("/api/v1/users?location=san francisco")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "San Francisco" in data[0]["location"]
    
    def test_pagination_works(self, client, db):
        """Test pagination with skip and limit"""
        users = [
            User(email=f"user{i}@example.com", name=f"User {i}", clerk_id=f"clerk_u{i}", role_intent="founder")
            for i in range(10)
        ]
        for user in users:
            db.add(user)
        db.commit()
        
        response = client.get("/api/v1/users?skip=0&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
        
        response = client.get("/api/v1/users?skip=5&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
