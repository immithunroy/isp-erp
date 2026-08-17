"""phase 5 customers + field service tables

Revision ID: 0004_customers
Revises: 0003_mobile
Create Date: 2025-01-15 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0004_customers"
down_revision = "0003_mobile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("branch_id", sa.BigInteger, sa.ForeignKey("branches.id", ondelete="SET NULL")),
        sa.Column("customer_code", sa.Text, unique=True, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("phone", sa.Text),
        sa.Column("email", sa.Text),
        sa.Column("address", sa.Text),
        sa.Column("installation_date", sa.Date),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column(
            "assigned_technician_id",
            sa.BigInteger,
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
        ),
        sa.Column("notes", sa.Text),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
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
    )
    op.create_index("ix_customers_org", "customers", ["organization_id"])
    op.create_index("ix_customers_code", "customers", ["customer_code"])
    op.create_index("ix_customers_status", "customers", ["status"])
    op.create_index("ix_customers_tech", "customers", ["assigned_technician_id"])

    op.create_table(
        "customer_locations",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "customer_id",
            sa.BigInteger,
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column("gps_accuracy", sa.Numeric(6, 2)),
        sa.Column("address", sa.Text),
        sa.Column("source", sa.String(20), server_default="mobile", nullable=False),
        sa.Column(
            "collected_by",
            sa.BigInteger,
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
        ),
        sa.Column("collection_method", sa.String(30)),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("is_current", sa.Boolean, server_default="true", nullable=False),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_cust_loc_customer", "customer_locations", ["customer_id"])
    op.create_index("ix_cust_loc_current", "customer_locations", ["is_current"])

    op.create_table(
        "customer_visits",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "customer_id",
            sa.BigInteger,
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "employee_id",
            sa.BigInteger,
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
        ),
        sa.Column("purpose", sa.Text),
        sa.Column("visited_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("gps_accuracy", sa.Numeric(6, 2)),
        sa.Column("photos", postgresql.JSONB),
        sa.Column("notes", sa.Text),
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
    )
    op.create_index("ix_cust_visit_customer", "customer_visits", ["customer_id"])
    op.create_index("ix_cust_visit_emp", "customer_visits", ["employee_id"])

    op.create_table(
        "work_orders",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "organization_id",
            sa.BigInteger,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("customer_id", sa.BigInteger, sa.ForeignKey("customers.id", ondelete="SET NULL")),
        sa.Column("work_order_code", sa.Text, unique=True, nullable=False),
        sa.Column("job_type", sa.String(30), nullable=False),
        sa.Column("priority", sa.String(20), server_default="medium", nullable=False),
        sa.Column(
            "assigned_employee_id",
            sa.BigInteger,
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
        ),
        sa.Column("scheduled_date", sa.Date),
        sa.Column("status", sa.String(20), server_default="open", nullable=False),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("photos", postgresql.JSONB),
        sa.Column("equipment_used", postgresql.JSONB),
        sa.Column("notes", sa.Text),
        sa.Column("completion_report", sa.Text),
        sa.Column("approved_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
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
    )
    op.create_index("ix_wo_org", "work_orders", ["organization_id"])
    op.create_index("ix_wo_code", "work_orders", ["work_order_code"])
    op.create_index("ix_wo_status", "work_orders", ["status"])
    op.create_index("ix_wo_emp", "work_orders", ["assigned_employee_id"])
    op.create_index("ix_wo_customer", "work_orders", ["customer_id"])

    op.create_table(
        "work_order_events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "work_order_id",
            sa.BigInteger,
            sa.ForeignKey("work_orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("actor_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("notes", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_wo_event_wo", "work_order_events", ["work_order_id"])


def downgrade() -> None:
    op.drop_index("ix_wo_event_wo", table_name="work_order_events")
    op.drop_table("work_order_events")
    op.drop_index("ix_wo_customer", table_name="work_orders")
    op.drop_index("ix_wo_emp", table_name="work_orders")
    op.drop_index("ix_wo_status", table_name="work_orders")
    op.drop_index("ix_wo_code", table_name="work_orders")
    op.drop_index("ix_wo_org", table_name="work_orders")
    op.drop_table("work_orders")
    op.drop_index("ix_cust_visit_emp", table_name="customer_visits")
    op.drop_index("ix_cust_visit_customer", table_name="customer_visits")
    op.drop_table("customer_visits")
    op.drop_index("ix_cust_loc_current", table_name="customer_locations")
    op.drop_index("ix_cust_loc_customer", table_name="customer_locations")
    op.drop_table("customer_locations")
    op.drop_index("ix_customers_tech", table_name="customers")
    op.drop_index("ix_customers_status", table_name="customers")
    op.drop_index("ix_customers_code", table_name="customers")
    op.drop_index("ix_customers_org", table_name="customers")
    op.drop_table("customers")
