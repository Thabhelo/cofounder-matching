"""add is_admin to users

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-08
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"))
    # Backfill ADMIN_CLERK_IDS holders - not possible in migration since env var isn't accessible here.
    # Admins are initially set via ADMIN_CLERK_IDS env var; is_admin is then set via the admin UI.


def downgrade() -> None:
    op.drop_column("users", "is_admin")
