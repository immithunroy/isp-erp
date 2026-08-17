
from collections.abc import Callable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.errors import problem
from app.models.hrm import Attendance, Employee
from app.models.mobile import GpsRecord, SyncQueue

VALID_ATT_TYPES = {"check_in", "check_out", "break_resume", "break_end", "field"}
VALID_GPS_ACTIVITIES = {
    "attendance", "job", "asset_install", "asset_inspect",
    "customer_visit", "tracking",
}

DEFAULT_GPS_MAX_ACCURACY = 50.0


def _get_employee_by_user(db: Session, user_id: int) -> Employee | None:
    return db.scalar(select(Employee).where(Employee.user_id == user_id))


def submit_gps_record(
    db: Session, employee_id: int, payload: dict, *, user_id: int | None = None,
    _commit: bool = True,
) -> GpsRecord:
    accuracy = payload.get("accuracy")
    if accuracy is not None and float(accuracy) > DEFAULT_GPS_MAX_ACCURACY:
        # Accept with warning — do not reject, but flag in notes
        existing_notes = payload.get("notes") or ""
        payload["notes"] = f"{existing_notes} [WARNING: GPS accuracy {accuracy}m]".strip()

    from datetime import datetime as dt

    raw_ts = payload.get("recorded_at")
    if isinstance(raw_ts, str):
        payload["recorded_at"] = dt.fromisoformat(raw_ts.replace("Z", "+00:00"))

    rec = GpsRecord(employee_id=employee_id, **payload)
    db.add(rec)
    db.flush()
    write_audit(
        db, user_id=user_id, action="gps.record",
        entity_type="gps_record", entity_id=str(rec.id),
        new_value={"lat": rec.latitude, "lon": rec.longitude, "activity": rec.activity},
    )
    if _commit:
        db.commit()
        db.refresh(rec)
    return rec


def submit_attendance(
    db: Session, employee_id: int, payload: dict, *, user_id: int | None = None,
    _commit: bool = True,
) -> Attendance:
    atype = payload.get("attendance_type", "")
    if atype not in VALID_ATT_TYPES:
        raise problem(
            400, "Bad Request",
            f"Invalid attendance type. Must be one of: {VALID_ATT_TYPES}",
        )

    accuracy = payload.get("gps_accuracy")
    if accuracy is not None and float(accuracy) > DEFAULT_GPS_MAX_ACCURACY:
        existing_notes = payload.get("notes") or ""
        payload["notes"] = f"{existing_notes} [WARNING: GPS accuracy {accuracy}m]".strip()

    from datetime import date as d
    from datetime import datetime as dt

    # Parse date and local_ts — may come as strings from sync payload
    raw_date = payload["date"]
    att_date = d.fromisoformat(raw_date) if isinstance(raw_date, str) else raw_date
    raw_ts = payload["local_ts"]
    local_ts = dt.fromisoformat(raw_ts.replace("Z", "+00:00")) if isinstance(raw_ts, str) else raw_ts

    att = Attendance(
        employee_id=employee_id,
        date=att_date,
        attendance_type=payload["attendance_type"],
        local_ts=local_ts,
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        gps_accuracy=payload.get("gps_accuracy"),
        face_verified=payload.get("face_verified"),
        face_score=payload.get("face_score"),
        device_id=payload.get("device_id"),
        source="mobile",
        notes=payload.get("notes"),
    )
    db.add(att)
    db.flush()
    write_audit(
        db, user_id=user_id, action="attendance.mobile_submit",
        entity_type="attendance", entity_id=str(att.id),
        new_value=payload,
    )
    if _commit:
        db.commit()
        db.refresh(att)
    return att


def process_sync_batch(
    db: Session, employee_id: int, items: list[dict], *, user_id: int | None = None
) -> list[dict]:
    results: list[dict] = []
    for item in items:
        idem_key = item["idempotency_key"]
        entity_type = item["entity_type"]
        payload = item.get("payload", {})

        existing = db.scalar(
            select(SyncQueue).where(SyncQueue.idempotency_key == idem_key)
        )
        if existing:
            if existing.status == "done":
                results.append({
                    "idempotency_key": idem_key,
                    "status": "done",
                    "record_id": existing.processed_record_id,
                    "error": None,
                })
                continue
            # Re-process if previously failed
            if existing.status != "processing":
                existing.status = "processing"
                existing.retries += 1
                db.flush()

        # Create sync queue entry if not exists
        if not existing:
            sq = SyncQueue(
                employee_id=employee_id,
                idempotency_key=idem_key,
                entity_type=entity_type,
                payload=payload,
                status="processing",
            )
            db.add(sq)
            db.flush()
        else:
            sq = existing

        try:
            record_id = None
            if entity_type == "attendance":
                att = submit_attendance(
                    db, employee_id, payload, user_id=user_id, _commit=False
                )
                record_id = att.id
            elif entity_type == "gps":
                gps = submit_gps_record(
                    db, employee_id, payload, user_id=user_id, _commit=False
                )
                record_id = gps.id
            else:
                raise problem(400, "Bad Request", f"Unknown entity type: {entity_type}")

            sq.status = "done"
            sq.processed_record_id = record_id
            sq.error = None
            db.flush()
            results.append({
                "idempotency_key": idem_key,
                "status": "done",
                "record_id": record_id,
                "error": None,
            })
        except Exception as exc:
            sq.status = "failed"
            sq.error = str(exc)
            db.flush()
            results.append({
                "idempotency_key": idem_key,
                "status": "failed",
                "record_id": None,
                "error": str(exc),
            })

    db.commit()
    return results


def get_mobile_profile(db: Session, user_id: int) -> dict:
    from app.models.core import User
    user = db.get(User, user_id)
    if not user:
        raise problem(404, "Not Found", "User not found.")
    emp = _get_employee_by_user(db, user_id)
    dept_name = None
    desig_name = None
    if emp:
        if emp.department:
            dept_name = emp.department.name
        if emp.designation:
            desig_name = emp.designation.name
    return {
        "user_id": user.id,
        "employee_id": emp.id if emp else None,
        "email": user.email,
        "full_name": user.full_name if not emp else emp.full_name,
        "employee_code": emp.employee_code if emp else None,
        "department": dept_name,
        "designation": desig_name,
        "phone": emp.phone if emp else user.phone,
    }


def get_mobile_settings(db: Session) -> dict:
    from app.services.user_service import get_setting

    settings: dict[str, object] = {
        "gps_max_accuracy_meters": 50.0,
        "gps_accuracy_mode": "high",
        "tracking_enabled": False,
        "face_verification_required": True,
        "sync_interval_seconds": 30,
    }

    overrides: list[tuple[str, str, Callable[[Any], Any]]] = [
        ("gps.max_accuracy", "gps_max_accuracy_meters", float),
        ("gps.accuracy_mode", "gps_accuracy_mode", str),
        ("mobile.tracking_enabled", "tracking_enabled", lambda v: v == "true" or v is True),
        ("mobile.face_verification_required", "face_verification_required", lambda v: v == "true" or v is True),
        ("mobile.sync_interval", "sync_interval_seconds", int),
    ]

    for key, field, converter in overrides:
        s = get_setting(db, key)
        if s and s.value:
            val = s.value.get("value") if isinstance(s.value, dict) else s.value
            if val is not None:
                try:
                    settings[field] = converter(val)
                except (ValueError, TypeError):
                    pass

    return settings
