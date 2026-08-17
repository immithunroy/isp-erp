"""fix: change ip columns from inet to varchar

Revision ID: 0006_fix_ip_columns
Revises: 0005_network
Create Date: 2025-01-21 00:00:00
"""
from __future__ import annotations

from alembic import op

revision = "0006_fix_ip_columns"
down_revision = "0005_network"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change ip columns from inet to varchar for SQLite/model compatibility.
    # The SQLAlchemy models use String(45) which works everywhere,
    # but the original migration created inet columns on PostgreSQL.
    op.execute(
        "ALTER TABLE refresh_tokens ALTER COLUMN ip TYPE VARCHAR(45) USING ip::text;"
    )
    op.execute(
        "ALTER TABLE audit_logs ALTER COLUMN ip TYPE VARCHAR(45) USING ip::text;"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE audit_logs ALTER COLUMN ip TYPE INET USING ip::inet;"
    )
    op.execute(
        "ALTER TABLE refresh_tokens ALTER COLUMN ip TYPE INET USING ip::inet;"
    )
