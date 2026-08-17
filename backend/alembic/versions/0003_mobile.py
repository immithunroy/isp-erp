"""phase 4 mobile tables

Revision ID: 0003_mobile
Revises: 0002_hrm
Create Date: 2025-01-10 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0003_mobile"
down_revision = "0002_hrm"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gps_records",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "employee_id",
            sa.BigInteger,
            sa.ForeignKey("employees.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("gps_accuracy", sa.Numeric(6, 2)),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("source", sa.String(30), server_default="mobile", nullable=False),
        sa.Column("activity", sa.String(30), nullable=False),
        sa.Column("related_type", sa.String(50)),
        sa.Column("related_id", sa.String(50)),
        sa.Column("device_id", sa.Text),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_gps_emp", "gps_records", ["employee_id"])
    op.create_index("ix_gps_recorded", "gps_records", ["recorded_at"])
    op.create_index("ix_gps_activity", "gps_records", ["activity"])

    op.create_table(
        "sync_queue",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("device_id", sa.Text),
        sa.Column(
            "employee_id",
            sa.BigInteger,
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
        ),
        sa.Column("idempotency_key", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSONB),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("retries", sa.Integer, server_default="0", nullable=False),
        sa.Column("error", sa.Text),
        sa.Column("processed_record_id", sa.BigInteger),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("idempotency_key", name="uq_sync_queue_idempotency"),
    )
    op.create_index("ix_sync_status", "sync_queue", ["status"])
    op.create_index("ix_sync_emp", "sync_queue", ["employee_id"])


def downgrade() -> None:
    op.drop_index("ix_sync_emp", table_name="sync_queue")
    op.drop_index("ix_sync_status", table_name="sync_queue")
    op.drop_table("sync_queue")
    op.drop_index("ix_gps_activity", table_name="gps_records")
    op.drop_index("ix_gps_recorded", table_name="gps_records")
    op.drop_index("ix_gps_emp", table_name="gps_records")
    op.drop_table("gps_records")
