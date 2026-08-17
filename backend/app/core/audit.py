from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.core import AuditLog


def _sanitize(obj: Any) -> Any:
    """Recursively convert non-JSON-serializable types to strings for audit."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    if isinstance(obj, timedelta):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    return str(obj)


def write_audit(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    previous_value: Any = None,
    new_value: Any = None,
    request: Request | None = None,
    device_id: str | None = None,
) -> AuditLog:
    ip = None
    user_agent = None
    if request is not None:
        ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    row = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        previous_value=_sanitize(previous_value),
        new_value=_sanitize(new_value),
        ip=ip,
        user_agent=user_agent,
        device_id=device_id,
    )
    db.add(row)
    db.flush()
    return row
