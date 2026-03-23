"""Enable pgvector extension and add security configurations

Revision ID: 8421711427b4
Revises: f6a7b8c9d0e1
Create Date: 2026-03-23 01:31:03.666610

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8421711427b4'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Enable pgvector extension for future AI features.
    This extension allows for vector similarity search and embeddings storage.
    """
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Create indexes for improved query performance (if needed for future vector columns)
    # Note: These would be added later when actual vector columns are created
    # op.execute('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_cosine ON table_name USING ivfflat (embedding vector_cosine_ops)')

    # Add comment for documentation
    op.execute("""
        COMMENT ON EXTENSION vector IS
        'Vector similarity search for AI features - embeddings, semantic search, recommendations'
    """)


def downgrade() -> None:
    """
    Remove pgvector extension.
    WARNING: This will remove all vector data types and indexes.
    """
    # Drop the extension (CASCADE will remove all dependent objects)
    op.execute('DROP EXTENSION IF EXISTS vector CASCADE')
