from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.audit import (
    SystemSettingCreate,
    SystemSettingOut,
    SystemSettingUpdate,
)
from app.services import user_service

router = APIRouter(prefix="/settings", tags=["system-settings"])


@router.get("", response_model=Page[SystemSettingOut])
async def list_settings(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    category: str | None = Query(None),
    search: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("core:settings:read"))] = None,
) -> dict:
    rows, total = user_service.list_settings(
        db, category=category, search=search, offset=pagination.offset, limit=pagination.limit
    )
    return paginate(rows, total, pagination)


@router.get("/{setting_id}", response_model=SystemSettingOut)
async def get_setting(
    setting_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("core:settings:read"))] = None,
) -> SystemSettingOut:
    setting = user_service.get_setting_by_id(db, setting_id)
    if not setting:
        raise problem(404, "Not Found", "Setting not found.")
    return setting


@router.post("", response_model=SystemSettingOut, status_code=status.HTTP_201_CREATED)
async def create_setting(
    payload: SystemSettingCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:settings:write"))],
) -> SystemSettingOut:
    return user_service.create_setting(db, payload.model_dump(), user_id=user.id)


@router.put("/{setting_id}", response_model=SystemSettingOut)
async def update_setting(
    setting_id: int,
    payload: SystemSettingUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:settings:write"))],
) -> SystemSettingOut:
    setting = user_service.get_setting_by_id(db, setting_id)
    if not setting:
        raise problem(404, "Not Found", "Setting not found.")
    data = payload.model_dump(exclude_unset=True)
    return user_service.update_setting(db, setting, data, user_id=user.id)


@router.delete("/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_setting(
    setting_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:settings:write"))],
) -> None:
    setting = user_service.get_setting_by_id(db, setting_id)
    if not setting:
        raise problem(404, "Not Found", "Setting not found.")
    user_service.delete_setting(db, setting, user_id=user.id)
    return None
