from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.auth import UserOut

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_permission("core:users:read"))],
)


@router.get("", response_model=Page[UserOut])
async def list_users(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
) -> Page[UserOut]:
    count_stmt = select(func.count(User.id))
    stmt = select(User)
    if search:
        like = f"%{search}%"
        cond = (User.email.ilike(like)) | (User.full_name.ilike(like))
        count_stmt = count_stmt.where(cond)
        stmt = stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    stmt = stmt.offset(pagination.offset).limit(pagination.limit)
    users = db.scalars(stmt).all()
    items = [UserOut.model_validate(u, from_attributes=True) for u in users]
    return paginate(items, total, pagination)
