from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.models.hrm import Employee
from app.schemas.mobile import (
    GpsRecordCreate,
    GpsRecordOut,
    MobileAttendanceCreate,
    MobileAttendanceOut,
    MobileProfileOut,
    MobileSettingsOut,
    SyncBatchRequest,
    SyncBatchResponse,
)
from app.services import mobile_service

router = APIRouter(prefix="/mobile", tags=["mobile"])


def _resolve_employee(db: Session, user: User) -> Employee:
    emp = db.scalar(select(Employee).where(Employee.user_id == user.id))
    if not emp:
        raise problem(
            404, "Not Found",
            "No employee profile linked to this user. Contact admin.",
        )
    return emp


@router.get("/profile", response_model=MobileProfileOut)
async def get_profile(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    return mobile_service.get_mobile_profile(db, user.id)


@router.get("/settings", response_model=MobileSettingsOut)
async def get_settings(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    return mobile_service.get_mobile_settings(db)


@router.post("/attendance", response_model=MobileAttendanceOut)
async def submit_attendance(
    payload: MobileAttendanceCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    emp = _resolve_employee(db, user)
    data = payload.model_dump()
    att = mobile_service.submit_attendance(db, emp.id, data, user_id=user.id)
    return {
        "id": att.id,
        "employee_id": att.employee_id,
        "date": att.date.isoformat(),
        "attendance_type": att.attendance_type,
        "local_ts": att.local_ts,
        "latitude": att.latitude,
        "longitude": att.longitude,
        "gps_accuracy": float(att.gps_accuracy) if att.gps_accuracy else None,
        "face_verified": att.face_verified,
        "face_score": float(att.face_score) if att.face_score else None,
        "device_id": att.device_id,
        "source": att.source,
        "notes": att.notes,
        "is_corrected": att.is_corrected,
        "created_at": att.created_at,
    }


@router.post("/gps", response_model=GpsRecordOut)
async def submit_gps(
    payload: GpsRecordCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    emp = _resolve_employee(db, user)
    rec = mobile_service.submit_gps_record(db, emp.id, payload.model_dump(), user_id=user.id)
    return {
        "id": rec.id,
        "employee_id": rec.employee_id,
        "latitude": rec.latitude,
        "longitude": rec.longitude,
        "accuracy": float(rec.accuracy) if rec.accuracy else None,
        "recorded_at": rec.recorded_at,
        "received_at": rec.received_at,
        "source": rec.source,
        "activity": rec.activity,
        "related_type": rec.related_type,
        "related_id": rec.related_id,
        "device_id": rec.device_id,
        "notes": rec.notes,
    }


@router.post("/sync", response_model=SyncBatchResponse)
async def sync_batch(
    payload: SyncBatchRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict:
    emp = _resolve_employee(db, user)
    results = mobile_service.process_sync_batch(
        db, emp.id, [i.model_dump() for i in payload.items], user_id=user.id
    )
    succeeded = sum(1 for r in results if r["status"] == "done")
    failed = sum(1 for r in results if r["status"] == "failed")
    return {
        "results": results,
        "total": len(results),
        "succeeded": succeeded,
        "failed": failed,
    }
