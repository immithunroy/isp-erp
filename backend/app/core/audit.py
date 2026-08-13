from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.core import AuditLog


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
        previous_value=previous_value,
        new_value=new_value,
        ip=ip,
        user_agent=user_agent,
        device_id=device_id,
    )
    db.add(row)
    db.flush()
    return row
