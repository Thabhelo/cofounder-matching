"""remove_stage_working_style_communication_preference_fields

Revision ID: e86e4d681466
Revises: 3f101fae90b7
Create Date: 2026-02-08 13:48:44.398564

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e86e4d681466'
down_revision: Union[str, None] = '3f101fae90b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop index on stage_preference if it exists
    op.drop_index('idx_users_stage_preference', table_name='users', if_exists=True)
    
    # Remove columns from users table
    op.drop_column('users', 'stage_preference')
    op.drop_column('users', 'working_style')
    op.drop_column('users', 'communication_preference')
    
    # Remove columns from matches table
    op.drop_column('matches', 'stage_alignment_score')
    op.drop_column('matches', 'working_style_score')
    
    # Add new columns to matches table
    op.add_column('matches', sa.Column('interest_overlap_score', sa.Integer(), nullable=True))
    op.add_column('matches', sa.Column('preference_alignment_score', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove new columns from matches table
    op.drop_column('matches', 'preference_alignment_score')
    op.drop_column('matches', 'interest_overlap_score')
    
    # Restore columns to matches table
    op.add_column('matches', sa.Column('working_style_score', sa.Integer(), nullable=True))
    op.add_column('matches', sa.Column('stage_alignment_score', sa.Integer(), nullable=True))
    
    # Restore columns to users table
    op.add_column('users', sa.Column('communication_preference', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('working_style', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('stage_preference', sa.String(length=50), nullable=True))
    
    # Restore index on stage_preference
    op.create_index('idx_users_stage_preference', 'users', ['stage_preference'], unique=False)
