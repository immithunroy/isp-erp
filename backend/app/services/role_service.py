from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.models.core import Permission, Role, RolePermission


def list_roles(
    db: Session,
    *,
    organization_id: int | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Role], int]:
    stmt = select(Role)
    count_stmt = select(func.count(Role.id))
    if organization_id is not None:
        stmt = stmt.where(Role.organization_id == organization_id)
        count_stmt = count_stmt.where(Role.organization_id == organization_id)
    if search:
        like = f"%{search}%"
        cond = Role.name.ilike(like) | Role.code.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset(offset).limit(limit)).all()
    return list(rows), total


def get_role(db: Session, role_id: int) -> Role | None:
    return db.get(Role, role_id)


def create_role(db: Session, payload: dict, *, user_id: int | None = None) -> Role:
    perm_ids = payload.pop("permission_ids", [])
    role = Role(**payload)
    db.add(role)
    db.flush()
    if perm_ids:
        perms = db.scalars(select(Permission).where(Permission.id.in_(perm_ids))).all()
        for p in perms:
            db.add(RolePermission(role_id=role.id, permission_id=p.id))
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="role.create",
        entity_type="role",
        entity_id=str(role.id),
        new_value={**payload, "permission_ids": perm_ids},
    )
    db.commit()
    db.refresh(role)
    return role


def update_role(
    db: Session, role: Role, payload: dict, *, user_id: int | None = None
) -> Role:
    if role.is_system and "code" in payload and payload["code"] != role.code:
        from app.errors import problem

        raise problem(400, "Bad Request", "System role code cannot be changed.")
    previous = {c: getattr(role, c) for c in payload if hasattr(role, c)}
    perm_ids = payload.pop("permission_ids", None)
    for k, v in payload.items():
        setattr(role, k, v)
    if perm_ids is not None:
        db.execute(delete(RolePermission).where(RolePermission.role_id == role.id))
        perms = db.scalars(select(Permission).where(Permission.id.in_(perm_ids))).all()
        for p in perms:
            db.add(RolePermission(role_id=role.id, permission_id=p.id))
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="role.update",
        entity_type="role",
        entity_id=str(role.id),
        previous_value=previous,
        new_value={**payload, "permission_ids": perm_ids},
    )
    db.commit()
    db.refresh(role)
    return role


def delete_role(db: Session, role: Role, *, user_id: int | None = None) -> None:
    if role.is_system:
        from app.errors import problem

        raise problem(400, "Bad Request", "System role cannot be deleted.")
    write_audit(
        db,
        user_id=user_id,
        action="role.delete",
        entity_type="role",
        entity_id=str(role.id),
        previous_value={"name": role.name, "id": role.id},
    )
    db.delete(role)
    db.commit()


# ── Permissions ───────────────────────────────────────────────────────
def list_permissions(
    db: Session,
    *,
    module: str | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[list[Permission], int]:
    stmt = select(Permission)
    count_stmt = select(func.count(Permission.id))
    if module:
        stmt = stmt.where(Permission.module == module)
        count_stmt = count_stmt.where(Permission.module == module)
    if search:
        like = f"%{search}%"
        cond = Permission.code.ilike(like) | Permission.description.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset(offset).limit(limit)).all()
    return list(rows), total


def get_permission(db: Session, perm_id: int) -> Permission | None:
    return db.get(Permission, perm_id)


def create_permission(
    db: Session, payload: dict, *, user_id: int | None = None
) -> Permission:
    perm = Permission(**payload)
    db.add(perm)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="permission.create",
        entity_type="permission",
        entity_id=str(perm.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(perm)
    return perm


def update_permission(
    db: Session, perm: Permission, payload: dict, *, user_id: int | None = None
) -> Permission:
    previous = {c: getattr(perm, c) for c in payload}
    for k, v in payload.items():
        setattr(perm, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="permission.update",
        entity_type="permission",
        entity_id=str(perm.id),
        previous_value=previous,
        new_value=payload,
    )
    db.commit()
    db.refresh(perm)
    return perm


def delete_permission(
    db: Session, perm: Permission, *, user_id: int | None = None
) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="permission.delete",
        entity_type="permission",
        entity_id=str(perm.id),
        previous_value={"code": perm.code, "id": perm.id},
    )
    db.delete(perm)
    db.commit()
