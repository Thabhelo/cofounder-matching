"""Comprehensive profile update: idea_status, introduction, location components, preferences

Revision ID: f1a2b3c4d5e6
Revises: e86e4d681466
Create Date: 2026-02-13

- Rename role_intent -> idea_status, bio -> introduction (via add + migrate + drop)
- Add location components, personal, story, startup, preference fields
- Add behavior_agreement_accepted_at, profile_status
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e86e4d681466"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns that replace old ones (we'll migrate data then drop old)
    op.add_column("users", sa.Column("introduction", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("idea_status", sa.String(length=50), nullable=True))

    # Migrate bio -> introduction, role_intent -> idea_status
    op.execute("UPDATE users SET introduction = bio WHERE bio IS NOT NULL")
    op.execute("""
        UPDATE users
        SET idea_status = CASE
            WHEN role_intent = 'founder' THEN 'building_specific_idea'
            WHEN role_intent = 'cofounder' THEN 'not_set_on_idea'
            WHEN role_intent = 'early_employee' THEN 'have_ideas_flexible'
            ELSE 'have_ideas_flexible'
        END
        WHERE role_intent IS NOT NULL
    """)

    # Personal
    op.add_column("users", sa.Column("gender", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("birthdate", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("location_city", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("location_state", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("location_country", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("location_latitude", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("location_longitude", sa.Float(), nullable=True))

    # Professional / story
    op.add_column("users", sa.Column("twitter_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("instagram_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("calendly_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("video_intro_url", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("life_story", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("hobbies", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("impressive_accomplishment", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("education_history", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("employment_history", sa.Text(), nullable=True))

    # Startup / readiness
    op.add_column("users", sa.Column("is_technical", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("startup_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("startup_description", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("startup_progress", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("startup_funding", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("ready_to_start", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("areas_of_ownership", JSONB, nullable=True))
    op.add_column("users", sa.Column("topics_of_interest", JSONB, nullable=True))
    op.add_column("users", sa.Column("domain_expertise", JSONB, nullable=True))
    op.add_column("users", sa.Column("equity_expectation", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("work_location_preference", sa.String(length=50), nullable=True))

    # Preferences
    op.add_column("users", sa.Column("looking_for_description", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("pref_idea_status", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("pref_idea_importance", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("pref_technical", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("pref_technical_importance", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("pref_match_timing", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("pref_timing_importance", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("pref_location_type", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("pref_location_distance_miles", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("pref_location_importance", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("pref_age_min", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("pref_age_max", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("pref_age_importance", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("pref_cofounder_areas", JSONB, nullable=True))
    op.add_column("users", sa.Column("pref_areas_importance", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("pref_shared_interests", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("pref_interests_importance", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("alert_on_new_matches", sa.Boolean(), server_default=sa.text("false"), nullable=False))

    # System
    op.add_column("users", sa.Column("behavior_agreement_accepted_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("users", sa.Column("profile_status", sa.String(length=50), server_default="incomplete", nullable=False))

    # Best-effort location_country from existing location text
    op.execute("""
        UPDATE users
        SET location_country = CASE
            WHEN location ILIKE '%USA%' OR location ILIKE '%United States%' OR location ILIKE '%US%' THEN 'United States'
            WHEN location ILIKE '%UK%' OR location ILIKE '%United Kingdom%' THEN 'United Kingdom'
            WHEN location ILIKE '%Canada%' THEN 'Canada'
            ELSE 'Other'
        END
        WHERE location IS NOT NULL AND location_country IS NULL
    """)

    # Existing active users: mark as approved for backward compatibility
    op.execute("UPDATE users SET profile_status = 'approved' WHERE is_active = TRUE")

    # Drop old columns
    op.drop_column("users", "bio")
    op.drop_column("users", "role_intent")


def downgrade() -> None:
    op.add_column("users", sa.Column("role_intent", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.execute("UPDATE users SET bio = introduction WHERE introduction IS NOT NULL")
    op.execute("""
        UPDATE users
        SET role_intent = CASE
            WHEN idea_status = 'building_specific_idea' THEN 'founder'
            WHEN idea_status = 'not_set_on_idea' THEN 'cofounder'
            ELSE 'early_employee'
        END
        WHERE idea_status IS NOT NULL
    """)

    op.drop_column("users", "profile_status")
    op.drop_column("users", "behavior_agreement_accepted_at")
    op.drop_column("users", "alert_on_new_matches")
    op.drop_column("users", "pref_interests_importance")
    op.drop_column("users", "pref_shared_interests")
    op.drop_column("users", "pref_areas_importance")
    op.drop_column("users", "pref_cofounder_areas")
    op.drop_column("users", "pref_age_importance")
    op.drop_column("users", "pref_age_max")
    op.drop_column("users", "pref_age_min")
    op.drop_column("users", "pref_location_importance")
    op.drop_column("users", "pref_location_distance_miles")
    op.drop_column("users", "pref_location_type")
    op.drop_column("users", "pref_timing_importance")
    op.drop_column("users", "pref_match_timing")
    op.drop_column("users", "pref_technical_importance")
    op.drop_column("users", "pref_technical")
    op.drop_column("users", "pref_idea_importance")
    op.drop_column("users", "pref_idea_status")
    op.drop_column("users", "looking_for_description")
    op.drop_column("users", "work_location_preference")
    op.drop_column("users", "equity_expectation")
    op.drop_column("users", "domain_expertise")
    op.drop_column("users", "topics_of_interest")
    op.drop_column("users", "areas_of_ownership")
    op.drop_column("users", "ready_to_start")
    op.drop_column("users", "startup_funding")
    op.drop_column("users", "startup_progress")
    op.drop_column("users", "startup_description")
    op.drop_column("users", "startup_name")
    op.drop_column("users", "is_technical")
    op.drop_column("users", "employment_history")
    op.drop_column("users", "education_history")
    op.drop_column("users", "impressive_accomplishment")
    op.drop_column("users", "hobbies")
    op.drop_column("users", "life_story")
    op.drop_column("users", "video_intro_url")
    op.drop_column("users", "calendly_url")
    op.drop_column("users", "instagram_url")
    op.drop_column("users", "twitter_url")
    op.drop_column("users", "location_longitude")
    op.drop_column("users", "location_latitude")
    op.drop_column("users", "location_country")
    op.drop_column("users", "location_state")
    op.drop_column("users", "location_city")
    op.drop_column("users", "birthdate")
    op.drop_column("users", "gender")
    op.drop_column("users", "idea_status")
    op.drop_column("users", "introduction")
