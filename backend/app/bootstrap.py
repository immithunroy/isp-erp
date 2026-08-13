"""Bootstrap initial data: dev organization, admin user, core permissions, admin role."""
from __future__ import annotations

import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.core import Organization, Permission, Role, RolePermission, User

# Foundational permission codes. Module-specific permissions will be added
# in later phases (e.g. network:assets:read, accounting:journal:post).
CORE_PERMISSIONS = [
    ("core:users:read", "core", "Read users"),
    ("core:users:write", "core", "Create/update users"),
    ("core:roles:manage", "core", "Manage roles and permissions"),
    ("core:settings:manage", "core", "Manage system settings"),
    ("core:audit:read", "core", "Read audit logs"),
]

ADMIN_EMAIL = "admin@isp-erp.example.com"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me-now")


def seed_initial_data(db: Session, *, admin_password: str | None = None) -> dict:
    created: dict[str, object] = {}

    org = db.scalar(select(Organization).where(Organization.code == "ISP-ERP"))
    if not org:
        org = Organization(name="ISP ERP", code="ISP-ERP", is_active=True)
        db.add(org)
        db.flush()
        created["organization"] = org.id

    perms = {}
    for code, module, desc in CORE_PERMISSIONS:
        p = db.scalar(select(Permission).where(Permission.code == code))
        if not p:
            p = Permission(code=code, module=module, description=desc)
            db.add(p)
            db.flush()
            created[f"perm:{code}"] = p.id
        perms[code] = p

    role = db.scalar(select(Role).where(Role.code == "admin"))
    if not role:
        role = Role(
            organization_id=org.id,
            name="Administrator",
            code="admin",
            description="Full administrative access",
            is_system=True,
        )
        db.add(role)
        db.flush()
        created["role:admin"] = role.id

        for p in perms.values():
            db.add(RolePermission(role_id=role.id, permission_id=p.id))

    pwd = admin_password or ADMIN_PASSWORD
    admin = db.scalar(select(User).where(User.email == ADMIN_EMAIL))
    if not admin:
        admin = User(
            email=ADMIN_EMAIL,
            full_name="System Administrator",
            password_hash=hash_password(pwd),
            organization_id=org.id,
            is_active=True,
            is_superuser=True,
        )
        db.add(admin)
        db.flush()
        admin.roles.append(role)
        created["user:admin"] = admin.id

    db.commit()
    return created
