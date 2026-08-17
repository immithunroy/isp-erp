from datetime import date as dt_date
from datetime import datetime, time

from app.schemas.base import ORMModel, TimestampedOut


# ── Designation ───────────────────────────────────────────────────────
class DesignationOut(TimestampedOut):
    id: int
    organization_id: int
    department_id: int | None = None
    name: str
    code: str | None = None
    grade: str | None = None
    is_active: bool = True


class DesignationCreate(ORMModel):
    organization_id: int
    department_id: int | None = None
    name: str
    code: str | None = None
    grade: str | None = None
    is_active: bool = True


class DesignationUpdate(ORMModel):
    department_id: int | None = None
    name: str | None = None
    code: str | None = None
    grade: str | None = None
    is_active: bool | None = None


# ── Employee ──────────────────────────────────────────────────────────
class EmployeeOut(TimestampedOut):
    id: int
    organization_id: int
    branch_id: int | None = None
    department_id: int | None = None
    designation_id: int | None = None
    supervisor_id: int | None = None
    user_id: int | None = None
    employee_code: str
    full_name: str
    photo_url: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    joining_date: dt_date | None = None
    employment_status: str = "active"
    is_active: bool = True
    notes: str | None = None


class EmployeeCreate(ORMModel):
    organization_id: int
    branch_id: int | None = None
    department_id: int | None = None
    designation_id: int | None = None
    supervisor_id: int | None = None
    user_id: int | None = None
    employee_code: str
    full_name: str
    photo_url: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    joining_date: dt_date | None = None
    employment_status: str = "active"
    notes: str | None = None


class EmployeeUpdate(ORMModel):
    branch_id: int | None = None
    department_id: int | None = None
    designation_id: int | None = None
    supervisor_id: int | None = None
    user_id: int | None = None
    full_name: str | None = None
    photo_url: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    joining_date: dt_date | None = None
    employment_status: str | None = None
    is_active: bool | None = None
    notes: str | None = None


# ── Shift ─────────────────────────────────────────────────────────────
class ShiftOut(TimestampedOut):
    id: int
    organization_id: int
    name: str
    code: str | None = None
    start_time: time
    end_time: time
    grace_minutes: int = 15
    is_active: bool = True


class ShiftCreate(ORMModel):
    organization_id: int
    name: str
    code: str | None = None
    start_time: time
    end_time: time
    grace_minutes: int = 15
    is_active: bool = True


class ShiftUpdate(ORMModel):
    name: str | None = None
    code: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    grace_minutes: int | None = None
    is_active: bool | None = None


# ── Holiday ───────────────────────────────────────────────────────────
class HolidayOut(TimestampedOut):
    id: int
    organization_id: int
    branch_id: int | None = None
    name: str
    description: str | None = None
    date: dt_date
    is_recurring: bool = False
    scope: str = "org"


class HolidayCreate(ORMModel):
    organization_id: int
    branch_id: int | None = None
    name: str
    description: str | None = None
    date: dt_date
    is_recurring: bool = False
    scope: str = "org"


class HolidayUpdate(ORMModel):
    branch_id: int | None = None
    name: str | None = None
    description: str | None = None
    date: dt_date | None = None
    is_recurring: bool | None = None
    scope: str | None = None


# ── Leave Type ────────────────────────────────────────────────────────
class LeaveTypeOut(TimestampedOut):
    id: int
    organization_id: int
    name: str
    code: str
    description: str | None = None
    default_days: float = 0
    is_paid: bool = True
    is_active: bool = True


class LeaveTypeCreate(ORMModel):
    organization_id: int
    name: str
    code: str
    description: str | None = None
    default_days: float = 0
    is_paid: bool = True
    is_active: bool = True


class LeaveTypeUpdate(ORMModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    default_days: float | None = None
    is_paid: bool | None = None
    is_active: bool | None = None


# ── Leave Balance ─────────────────────────────────────────────────────
class LeaveBalanceOut(TimestampedOut):
    id: int
    employee_id: int
    leave_type_id: int
    year: int
    allocated_days: float
    used_days: float


class LeaveBalanceCreate(ORMModel):
    employee_id: int
    leave_type_id: int
    year: int
    allocated_days: float = 0


class LeaveBalanceUpdate(ORMModel):
    allocated_days: float | None = None
    used_days: float | None = None


# ── Leave Request ─────────────────────────────────────────────────────
class LeaveRequestOut(TimestampedOut):
    id: int
    employee_id: int
    leave_type_id: int
    from_date: dt_date
    to_date: dt_date
    reason: str | None = None
    status: str = "pending"
    approver_id: int | None = None
    approved_at: datetime | None = None
    approver_note: str | None = None


class LeaveRequestCreate(ORMModel):
    employee_id: int
    leave_type_id: int
    from_date: dt_date
    to_date: dt_date
    reason: str | None = None


class LeaveRequestAction(ORMModel):
    status: str  # "approved" | "rejected"
    approver_note: str | None = None


# ── Attendance ────────────────────────────────────────────────────────
class AttendanceOut(ORMModel):
    id: int
    employee_id: int
    date: dt_date
    attendance_type: str
    local_ts: datetime
    latitude: float | None = None
    longitude: float | None = None
    gps_accuracy: float | None = None
    face_verified: bool | None = None
    face_score: float | None = None
    device_id: str | None = None
    ip: str | None = None
    source: str = "mobile"
    notes: str | None = None
    is_corrected: bool = False
    created_at: datetime


class AttendanceCreate(ORMModel):
    employee_id: int
    date: dt_date
    attendance_type: str  # check_in | check_out | break_resume | break_end | field
    local_ts: datetime
    latitude: float | None = None
    longitude: float | None = None
    gps_accuracy: float | None = None
    face_verified: bool | None = None
    face_score: float | None = None
    device_id: str | None = None
    source: str = "mobile"
    notes: str | None = None


class AttendanceCorrectionCreate(ORMModel):
    attendance_id: int
    previous_values: dict | None = None
    new_values: dict | None = None
    reason: str | None = None


class AttendanceCorrectionOut(ORMModel):
    id: int
    attendance_id: int
    corrected_by: int | None = None
    previous_values: dict | None = None
    new_values: dict | None = None
    reason: str | None = None
    approved_by: int | None = None
    created_at: datetime


# ── Employee Shift ────────────────────────────────────────────────────
class EmployeeShiftOut(ORMModel):
    id: int
    employee_id: int
    shift_id: int
    effective_from: dt_date
    effective_to: dt_date | None = None


class EmployeeShiftCreate(ORMModel):
    employee_id: int
    shift_id: int
    effective_from: dt_date
    effective_to: dt_date | None = None
