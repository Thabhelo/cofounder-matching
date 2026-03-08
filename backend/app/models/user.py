
import uuid

from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, TypeDecorator, CHAR, Float, Date
from sqlalchemy.dialects.postgresql import UUID as PostgreSQL_UUID, JSONB
from sqlalchemy.sql import func

from app.database import Base


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type when available, otherwise uses CHAR(36) for compatibility.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PostgreSQL_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return value
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


class User(Base):
    __tablename__ = "users"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    clerk_id = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)

    # Basics: introduction (formerly bio), location
    introduction = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    location_city = Column(String(100), nullable=True)
    location_state = Column(String(100), nullable=True)
    location_country = Column(String(100), nullable=True)
    location_latitude = Column(Float, nullable=True)
    location_longitude = Column(Float, nullable=True)

    # Personal
    gender = Column(String(20), nullable=True)
    birthdate = Column(Date, nullable=True)

    # Professional
    linkedin_url = Column(String(500), nullable=True)
    twitter_url = Column(String(500), nullable=True)
    instagram_url = Column(String(500), nullable=True)
    calendly_url = Column(String(500), nullable=True)
    video_intro_url = Column(String(500), nullable=True)
    github_url = Column(String(500), nullable=True)
    portfolio_url = Column(String(500), nullable=True)

    # Story & background
    life_story = Column(Text, nullable=True)
    hobbies = Column(Text, nullable=True)
    impressive_accomplishment = Column(Text, nullable=True)
    education_history = Column(Text, nullable=True)
    employment_history = Column(Text, nullable=True)
    experience_years = Column(Integer, nullable=True)
    previous_startups = Column(Integer, nullable=True)

    # You / startup & readiness
    idea_status = Column(String(50), nullable=True)  # not_set_on_idea, have_ideas_flexible, building_specific_idea
    is_technical = Column(Boolean, nullable=True)
    startup_name = Column(String(255), nullable=True)
    startup_description = Column(Text, nullable=True)
    startup_progress = Column(String(50), nullable=True)
    startup_funding = Column(String(50), nullable=True)
    ready_to_start = Column(String(50), nullable=True)
    commitment = Column(String(50), nullable=True)  # full_time, part_time
    areas_of_ownership = Column(JSONB, nullable=True)  # list of strings
    topics_of_interest = Column(JSONB, nullable=True)
    domain_expertise = Column(JSONB, nullable=True)
    equity_expectation = Column(Text, nullable=True)
    work_location_preference = Column(String(50), nullable=True)

    # Co-founder preferences
    looking_for_description = Column(Text, nullable=True)
    pref_idea_status = Column(String(50), nullable=True)
    pref_idea_importance = Column(String(20), nullable=True)
    pref_technical = Column(Boolean, nullable=True)
    pref_technical_importance = Column(String(20), nullable=True)
    pref_match_timing = Column(Boolean, nullable=True)
    pref_timing_importance = Column(String(20), nullable=True)
    pref_location_type = Column(String(50), nullable=True)
    pref_location_distance_miles = Column(Integer, nullable=True)
    pref_location_importance = Column(String(20), nullable=True)
    pref_age_min = Column(Integer, nullable=True)
    pref_age_max = Column(Integer, nullable=True)
    pref_age_importance = Column(String(20), nullable=True)
    pref_cofounder_areas = Column(JSONB, nullable=True)
    pref_areas_importance = Column(String(20), nullable=True)
    pref_shared_interests = Column(Boolean, nullable=True)
    pref_interests_importance = Column(String(20), nullable=True)
    alert_on_new_matches = Column(Boolean, default=False, nullable=False)

    # Settings (notifications, privacy, communication)
    settings = Column(JSONB, nullable=True)

    # System
    behavior_agreement_accepted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    profile_status = Column(String(50), default="incomplete", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_banned = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)

    created_at = Column(TIMESTAMP, default=func.now())
    updated_at = Column(TIMESTAMP, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.name}>"
