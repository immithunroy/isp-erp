from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.hrm import (
    AttendanceCorrectionCreate,
    AttendanceCorrectionOut,
    AttendanceCreate,
    AttendanceOut,
    DesignationCreate,
    DesignationOut,
    DesignationUpdate,
    EmployeeCreate,
    EmployeeOut,
    EmployeeShiftCreate,
    EmployeeShiftOut,
    EmployeeUpdate,
    HolidayCreate,
    HolidayOut,
    HolidayUpdate,
    LeaveBalanceCreate,
    LeaveBalanceOut,
    LeaveBalanceUpdate,
    LeaveRequestAction,
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveTypeCreate,
    LeaveTypeOut,
    LeaveTypeUpdate,
    ShiftCreate,
    ShiftOut,
    ShiftUpdate,
)
from app.services import hrm_service

# ── Designations ──────────────────────────────────────────────────────
designations_router = APIRouter(prefix="/designations", tags=["designations"])


@designations_router.get("", response_model=Page[DesignationOut])
async def list_designations(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    search: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("hrm:designations:read"))] = None,
):
    rows, total = hrm_service.list_designations(db, organization_id=organization_id, search=search, offset=pagination.offset, limit=pagination.limit)
    return paginate(rows, total, pagination)


@designations_router.get("/{did}", response_model=DesignationOut)
async def get_designation(did: int, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_permission("hrm:designations:read"))] = None):
    d = hrm_service.get_designation(db, did)
    if not d:
        raise problem(404, "Not Found", "Designation not found.")
    return d


@designations_router.post("", response_model=DesignationOut, status_code=status.HTTP_201_CREATED)
async def create_designation(payload: DesignationCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:designations:write"))]):
    return hrm_service.create_designation(db, payload.model_dump(), user_id=user.id)


@designations_router.put("/{did}", response_model=DesignationOut)
async def update_designation(did: int, payload: DesignationUpdate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:designations:write"))]):
    d = hrm_service.get_designation(db, did)
    if not d:
        raise problem(404, "Not Found", "Designation not found.")
    return hrm_service.update_designation(db, d, payload.model_dump(exclude_unset=True), user_id=user.id)


@designations_router.delete("/{did}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_designation(did: int, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:designations:write"))]):
    d = hrm_service.get_designation(db, did)
    if not d:
        raise problem(404, "Not Found", "Designation not found.")
    hrm_service.delete_designation(db, d, user_id=user.id)
    return None


# ── Employees ─────────────────────────────────────────────────────────
employees_router = APIRouter(prefix="/employees", tags=["employees"])


@employees_router.get("", response_model=Page[EmployeeOut])
async def list_employees(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    department_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    _: Annotated[User, Depends(require_permission("hrm:employees:read"))] = None,
):
    rows, total = hrm_service.list_employees(db, search=search, organization_id=organization_id, department_id=department_id, is_active=is_active, offset=pagination.offset, limit=pagination.limit)
    return paginate(rows, total, pagination)


@employees_router.get("/{eid}", response_model=EmployeeOut)
async def get_employee(eid: int, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_permission("hrm:employees:read"))] = None):
    e = hrm_service.get_employee(db, eid)
    if not e:
        raise problem(404, "Not Found", "Employee not found.")
    return e


@employees_router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(payload: EmployeeCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:employees:write"))]):
    return hrm_service.create_employee(db, payload.model_dump(), user_id=user.id)


@employees_router.put("/{eid}", response_model=EmployeeOut)
async def update_employee(eid: int, payload: EmployeeUpdate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:employees:write"))]):
    e = hrm_service.get_employee(db, eid)
    if not e:
        raise problem(404, "Not Found", "Employee not found.")
    return hrm_service.update_employee(db, e, payload.model_dump(exclude_unset=True), user_id=user.id)


@employees_router.delete("/{eid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(eid: int, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:employees:write"))]):
    e = hrm_service.get_employee(db, eid)
    if not e:
        raise problem(404, "Not Found", "Employee not found.")
    hrm_service.delete_employee(db, e, user_id=user.id)
    return None


# ── Shifts ────────────────────────────────────────────────────────────
shifts_router = APIRouter(prefix="/shifts", tags=["shifts"])


@shifts_router.get("", response_model=Page[ShiftOut])
async def list_shifts(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    search: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("hrm:shifts:read"))] = None,
):
    rows, total = hrm_service.list_shifts(db, organization_id=organization_id, search=search, offset=pagination.offset, limit=pagination.limit)
    return paginate(rows, total, pagination)


@shifts_router.post("", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
async def create_shift(payload: ShiftCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:shifts:write"))]):
    return hrm_service.create_shift(db, payload.model_dump(), user_id=user.id)


@shifts_router.get("/{sid}", response_model=ShiftOut)
async def get_shift(sid: int, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_permission("hrm:shifts:read"))] = None):
    s = hrm_service.get_shift(db, sid)
    if not s:
        raise problem(404, "Not Found", "Shift not found.")
    return s


@shifts_router.put("/{sid}", response_model=ShiftOut)
async def update_shift(sid: int, payload: ShiftUpdate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:shifts:write"))]):
    s = hrm_service.get_shift(db, sid)
    if not s:
        raise problem(404, "Not Found", "Shift not found.")
    return hrm_service.update_shift(db, s, payload.model_dump(exclude_unset=True), user_id=user.id)


@shifts_router.delete("/{sid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift(sid: int, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:shifts:write"))]):
    s = hrm_service.get_shift(db, sid)
    if not s:
        raise problem(404, "Not Found", "Shift not found.")
    hrm_service.delete_shift(db, s, user_id=user.id)
    return None


@shifts_router.post("/assign", response_model=EmployeeShiftOut, status_code=status.HTTP_201_CREATED)
async def assign_shift(payload: EmployeeShiftCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:shifts:write"))]):
    return hrm_service.assign_shift(db, payload.model_dump(), user_id=user.id)


# ── Holidays ──────────────────────────────────────────────────────────
holidays_router = APIRouter(prefix="/holidays", tags=["holidays"])


@holidays_router.get("", response_model=Page[HolidayOut])
async def list_holidays(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    year: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("hrm:holidays:read"))] = None,
):
    rows, total = hrm_service.list_holidays(db, organization_id=organization_id, year=year, offset=pagination.offset, limit=pagination.limit)
    return paginate(rows, total, pagination)


@holidays_router.post("", response_model=HolidayOut, status_code=status.HTTP_201_CREATED)
async def create_holiday(payload: HolidayCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:holidays:write"))]):
    return hrm_service.create_holiday(db, payload.model_dump(), user_id=user.id)


@holidays_router.get("/{hid}", response_model=HolidayOut)
async def get_holiday(hid: int, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_permission("hrm:holidays:read"))] = None):
    h = hrm_service.get_holiday(db, hid)
    if not h:
        raise problem(404, "Not Found", "Holiday not found.")
    return h


@holidays_router.put("/{hid}", response_model=HolidayOut)
async def update_holiday(hid: int, payload: HolidayUpdate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:holidays:write"))]):
    h = hrm_service.get_holiday(db, hid)
    if not h:
        raise problem(404, "Not Found", "Holiday not found.")
    return hrm_service.update_holiday(db, h, payload.model_dump(exclude_unset=True), user_id=user.id)


@holidays_router.delete("/{hid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holiday(hid: int, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:holidays:write"))]):
    h = hrm_service.get_holiday(db, hid)
    if not h:
        raise problem(404, "Not Found", "Holiday not found.")
    hrm_service.delete_holiday(db, h, user_id=user.id)
    return None


# ── Leave Types ───────────────────────────────────────────────────────
leave_types_router = APIRouter(prefix="/leave-types", tags=["leave-types"])


@leave_types_router.get("", response_model=Page[LeaveTypeOut])
async def list_leave_types(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("hrm:leave:read"))] = None,
):
    rows, total = hrm_service.list_leave_types(db, organization_id=organization_id, offset=pagination.offset, limit=pagination.limit)
    return paginate(rows, total, pagination)


@leave_types_router.post("", response_model=LeaveTypeOut, status_code=status.HTTP_201_CREATED)
async def create_leave_type(payload: LeaveTypeCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:leave:write"))]):
    return hrm_service.create_leave_type(db, payload.model_dump(), user_id=user.id)


@leave_types_router.put("/{ltid}", response_model=LeaveTypeOut)
async def update_leave_type(ltid: int, payload: LeaveTypeUpdate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:leave:write"))]):
    lt = hrm_service.get_leave_type(db, ltid)
    if not lt:
        raise problem(404, "Not Found", "Leave type not found.")
    return hrm_service.update_leave_type(db, lt, payload.model_dump(exclude_unset=True), user_id=user.id)


@leave_types_router.delete("/{ltid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leave_type(ltid: int, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:leave:write"))]):
    lt = hrm_service.get_leave_type(db, ltid)
    if not lt:
        raise problem(404, "Not Found", "Leave type not found.")
    hrm_service.delete_leave_type(db, lt, user_id=user.id)
    return None


# ── Leave Balances ────────────────────────────────────────────────────
leave_balances_router = APIRouter(prefix="/leave-balances", tags=["leave-balances"])


@leave_balances_router.get("", response_model=Page[LeaveBalanceOut])
async def list_leave_balances(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    employee_id: int | None = Query(None),
    year: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("hrm:leave:read"))] = None,
):
    rows, total = hrm_service.list_leave_balances(db, employee_id=employee_id, year=year, offset=pagination.offset, limit=pagination.limit)
    return paginate(rows, total, pagination)


@leave_balances_router.post("", response_model=LeaveBalanceOut, status_code=status.HTTP_201_CREATED)
async def create_leave_balance(payload: LeaveBalanceCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:leave:write"))]):
    return hrm_service.create_leave_balance(db, payload.model_dump(), user_id=user.id)


@leave_balances_router.put("/{lbid}", response_model=LeaveBalanceOut)
async def update_leave_balance(lbid: int, payload: LeaveBalanceUpdate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:leave:write"))]):
    from app.models.hrm import LeaveBalance
    lb = db.get(LeaveBalance, lbid)
    if not lb:
        raise problem(404, "Not Found", "Leave balance not found.")
    return hrm_service.update_leave_balance(db, lb, payload.model_dump(exclude_unset=True), user_id=user.id)


# ── Leave Requests ────────────────────────────────────────────────────
leave_requests_router = APIRouter(prefix="/leave-requests", tags=["leave-requests"])


@leave_requests_router.get("", response_model=Page[LeaveRequestOut])
async def list_leave_requests(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    employee_id: int | None = Query(None),
    status: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("hrm:leave:read"))] = None,
):
    rows, total = hrm_service.list_leave_requests(db, employee_id=employee_id, status=status, offset=pagination.offset, limit=pagination.limit)
    return paginate(rows, total, pagination)


@leave_requests_router.post("", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
async def create_leave_request(payload: LeaveRequestCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:leave:write"))]):
    return hrm_service.create_leave_request(db, payload.model_dump(), user_id=user.id)


@leave_requests_router.get("/{lrid}", response_model=LeaveRequestOut)
async def get_leave_request(lrid: int, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_permission("hrm:leave:read"))] = None):
    lr = hrm_service.get_leave_request(db, lrid)
    if not lr:
        raise problem(404, "Not Found", "Leave request not found.")
    return lr


@leave_requests_router.post("/{lrid}/action", response_model=LeaveRequestOut)
async def action_leave_request(
    lrid: int, payload: LeaveRequestAction, db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("hrm:leave:approve"))],
):
    lr = hrm_service.get_leave_request(db, lrid)
    if not lr:
        raise problem(404, "Not Found", "Leave request not found.")
    return hrm_service.action_leave_request(db, lr, payload.status, user.id, approver_note=payload.approver_note)


# ── Attendance ────────────────────────────────────────────────────────
attendance_router = APIRouter(prefix="/attendance", tags=["attendance"])


@attendance_router.get("", response_model=Page[AttendanceOut])
async def list_attendance(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    employee_id: int | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("hrm:attendance:read"))] = None,
):
    from datetime import date as d
    df = d.fromisoformat(date_from) if date_from else None
    dt = d.fromisoformat(date_to) if date_to else None
    rows, total = hrm_service.list_attendance(db, employee_id=employee_id, date_from=df, date_to=dt, offset=pagination.offset, limit=pagination.limit)
    return paginate(rows, total, pagination)


@attendance_router.post("", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
async def create_attendance(payload: AttendanceCreate, db: Annotated[Session, Depends(get_db)], user: Annotated[User, Depends(require_permission("hrm:attendance:write"))]):
    return hrm_service.create_attendance(db, payload.model_dump(), user_id=user.id)


@attendance_router.get("/{aid}", response_model=AttendanceOut)
async def get_attendance(aid: int, db: Annotated[Session, Depends(get_db)], _: Annotated[User, Depends(require_permission("hrm:attendance:read"))] = None):
    a = hrm_service.get_attendance(db, aid)
    if not a:
        raise problem(404, "Not Found", "Attendance record not found.")
    return a


@attendance_router.post("/{aid}/correct", response_model=AttendanceCorrectionOut, status_code=status.HTTP_201_CREATED)
async def correct_attendance(
    aid: int, payload: AttendanceCorrectionCreate, db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("hrm:attendance:correct"))],
):
    a = hrm_service.get_attendance(db, aid)
    if not a:
        raise problem(404, "Not Found", "Attendance record not found.")
    return hrm_service.correct_attendance(db, a, payload.model_dump(), corrected_by=user.id)
