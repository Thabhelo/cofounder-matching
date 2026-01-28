"""add_is_active_and_is_banned_to_user_model

Revision ID: 3f101fae90b7
Revises: d5d6bb795c55
Create Date: 2026-01-28 03:34:48.857831

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3f101fae90b7'
down_revision: Union[str, None] = 'd5d6bb795c55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_active column with default True for existing users
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    # Add is_banned column with default False for existing users
    op.add_column('users', sa.Column('is_banned', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('users', 'is_banned')
    op.drop_column('users', 'is_active')
