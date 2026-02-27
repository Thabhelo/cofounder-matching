"""admin_audit_log

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-02-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_log",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("admin_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=True),
        sa.Column("target_id", sa.UUID(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["admin_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index(op.f("ix_admin_audit_log_admin_id"), "admin_audit_log", ["admin_id"], unique=False)
    op.create_index(op.f("ix_admin_audit_log_action"), "admin_audit_log", ["action"], unique=False)
    op.create_index(op.f("ix_admin_audit_log_target_type"), "admin_audit_log", ["target_type"], unique=False)
    op.create_index(op.f("ix_admin_audit_log_created_at"), "admin_audit_log", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_admin_audit_log_created_at"), table_name="admin_audit_log")
    op.drop_index(op.f("ix_admin_audit_log_target_type"), table_name="admin_audit_log")
    op.drop_index(op.f("ix_admin_audit_log_action"), table_name="admin_audit_log")
    op.drop_index(op.f("ix_admin_audit_log_admin_id"), table_name="admin_audit_log")
    op.drop_table("admin_audit_log")
