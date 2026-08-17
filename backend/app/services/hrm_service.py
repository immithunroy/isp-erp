from datetime import UTC, date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.errors import problem
from app.models.hrm import (
    Attendance,
    AttendanceCorrection,
    Designation,
    Employee,
    EmployeeShift,
    Holiday,
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    Shift,
)


# ── Designations ──────────────────────────────────────────────────────
def list_designations(
    db: Session, *, organization_id: int | None = None, search: str | None = None,
    offset: int = 0, limit: int = 20,
) -> tuple[list[Designation], int]:
    stmt = select(Designation)
    count_stmt = select(func.count(Designation.id))
    if organization_id is not None:
        stmt = stmt.where(Designation.organization_id == organization_id)
        count_stmt = count_stmt.where(Designation.organization_id == organization_id)
    if search:
        like = f"%{search}%"
        cond = Designation.name.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_designation(db: Session, did: int) -> Designation | None:
    return db.get(Designation, did)


def create_designation(db: Session, payload: dict, *, user_id: int | None = None) -> Designation:
    d = Designation(**payload)
    db.add(d)
    db.flush()
    write_audit(db, user_id=user_id, action="designation.create", entity_type="designation", entity_id=str(d.id), new_value=payload)
    db.commit()
    db.refresh(d)
    return d


def update_designation(db: Session, d: Designation, payload: dict, *, user_id: int | None = None) -> Designation:
    prev = {c: getattr(d, c) for c in payload}
    for k, v in payload.items():
        setattr(d, k, v)
    db.flush()
    write_audit(db, user_id=user_id, action="designation.update", entity_type="designation", entity_id=str(d.id), previous_value=prev, new_value=payload)
    db.commit()
    db.refresh(d)
    return d


def delete_designation(db: Session, d: Designation, *, user_id: int | None = None) -> None:
    write_audit(db, user_id=user_id, action="designation.delete", entity_type="designation", entity_id=str(d.id))
    db.delete(d)
    db.commit()


# ── Employees ─────────────────────────────────────────────────────────
def list_employees(
    db: Session, *, search: str | None = None, organization_id: int | None = None,
    department_id: int | None = None, is_active: bool | None = None,
    offset: int = 0, limit: int = 20,
) -> tuple[list[Employee], int]:
    stmt = select(Employee)
    count_stmt = select(func.count(Employee.id))
    if search:
        like = f"%{search}%"
        cond = Employee.full_name.ilike(like) | Employee.employee_code.ilike(like) | Employee.email.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(Employee.organization_id == organization_id)
        count_stmt = count_stmt.where(Employee.organization_id == organization_id)
    if department_id is not None:
        stmt = stmt.where(Employee.department_id == department_id)
        count_stmt = count_stmt.where(Employee.department_id == department_id)
    if is_active is not None:
        stmt = stmt.where(Employee.is_active == is_active)
        count_stmt = count_stmt.where(Employee.is_active == is_active)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_employee(db: Session, eid: int) -> Employee | None:
    return db.get(Employee, eid)


def create_employee(db: Session, payload: dict, *, user_id: int | None = None) -> Employee:
    if db.scalar(select(Employee).where(Employee.employee_code == payload["employee_code"])):
        raise problem(409, "Conflict", "Employee code already exists.")
    e = Employee(**payload)
    db.add(e)
    db.flush()
    write_audit(db, user_id=user_id, action="employee.create", entity_type="employee", entity_id=str(e.id), new_value=payload)
    db.commit()
    db.refresh(e)
    return e


def update_employee(db: Session, e: Employee, payload: dict, *, user_id: int | None = None) -> Employee:
    prev = {c: getattr(e, c) for c in payload if hasattr(e, c)}
    for k, v in payload.items():
        setattr(e, k, v)
    db.flush()
    write_audit(db, user_id=user_id, action="employee.update", entity_type="employee", entity_id=str(e.id), previous_value=prev, new_value=payload)
    db.commit()
    db.refresh(e)
    return e


def delete_employee(db: Session, e: Employee, *, user_id: int | None = None) -> None:
    write_audit(db, user_id=user_id, action="employee.delete", entity_type="employee", entity_id=str(e.id))
    db.delete(e)
    db.commit()


# ── Shifts ────────────────────────────────────────────────────────────
def list_shifts(
    db: Session, *, organization_id: int | None = None, search: str | None = None,
    offset: int = 0, limit: int = 20,
) -> tuple[list[Shift], int]:
    stmt = select(Shift)
    count_stmt = select(func.count(Shift.id))
    if organization_id is not None:
        stmt = stmt.where(Shift.organization_id == organization_id)
        count_stmt = count_stmt.where(Shift.organization_id == organization_id)
    if search:
        like = f"%{search}%"
        cond = Shift.name.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_shift(db: Session, sid: int) -> Shift | None:
    return db.get(Shift, sid)


def create_shift(db: Session, payload: dict, *, user_id: int | None = None) -> Shift:
    s = Shift(**payload)
    db.add(s)
    db.flush()
    write_audit(db, user_id=user_id, action="shift.create", entity_type="shift", entity_id=str(s.id), new_value=payload)
    db.commit()
    db.refresh(s)
    return s


def update_shift(db: Session, s: Shift, payload: dict, *, user_id: int | None = None) -> Shift:
    prev = {c: getattr(s, c) for c in payload}
    for k, v in payload.items():
        setattr(s, k, v)
    db.flush()
    write_audit(db, user_id=user_id, action="shift.update", entity_type="shift", entity_id=str(s.id), previous_value=prev, new_value=payload)
    db.commit()
    db.refresh(s)
    return s


def delete_shift(db: Session, s: Shift, *, user_id: int | None = None) -> None:
    write_audit(db, user_id=user_id, action="shift.delete", entity_type="shift", entity_id=str(s.id))
    db.delete(s)
    db.commit()


def assign_shift(db: Session, payload: dict, *, user_id: int | None = None) -> EmployeeShift:
    es = EmployeeShift(**payload)
    db.add(es)
    db.flush()
    write_audit(db, user_id=user_id, action="employee_shift.assign", entity_type="employee_shift", entity_id=str(es.id), new_value=payload)
    db.commit()
    db.refresh(es)
    return es


# ── Holidays ─────────────────────────────────────────────────────────
def list_holidays(
    db: Session, *, organization_id: int | None = None, year: int | None = None,
    offset: int = 0, limit: int = 50,
) -> tuple[list[Holiday], int]:
    stmt = select(Holiday)
    count_stmt = select(func.count(Holiday.id))
    if organization_id is not None:
        stmt = stmt.where(Holiday.organization_id == organization_id)
        count_stmt = count_stmt.where(Holiday.organization_id == organization_id)
    if year is not None:
        stmt = stmt.where(func.extract("year", Holiday.date) == year)
        count_stmt = count_stmt.where(func.extract("year", Holiday.date) == year)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_holiday(db: Session, hid: int) -> Holiday | None:
    return db.get(Holiday, hid)


def create_holiday(db: Session, payload: dict, *, user_id: int | None = None) -> Holiday:
    h = Holiday(**payload)
    db.add(h)
    db.flush()
    write_audit(db, user_id=user_id, action="holiday.create", entity_type="holiday", entity_id=str(h.id), new_value=payload)
    db.commit()
    db.refresh(h)
    return h


def update_holiday(db: Session, h: Holiday, payload: dict, *, user_id: int | None = None) -> Holiday:
    prev = {c: getattr(h, c) for c in payload}
    for k, v in payload.items():
        setattr(h, k, v)
    db.flush()
    write_audit(db, user_id=user_id, action="holiday.update", entity_type="holiday", entity_id=str(h.id), previous_value=prev, new_value=payload)
    db.commit()
    db.refresh(h)
    return h


def delete_holiday(db: Session, h: Holiday, *, user_id: int | None = None) -> None:
    write_audit(db, user_id=user_id, action="holiday.delete", entity_type="holiday", entity_id=str(h.id))
    db.delete(h)
    db.commit()


# ── Leave Types ───────────────────────────────────────────────────────
def list_leave_types(
    db: Session, *, organization_id: int | None = None,
    offset: int = 0, limit: int = 50,
) -> tuple[list[LeaveType], int]:
    stmt = select(LeaveType)
    count_stmt = select(func.count(LeaveType.id))
    if organization_id is not None:
        stmt = stmt.where(LeaveType.organization_id == organization_id)
        count_stmt = count_stmt.where(LeaveType.organization_id == organization_id)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_leave_type(db: Session, ltid: int) -> LeaveType | None:
    return db.get(LeaveType, ltid)


def create_leave_type(db: Session, payload: dict, *, user_id: int | None = None) -> LeaveType:
    lt = LeaveType(**payload)
    db.add(lt)
    db.flush()
    write_audit(db, user_id=user_id, action="leave_type.create", entity_type="leave_type", entity_id=str(lt.id), new_value=payload)
    db.commit()
    db.refresh(lt)
    return lt


def update_leave_type(db: Session, lt: LeaveType, payload: dict, *, user_id: int | None = None) -> LeaveType:
    prev = {c: getattr(lt, c) for c in payload}
    for k, v in payload.items():
        setattr(lt, k, v)
    db.flush()
    write_audit(db, user_id=user_id, action="leave_type.update", entity_type="leave_type", entity_id=str(lt.id), previous_value=prev, new_value=payload)
    db.commit()
    db.refresh(lt)
    return lt


def delete_leave_type(db: Session, lt: LeaveType, *, user_id: int | None = None) -> None:
    write_audit(db, user_id=user_id, action="leave_type.delete", entity_type="leave_type", entity_id=str(lt.id))
    db.delete(lt)
    db.commit()


# ── Leave Balances ────────────────────────────────────────────────────
def list_leave_balances(
    db: Session, *, employee_id: int | None = None, year: int | None = None,
    offset: int = 0, limit: int = 50,
) -> tuple[list[LeaveBalance], int]:
    stmt = select(LeaveBalance)
    count_stmt = select(func.count(LeaveBalance.id))
    if employee_id is not None:
        stmt = stmt.where(LeaveBalance.employee_id == employee_id)
        count_stmt = count_stmt.where(LeaveBalance.employee_id == employee_id)
    if year is not None:
        stmt = stmt.where(LeaveBalance.year == year)
        count_stmt = count_stmt.where(LeaveBalance.year == year)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def create_leave_balance(db: Session, payload: dict, *, user_id: int | None = None) -> LeaveBalance:
    lb = LeaveBalance(**payload)
    db.add(lb)
    db.flush()
    write_audit(db, user_id=user_id, action="leave_balance.create", entity_type="leave_balance", entity_id=str(lb.id), new_value=payload)
    db.commit()
    db.refresh(lb)
    return lb


def update_leave_balance(db: Session, lb: LeaveBalance, payload: dict, *, user_id: int | None = None) -> LeaveBalance:
    prev = {c: getattr(lb, c) for c in payload}
    for k, v in payload.items():
        setattr(lb, k, v)
    db.flush()
    write_audit(db, user_id=user_id, action="leave_balance.update", entity_type="leave_balance", entity_id=str(lb.id), previous_value=prev, new_value=payload)
    db.commit()
    db.refresh(lb)
    return lb


# ── Leave Requests ────────────────────────────────────────────────────
def list_leave_requests(
    db: Session, *, employee_id: int | None = None, status: str | None = None,
    offset: int = 0, limit: int = 20,
) -> tuple[list[LeaveRequest], int]:
    stmt = select(LeaveRequest)
    count_stmt = select(func.count(LeaveRequest.id))
    if employee_id is not None:
        stmt = stmt.where(LeaveRequest.employee_id == employee_id)
        count_stmt = count_stmt.where(LeaveRequest.employee_id == employee_id)
    if status:
        stmt = stmt.where(LeaveRequest.status == status)
        count_stmt = count_stmt.where(LeaveRequest.status == status)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_leave_request(db: Session, lrid: int) -> LeaveRequest | None:
    return db.get(LeaveRequest, lrid)


def create_leave_request(db: Session, payload: dict, *, user_id: int | None = None) -> LeaveRequest:
    if payload["from_date"] > payload["to_date"]:
        raise problem(400, "Bad Request", "From date cannot be after to date.")
    lr = LeaveRequest(**payload)
    db.add(lr)
    db.flush()
    write_audit(db, user_id=user_id, action="leave_request.create", entity_type="leave_request", entity_id=str(lr.id), new_value=payload)
    db.commit()
    db.refresh(lr)
    return lr


def action_leave_request(
    db: Session, lr: LeaveRequest, status: str, approver_id: int, *, approver_note: str | None = None
) -> LeaveRequest:
    if lr.status != "pending":
        raise problem(400, "Bad Request", "Leave request already processed.")
    if status not in ("approved", "rejected"):
        raise problem(400, "Bad Request", "Status must be approved or rejected.")
    prev = {"status": lr.status}
    lr.status = status
    lr.approver_id = approver_id
    lr.approved_at = datetime.now(UTC)
    lr.approver_note = approver_note
    if status == "approved":
        days = (lr.to_date - lr.from_date).days + 1
        lb = db.scalar(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == lr.employee_id,
                LeaveBalance.leave_type_id == lr.leave_type_id,
            )
        )
        if lb:
            lb.used_days = float(lb.used_days) + float(days)
    db.flush()
    write_audit(db, user_id=approver_id, action="leave_request.action", entity_type="leave_request", entity_id=str(lr.id), previous_value=prev, new_value={"status": status})
    db.commit()
    db.refresh(lr)
    return lr


# ── Attendance ────────────────────────────────────────────────────────
VALID_ATT_TYPES = {"check_in", "check_out", "break_resume", "break_end", "field"}


def list_attendance(
    db: Session, *, employee_id: int | None = None, date_from: date | None = None,
    date_to: date | None = None, offset: int = 0, limit: int = 50,
) -> tuple[list[Attendance], int]:
    stmt = select(Attendance)
    count_stmt = select(func.count(Attendance.id))
    if employee_id is not None:
        stmt = stmt.where(Attendance.employee_id == employee_id)
        count_stmt = count_stmt.where(Attendance.employee_id == employee_id)
    if date_from is not None:
        stmt = stmt.where(Attendance.date >= date_from)
        count_stmt = count_stmt.where(Attendance.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Attendance.date <= date_to)
        count_stmt = count_stmt.where(Attendance.date <= date_to)
    stmt = stmt.order_by(Attendance.date.desc(), Attendance.local_ts.desc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_attendance(db: Session, aid: int) -> Attendance | None:
    return db.get(Attendance, aid)


def create_attendance(db: Session, payload: dict, *, user_id: int | None = None) -> Attendance:
    atype = payload.get("attendance_type", "")
    if atype not in VALID_ATT_TYPES:
        raise problem(400, "Bad Request", f"Invalid attendance type. Must be one of: {VALID_ATT_TYPES}")
    a = Attendance(**payload)
    db.add(a)
    db.flush()
    write_audit(db, user_id=user_id, action="attendance.create", entity_type="attendance", entity_id=str(a.id), new_value=payload)
    db.commit()
    db.refresh(a)
    return a


def correct_attendance(
    db: Session, att: Attendance, payload: dict, *, corrected_by: int | None = None
) -> AttendanceCorrection:
    prev = {c: getattr(att, c) for c in (payload.get("new_values", {}) or {})}
    new_vals = payload.get("new_values", {}) or {}
    for k, v in new_vals.items():
        if hasattr(att, k):
            setattr(att, k, v)
    att.is_corrected = True
    db.flush()
    corr = AttendanceCorrection(
        attendance_id=att.id,
        corrected_by=corrected_by,
        previous_values=payload.get("previous_values", prev),
        new_values=new_vals,
        reason=payload.get("reason"),
    )
    db.add(corr)
    db.flush()
    write_audit(db, user_id=corrected_by, action="attendance.correct", entity_type="attendance", entity_id=str(att.id), previous_value=prev, new_value=new_vals)
    db.commit()
    db.refresh(corr)
    return corr
