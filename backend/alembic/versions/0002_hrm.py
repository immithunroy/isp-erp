"""phase 3 hrm tables

Revision ID: 0002_hrm
Revises: 0001_initial
Create Date: 2025-01-05 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002_hrm"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "designations",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("department_id", sa.BigInteger, sa.ForeignKey("departments.id", ondelete="SET NULL")),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("code", sa.Text),
        sa.Column("grade", sa.Text),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("organization_id", "code", name="uq_designation_org_code"),
    )

    op.create_table(
        "employees",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branch_id", sa.BigInteger, sa.ForeignKey("branches.id", ondelete="SET NULL")),
        sa.Column("department_id", sa.BigInteger, sa.ForeignKey("departments.id", ondelete="SET NULL")),
        sa.Column("designation_id", sa.BigInteger, sa.ForeignKey("designations.id", ondelete="SET NULL")),
        sa.Column("supervisor_id", sa.BigInteger, sa.ForeignKey("employees.id", ondelete="SET NULL")),
        sa.Column("user_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("employee_code", sa.Text, unique=True, nullable=False),
        sa.Column("full_name", sa.Text, nullable=False),
        sa.Column("photo_url", sa.Text),
        sa.Column("phone", sa.Text),
        sa.Column("email", sa.Text),
        sa.Column("address", sa.Text),
        sa.Column("emergency_contact_name", sa.Text),
        sa.Column("emergency_contact_phone", sa.Text),
        sa.Column("joining_date", sa.Date),
        sa.Column("employment_status", sa.String(20), server_default="active", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_employees_org", "employees", ["organization_id"])
    op.create_index("ix_employees_code", "employees", ["employee_code"])
    op.create_index("ix_employees_dept", "employees", ["department_id"])

    op.create_table(
        "shifts",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("code", sa.Text),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("grace_minutes", sa.Integer, server_default="15", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("organization_id", "code", name="uq_shift_org_code"),
    )

    op.create_table(
        "employee_shifts",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("employee_id", sa.BigInteger, sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shift_id", sa.BigInteger, sa.ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("effective_from", sa.Date, nullable=False),
        sa.Column("effective_to", sa.Date),
    )
    op.create_index("ix_emp_shifts_emp", "employee_shifts", ["employee_id"])

    op.create_table(
        "holidays",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("branch_id", sa.BigInteger, sa.ForeignKey("branches.id", ondelete="CASCADE")),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("is_recurring", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("scope", sa.String(20), server_default="org", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("organization_id", "date", "name", name="uq_holiday_org_date_name"),
    )
    op.create_index("ix_holidays_date", "holidays", ["date"])

    op.create_table(
        "leave_types",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("organization_id", sa.BigInteger, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("default_days", sa.Numeric(5, 1), server_default="0", nullable=False),
        sa.Column("is_paid", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("organization_id", "code", name="uq_leave_type_org_code"),
    )

    op.create_table(
        "leave_balances",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("employee_id", sa.BigInteger, sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", sa.BigInteger, sa.ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("allocated_days", sa.Numeric(5, 1), server_default="0", nullable=False),
        sa.Column("used_days", sa.Numeric(5, 1), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balance_emp_type_year"),
    )

    op.create_table(
        "leave_requests",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("employee_id", sa.BigInteger, sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", sa.BigInteger, sa.ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_date", sa.Date, nullable=False),
        sa.Column("to_date", sa.Date, nullable=False),
        sa.Column("reason", sa.Text),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("approver_id", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("approver_note", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_leave_req_emp", "leave_requests", ["employee_id"])
    op.create_index("ix_leave_req_status", "leave_requests", ["status"])

    op.create_table(
        "attendance",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("employee_id", sa.BigInteger, sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("attendance_type", sa.String(20), nullable=False),
        sa.Column("local_ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("gps_accuracy", sa.Numeric(6, 2)),
        sa.Column("face_verified", sa.Boolean),
        sa.Column("face_score", sa.Numeric(5, 2)),
        sa.Column("device_id", sa.Text),
        sa.Column("ip", sa.String(45)),
        sa.Column("source", sa.String(20), server_default="mobile", nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("is_corrected", sa.Boolean, server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_att_emp_date", "attendance", ["employee_id", "date"])
    op.create_index("ix_att_date", "attendance", ["date"])

    op.create_table(
        "attendance_corrections",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("attendance_id", sa.BigInteger, sa.ForeignKey("attendance.id", ondelete="CASCADE"), nullable=False),
        sa.Column("corrected_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("previous_values", postgresql.JSONB),
        sa.Column("new_values", postgresql.JSONB),
        sa.Column("reason", sa.Text),
        sa.Column("approved_by", sa.BigInteger, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("attendance_corrections")
    op.drop_index("ix_att_date", table_name="attendance")
    op.drop_index("ix_att_emp_date", table_name="attendance")
    op.drop_table("attendance")
    op.drop_index("ix_leave_req_status", table_name="leave_requests")
    op.drop_index("ix_leave_req_emp", table_name="leave_requests")
    op.drop_table("leave_requests")
    op.drop_table("leave_balances")
    op.drop_table("leave_types")
    op.drop_index("ix_holidays_date", table_name="holidays")
    op.drop_table("holidays")
    op.drop_index("ix_emp_shifts_emp", table_name="employee_shifts")
    op.drop_table("employee_shifts")
    op.drop_table("shifts")
    op.drop_index("ix_employees_dept", table_name="employees")
    op.drop_index("ix_employees_code", table_name="employees")
    op.drop_index("ix_employees_org", table_name="employees")
    op.drop_table("employees")
    op.drop_table("designations")
