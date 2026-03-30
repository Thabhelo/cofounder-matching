"""merge pgvector and analytics migrations

Revision ID: dafdf7dd01d2
Revises: 8421711427b4, a7b8c9d0e1f2
Create Date: 2026-03-23 03:24:57.621678

"""
from typing import Sequence, Union


revision: str = 'dafdf7dd01d2'
down_revision: Union[str, None] = ('8421711427b4', 'a7b8c9d0e1f2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
