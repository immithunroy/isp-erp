from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.users import (
    PermissionCreate,
    PermissionOut,
    PermissionUpdate,
    RoleCreate,
    RoleOutWithPermissions,
    RoleUpdate,
)
from app.services import role_service

# ── Roles ─────────────────────────────────────────────────────────────
roles_router = APIRouter(prefix="/roles", tags=["roles"])


@roles_router.get("", response_model=Page[RoleOutWithPermissions])
async def list_roles(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    search: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("core:roles:read"))] = None,
) -> dict:
    rows, total = role_service.list_roles(
        db,
        organization_id=organization_id,
        search=search,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@roles_router.get("/{role_id}", response_model=RoleOutWithPermissions)
async def get_role(
    role_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("core:roles:read"))] = None,
) -> RoleOutWithPermissions:
    role = role_service.get_role(db, role_id)
    if not role:
        raise problem(404, "Not Found", "Role not found.")
    return role


@roles_router.post("", response_model=RoleOutWithPermissions, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:roles:write"))],
) -> RoleOutWithPermissions:
    return role_service.create_role(db, payload.model_dump(), user_id=user.id)


@roles_router.put("/{role_id}", response_model=RoleOutWithPermissions)
async def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:roles:write"))],
) -> RoleOutWithPermissions:
    role = role_service.get_role(db, role_id)
    if not role:
        raise problem(404, "Not Found", "Role not found.")
    data = payload.model_dump(exclude_unset=True)
    return role_service.update_role(db, role, data, user_id=user.id)


@roles_router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:roles:write"))],
) -> None:
    role = role_service.get_role(db, role_id)
    if not role:
        raise problem(404, "Not Found", "Role not found.")
    role_service.delete_role(db, role, user_id=user.id)
    return None


# ── Permissions ───────────────────────────────────────────────────────
perms_router = APIRouter(prefix="/permissions", tags=["permissions"])


@perms_router.get("", response_model=Page[PermissionOut])
async def list_permissions(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    module: str | None = Query(None),
    search: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("core:roles:read"))] = None,
) -> dict:
    rows, total = role_service.list_permissions(
        db, module=module, search=search, offset=pagination.offset, limit=pagination.limit
    )
    return paginate(rows, total, pagination)


@perms_router.post("", response_model=PermissionOut, status_code=status.HTTP_201_CREATED)
async def create_permission(
    payload: PermissionCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:roles:write"))],
) -> PermissionOut:
    return role_service.create_permission(db, payload.model_dump(), user_id=user.id)


@perms_router.put("/{perm_id}", response_model=PermissionOut)
async def update_permission(
    perm_id: int,
    payload: PermissionUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:roles:write"))],
) -> PermissionOut:
    perm = role_service.get_permission(db, perm_id)
    if not perm:
        raise problem(404, "Not Found", "Permission not found.")
    data = payload.model_dump(exclude_unset=True)
    return role_service.update_permission(db, perm, data, user_id=user.id)


@perms_router.delete("/{perm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission(
    perm_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:roles:write"))],
) -> None:
    perm = role_service.get_permission(db, perm_id)
    if not perm:
        raise problem(404, "Not Found", "Permission not found.")
    role_service.delete_permission(db, perm, user_id=user.id)
    return None
