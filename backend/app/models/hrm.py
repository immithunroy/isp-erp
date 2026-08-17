from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.core import BigIntType, JSONType


# ── Designation ───────────────────────────────────────────────────────
class Designation(TimestampMixin, Base):
    __tablename__ = "designations"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_designation_org_code"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("departments.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    code: Mapped[str | None] = mapped_column(Text)
    grade: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    department = relationship("Department")


# ── Employee ──────────────────────────────────────────────────────────
class Employee(TimestampMixin, Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("branches.id", ondelete="SET NULL")
    )
    department_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("departments.id", ondelete="SET NULL")
    )
    designation_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("designations.id", ondelete="SET NULL")
    )
    supervisor_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="SET NULL")
    )
    user_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )
    employee_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    photo_url: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    emergency_contact_name: Mapped[str | None] = mapped_column(Text)
    emergency_contact_phone: Mapped[str | None] = mapped_column(Text)
    joining_date: Mapped[date | None] = mapped_column(Date)
    employment_status: Mapped[str] = mapped_column(
        String(20), server_default="active", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    department = relationship("Department")
    designation = relationship("Designation")
    supervisor = relationship("Employee", remote_side="Employee.id")


# ── Shift ─────────────────────────────────────────────────────────────
class Shift(TimestampMixin, Base):
    __tablename__ = "shifts"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_shift_org_code"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    code: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    grace_minutes: Mapped[int] = mapped_column(Integer, server_default="15", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)


# ── Employee Shift ───────────────────────────────────────────────────
class EmployeeShift(Base):
    __tablename__ = "employee_shifts"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    shift_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False
    )
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)

    employee = relationship("Employee")
    shift = relationship("Shift")


# ── Holiday ───────────────────────────────────────────────────────────
class Holiday(TimestampMixin, Base):
    __tablename__ = "holidays"
    __table_args__ = (
        UniqueConstraint("organization_id", "date", "name", name="uq_holiday_org_date_name"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("branches.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    scope: Mapped[str] = mapped_column(String(20), server_default="org", nullable=False)

    branch = relationship("Branch")


# ── Leave Type ────────────────────────────────────────────────────────
class LeaveType(TimestampMixin, Base):
    __tablename__ = "leave_types"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_leave_type_org_code"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    default_days: Mapped[float] = mapped_column(Numeric(5, 1), server_default="0", nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)


# ── Leave Balance ─────────────────────────────────────────────────────
class LeaveBalance(TimestampMixin, Base):
    __tablename__ = "leave_balances"
    __table_args__ = (
        UniqueConstraint("employee_id", "leave_type_id", "year", name="uq_leave_balance_emp_type_year"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    leave_type_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    allocated_days: Mapped[float] = mapped_column(Numeric(5, 1), server_default="0", nullable=False)
    used_days: Mapped[float] = mapped_column(Numeric(5, 1), server_default="0", nullable=False)

    employee = relationship("Employee")
    leave_type = relationship("LeaveType")


# ── Leave Request ─────────────────────────────────────────────────────
class LeaveRequest(TimestampMixin, Base):
    __tablename__ = "leave_requests"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    leave_type_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False
    )
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False)
    approver_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approver_note: Mapped[str | None] = mapped_column(Text)

    employee = relationship("Employee")
    leave_type = relationship("LeaveType")
    approver = relationship("User")


# ── Attendance ────────────────────────────────────────────────────────
class Attendance(Base):
    __tablename__ = "attendance"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    attendance_type: Mapped[str] = mapped_column(String(20), nullable=False)
    local_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    gps_accuracy: Mapped[float | None] = mapped_column(Numeric(6, 2))
    face_verified: Mapped[bool | None] = mapped_column(Boolean)
    face_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    device_id: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[str | None] = mapped_column(String(45))
    source: Mapped[str] = mapped_column(String(20), server_default="mobile", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    is_corrected: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    employee = relationship("Employee")


# ── Attendance Correction ─────────────────────────────────────────────
class AttendanceCorrection(TimestampMixin, Base):
    __tablename__ = "attendance_corrections"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    attendance_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("attendance.id", ondelete="CASCADE"), nullable=False
    )
    corrected_by: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )
    previous_values: Mapped[dict | None] = mapped_column(JSONType)
    new_values: Mapped[dict | None] = mapped_column(JSONType)
    reason: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )

    attendance = relationship("Attendance")
    corrected_by_user = relationship("User", foreign_keys=[corrected_by])
    approved_by_user = relationship("User", foreign_keys=[approved_by])
