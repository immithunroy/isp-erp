from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.organization import (
    BranchCreate,
    BranchOut,
    BranchUpdate,
    DepartmentCreate,
    DepartmentOut,
    DepartmentUpdate,
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
)
from app.services import department_service, organization_service

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _actor(user: User) -> int | None:
    return user.id


# ── Organizations ─────────────────────────────────────────────────────
@router.get("", response_model=Page[OrganizationOut])
async def list_organizations(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("core:organizations:read"))] = None,
) -> dict:
    rows, total = organization_service.list_organizations(
        db, search=search, offset=pagination.offset, limit=pagination.limit
    )
    return paginate(rows, total, pagination)


@router.get("/{org_id}", response_model=OrganizationOut)
async def get_organization(
    org_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("core:organizations:read"))] = None,
) -> OrganizationOut:
    org = organization_service.get_organization(db, org_id)
    if not org:
        raise problem(404, "Not Found", "Organization not found.")
    return org


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:organizations:write"))],
) -> OrganizationOut:
    return organization_service.create_organization(
        db, payload.model_dump(), user_id=_actor(user)
    )


@router.put("/{org_id}", response_model=OrganizationOut)
async def update_organization(
    org_id: int,
    payload: OrganizationUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:organizations:write"))],
) -> OrganizationOut:
    org = organization_service.get_organization(db, org_id)
    if not org:
        raise problem(404, "Not Found", "Organization not found.")
    data = payload.model_dump(exclude_unset=True)
    return organization_service.update_organization(db, org, data, user_id=_actor(user))


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:organizations:write"))],
) -> None:
    org = organization_service.get_organization(db, org_id)
    if not org:
        raise problem(404, "Not Found", "Organization not found.")
    organization_service.delete_organization(db, org, user_id=_actor(user))
    return None


# ── Branches ──────────────────────────────────────────────────────────
branch_router = APIRouter(prefix="/branches", tags=["branches"])


@branch_router.get("", response_model=Page[BranchOut])
async def list_branches(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    search: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("core:branches:read"))] = None,
) -> dict:
    rows, total = department_service.list_branches(
        db,
        organization_id=organization_id,
        search=search,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@branch_router.get("/{branch_id}", response_model=BranchOut)
async def get_branch(
    branch_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("core:branches:read"))] = None,
) -> BranchOut:
    branch = department_service.get_branch(db, branch_id)
    if not branch:
        raise problem(404, "Not Found", "Branch not found.")
    return branch


@branch_router.post("", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:branches:write"))],
) -> BranchOut:
    return department_service.create_branch(db, payload.model_dump(), user_id=_actor(user))


@branch_router.put("/{branch_id}", response_model=BranchOut)
async def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:branches:write"))],
) -> BranchOut:
    branch = department_service.get_branch(db, branch_id)
    if not branch:
        raise problem(404, "Not Found", "Branch not found.")
    data = payload.model_dump(exclude_unset=True)
    return department_service.update_branch(db, branch, data, user_id=_actor(user))


@branch_router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:branches:write"))],
) -> None:
    branch = department_service.get_branch(db, branch_id)
    if not branch:
        raise problem(404, "Not Found", "Branch not found.")
    department_service.delete_branch(db, branch, user_id=_actor(user))
    return None


# ── Departments ───────────────────────────────────────────────────────
dept_router = APIRouter(prefix="/departments", tags=["departments"])


@dept_router.get("", response_model=Page[DepartmentOut])
async def list_departments(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    branch_id: int | None = Query(None),
    search: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("core:departments:read"))] = None,
) -> dict:
    rows, total = department_service.list_departments(
        db,
        organization_id=organization_id,
        branch_id=branch_id,
        search=search,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@dept_router.get("/{dept_id}", response_model=DepartmentOut)
async def get_department(
    dept_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("core:departments:read"))] = None,
) -> DepartmentOut:
    dept = department_service.get_department(db, dept_id)
    if not dept:
        raise problem(404, "Not Found", "Department not found.")
    return dept


@dept_router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:departments:write"))],
) -> DepartmentOut:
    return department_service.create_department(db, payload.model_dump(), user_id=_actor(user))


@dept_router.put("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:departments:write"))],
) -> DepartmentOut:
    dept = department_service.get_department(db, dept_id)
    if not dept:
        raise problem(404, "Not Found", "Department not found.")
    data = payload.model_dump(exclude_unset=True)
    return department_service.update_department(db, dept, data, user_id=_actor(user))


@dept_router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("core:departments:write"))],
) -> None:
    dept = department_service.get_department(db, dept_id)
    if not dept:
        raise problem(404, "Not Found", "Department not found.")
    department_service.delete_department(db, dept, user_id=_actor(user))
    return None
