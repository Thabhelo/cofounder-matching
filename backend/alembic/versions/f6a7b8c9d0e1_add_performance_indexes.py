"""add performance indexes

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-08

Adds indexes on high-frequency filter columns to speed up common queries:
- users: profile_status, is_active, is_banned
- matches: composite (user_id, status) and (target_user_id, status)
- messages: composite (match_id, recipient_id, is_read) for unread counts
"""
from typing import Union
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_users_profile_status", "users", ["profile_status"])
    op.create_index("ix_users_is_active", "users", ["is_active"])
    op.create_index("ix_users_is_banned", "users", ["is_banned"])
    op.create_index("ix_matches_user_id_status", "matches", ["user_id", "status"])
    op.create_index("ix_matches_target_user_id_status", "matches", ["target_user_id", "status"])
    op.create_index(
        "ix_messages_match_recipient_read",
        "messages",
        ["match_id", "recipient_id", "is_read"],
    )


def downgrade() -> None:
    op.drop_index("ix_messages_match_recipient_read", table_name="messages")
    op.drop_index("ix_matches_target_user_id_status", table_name="matches")
    op.drop_index("ix_matches_user_id_status", table_name="matches")
    op.drop_index("ix_users_is_banned", table_name="users")
    op.drop_index("ix_users_is_active", table_name="users")
    op.drop_index("ix_users_profile_status", table_name="users")
