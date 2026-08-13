from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.audit import AuditLogOut
from app.services import audit_service

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=Page[AuditLogOut])
async def list_audit_logs(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    user_id: int | None = Query(None),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("core:audit:read"))] = None,
) -> dict:
    rows, total = audit_service.list_audit_logs(
        db,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@router.get("/{log_id}", response_model=AuditLogOut)
async def get_audit_log(
    log_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("core:audit:read"))] = None,
) -> AuditLogOut:
    log = audit_service.get_audit_log(db, log_id)
    if not log:
        raise problem(404, "Not Found", "Audit log not found.")
    return log
