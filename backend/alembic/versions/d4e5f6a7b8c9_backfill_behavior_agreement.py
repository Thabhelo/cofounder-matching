"""backfill behavior_agreement_accepted_at for completed profiles

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-07

Users who completed onboarding (profile_status != 'incomplete') must have
accepted the behavior agreement as a prerequisite, but their
behavior_agreement_accepted_at may be NULL if the column was added after
they signed up. Backfill it with their created_at timestamp so they are
not incorrectly redirected back to the agreement step.
"""
from typing import Union
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE users
        SET behavior_agreement_accepted_at = created_at
        WHERE profile_status != 'incomplete'
          AND behavior_agreement_accepted_at IS NULL
        """
    )


def downgrade() -> None:
    pass
