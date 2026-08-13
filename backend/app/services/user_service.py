from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.security import hash_password, verify_password
from app.models.core import Permission, Role, SystemSetting, User, user_permissions, user_roles


# ── Users ──────────────────────────────────────────────────────────────
def list_users(
    db: Session,
    *,
    search: str | None = None,
    organization_id: int | None = None,
    is_active: bool | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[User], int]:
    stmt = select(User)
    count_stmt = select(func.count(User.id))
    if search:
        like = f"%{search}%"
        cond = User.email.ilike(like) | User.full_name.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(User.organization_id == organization_id)
        count_stmt = count_stmt.where(User.organization_id == organization_id)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
        count_stmt = count_stmt.where(User.is_active == is_active)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset(offset).limit(limit)).all()
    return list(rows), total


def get_user(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def create_user(db: Session, payload: dict, *, current_user_id: int | None = None) -> User:
    from app.errors import problem

    role_ids = payload.pop("role_ids", [])
    permission_ids = payload.pop("permission_ids", [])
    plain_password = payload.pop("password")

    email = payload.get("email")
    if db.scalar(select(User).where(User.email == email)):
        raise problem(409, "Conflict", "A user with this email already exists.")

    payload["password_hash"] = hash_password(plain_password)
    user = User(**payload)
    db.add(user)
    db.flush()

    if role_ids:
        roles = db.scalars(select(Role).where(Role.id.in_(role_ids))).all()
        user.roles.extend(roles)
    if permission_ids:
        perms = db.scalars(select(Permission).where(Permission.id.in_(permission_ids))).all()
        user.permissions.extend(perms)

    write_audit(
        db,
        user_id=current_user_id,
        action="user.create",
        entity_type="user",
        entity_id=str(user.id),
        new_value={"email": user.email, "full_name": user.full_name,
                   "role_ids": role_ids, "permission_ids": permission_ids},
    )
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session, user: User, payload: dict, *, current_user_id: int | None = None
) -> User:
    role_ids = payload.pop("role_ids", None)
    permission_ids = payload.pop("permission_ids", None)

    previous = {c: getattr(user, c) for c in payload if hasattr(user, c)}
    for k, v in payload.items():
        setattr(user, k, v)

    if role_ids is not None:
        db.execute(sa_delete(user_roles).where(user_roles.c.user_id == user.id))
        roles = db.scalars(select(Role).where(Role.id.in_(role_ids))).all()
        user.roles = list(roles)
    if permission_ids is not None:
        db.execute(sa_delete(user_permissions).where(user_permissions.c.user_id == user.id))
        perms = db.scalars(select(Permission).where(Permission.id.in_(permission_ids))).all()
        user.permissions = list(perms)

    db.flush()
    write_audit(
        db,
        user_id=current_user_id,
        action="user.update",
        entity_type="user",
        entity_id=str(user.id),
        previous_value=previous,
        new_value={**payload, "role_ids": role_ids, "permission_ids": permission_ids},
    )
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User, *, current_user_id: int | None = None) -> None:
    from app.errors import problem

    if user.is_superuser:
        raise problem(400, "Bad Request", "Superuser cannot be deleted.")
    write_audit(
        db,
        user_id=current_user_id,
        action="user.delete",
        entity_type="user",
        entity_id=str(user.id),
        previous_value={"email": user.email, "id": user.id},
    )
    db.delete(user)
    db.commit()


def change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
    *,
    current_user_id: int | None = None,
) -> bool:
    from app.errors import problem

    if not verify_password(current_password, user.password_hash):
        raise problem(400, "Bad Request", "Current password is incorrect.")
    user.password_hash = hash_password(new_password)
    write_audit(
        db,
        user_id=current_user_id,
        action="user.password_change",
        entity_type="user",
        entity_id=str(user.id),
    )
    db.commit()
    return True


# ── System settings ───────────────────────────────────────────────────
def list_settings(
    db: Session,
    *,
    category: str | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[SystemSetting], int]:
    stmt = select(SystemSetting)
    count_stmt = select(func.count(SystemSetting.id))
    if category:
        stmt = stmt.where(SystemSetting.category == category)
        count_stmt = count_stmt.where(SystemSetting.category == category)
    if search:
        like = f"%{search}%"
        cond = SystemSetting.key.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    total = db.scalar(count_stmt) or 0
    rows = db.scalars(stmt.offset(offset).limit(limit)).all()
    return list(rows), total


def get_setting(db: Session, key: str) -> SystemSetting | None:
    return db.scalar(select(SystemSetting).where(SystemSetting.key == key))


def get_setting_by_id(db: Session, setting_id: int) -> SystemSetting | None:
    return db.get(SystemSetting, setting_id)


def create_setting(
    db: Session, payload: dict, *, user_id: int | None = None
) -> SystemSetting:
    from app.errors import problem

    if db.scalar(select(SystemSetting).where(SystemSetting.key == payload["key"])):
        raise problem(409, "Conflict", "Setting key already exists.")
    setting = SystemSetting(**payload, updated_by=user_id)
    db.add(setting)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="setting.create",
        entity_type="system_setting",
        entity_id=str(setting.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(setting)
    return setting


def update_setting(
    db: Session, setting: SystemSetting, payload: dict, *, user_id: int | None = None
) -> SystemSetting:
    previous = {c: getattr(setting, c) for c in payload if hasattr(setting, c)}
    for k, v in payload.items():
        setattr(setting, k, v)
    setting.updated_by = user_id
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="setting.update",
        entity_type="system_setting",
        entity_id=str(setting.id),
        previous_value=previous,
        new_value=payload,
    )
    db.commit()
    db.refresh(setting)
    return setting


def delete_setting(
    db: Session, setting: SystemSetting, *, user_id: int | None = None
) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="setting.delete",
        entity_type="system_setting",
        entity_id=str(setting.id),
        previous_value={"key": setting.key, "id": setting.id},
    )
    db.delete(setting)
    db.commit()
