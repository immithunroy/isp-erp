from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import get_current_user, require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.auth import UserOut
from app.schemas.users import PasswordChange, UserCreate, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=Page[UserOut])
async def list_users(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    _: Annotated[User, Depends(require_permission("core:users:read"))] = None,
) -> dict:
    rows, total = user_service.list_users(
        db,
        search=search,
        organization_id=organization_id,
        is_active=is_active,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("core:users:read"))] = None,
) -> UserOut:
    user = user_service.get_user(db, user_id)
    if not user:
        raise problem(404, "Not Found", "User not found.")
    return user


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("core:users:write"))],
) -> UserOut:
    return user_service.create_user(db, payload.model_dump(), current_user_id=current_user.id)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("core:users:write"))],
) -> UserOut:
    user = user_service.get_user(db, user_id)
    if not user:
        raise problem(404, "Not Found", "User not found.")
    data = payload.model_dump(exclude_unset=True)
    return user_service.update_user(db, user, data, current_user_id=current_user.id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("core:users:write"))],
) -> None:
    user = user_service.get_user(db, user_id)
    if not user:
        raise problem(404, "Not Found", "User not found.")
    user_service.delete_user(db, user, current_user_id=current_user.id)
    return None


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_my_password(
    payload: PasswordChange,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    user_service.change_password(
        db,
        current_user,
        payload.current_password,
        payload.new_password,
        current_user_id=current_user.id,
    )
    return None
