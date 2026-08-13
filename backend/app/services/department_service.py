from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.models.core import Branch, Department


# ── Branches ───────────────────────────────────────────────────────────
def list_branches(
    db: Session,
    *,
    organization_id: int | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Branch], int]:
    stmt = select(Branch)
    count_stmt = select(func.count(Branch.id))
    if organization_id is not None:
        stmt = stmt.where(Branch.organization_id == organization_id)
        count_stmt = count_stmt.where(Branch.organization_id == organization_id)
    if search:
        like = f"%{search}%"
        cond = Branch.name.ilike(like) | Branch.code.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset(offset).limit(limit)).all()
    return list(rows), total


def get_branch(db: Session, branch_id: int) -> Branch | None:
    return db.get(Branch, branch_id)


def create_branch(db: Session, payload: dict, *, user_id: int | None = None) -> Branch:
    branch = Branch(**payload)
    db.add(branch)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="branch.create",
        entity_type="branch",
        entity_id=str(branch.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(branch)
    return branch


def update_branch(
    db: Session, branch: Branch, payload: dict, *, user_id: int | None = None
) -> Branch:
    previous = {c: getattr(branch, c) for c in payload}
    for k, v in payload.items():
        setattr(branch, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="branch.update",
        entity_type="branch",
        entity_id=str(branch.id),
        previous_value=previous,
        new_value=payload,
    )
    db.commit()
    db.refresh(branch)
    return branch


def delete_branch(db: Session, branch: Branch, *, user_id: int | None = None) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="branch.delete",
        entity_type="branch",
        entity_id=str(branch.id),
        previous_value={"name": branch.name, "id": branch.id},
    )
    db.delete(branch)
    db.commit()


# ── Departments ───────────────────────────────────────────────────────
def list_departments(
    db: Session,
    *,
    organization_id: int | None = None,
    branch_id: int | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Department], int]:
    stmt = select(Department)
    count_stmt = select(func.count(Department.id))
    if organization_id is not None:
        stmt = stmt.where(Department.organization_id == organization_id)
        count_stmt = count_stmt.where(Department.organization_id == organization_id)
    if branch_id is not None:
        stmt = stmt.where(Department.branch_id == branch_id)
        count_stmt = count_stmt.where(Department.branch_id == branch_id)
    if search:
        like = f"%{search}%"
        cond = Department.name.ilike(like) | Department.code.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset(offset).limit(limit)).all()
    return list(rows), total


def get_department(db: Session, dept_id: int) -> Department | None:
    return db.get(Department, dept_id)


def create_department(db: Session, payload: dict, *, user_id: int | None = None) -> Department:
    dept = Department(**payload)
    db.add(dept)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="department.create",
        entity_type="department",
        entity_id=str(dept.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(dept)
    return dept


def update_department(
    db: Session, dept: Department, payload: dict, *, user_id: int | None = None
) -> Department:
    previous = {c: getattr(dept, c) for c in payload}
    for k, v in payload.items():
        setattr(dept, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="department.update",
        entity_type="department",
        entity_id=str(dept.id),
        previous_value=previous,
        new_value=payload,
    )
    db.commit()
    db.refresh(dept)
    return dept


def delete_department(db: Session, dept: Department, *, user_id: int | None = None) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="department.delete",
        entity_type="department",
        entity_id=str(dept.id),
        previous_value={"name": dept.name, "id": dept.id},
    )
    db.delete(dept)
    db.commit()
