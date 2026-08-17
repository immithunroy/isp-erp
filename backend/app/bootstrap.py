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
    ("core:roles:read", "core", "Read roles"),
    ("core:roles:write", "core", "Manage roles and permissions"),
    ("core:organizations:read", "core", "Read organizations"),
    ("core:organizations:write", "core", "Create/update organizations"),
    ("core:branches:read", "core", "Read branches"),
    ("core:branches:write", "core", "Create/update branches"),
    ("core:departments:read", "core", "Read departments"),
    ("core:departments:write", "core", "Create/update departments"),
    ("core:settings:read", "core", "Read system settings"),
    ("core:settings:write", "core", "Manage system settings"),
    ("core:audit:read", "core", "Read audit logs"),
    # HRM
    ("hrm:employees:read", "hrm", "Read employees"),
    ("hrm:employees:write", "hrm", "Create/update employees"),
    ("hrm:designations:read", "hrm", "Read designations"),
    ("hrm:designations:write", "hrm", "Create/update designations"),
    ("hrm:shifts:read", "hrm", "Read shifts"),
    ("hrm:shifts:write", "hrm", "Create/update shifts"),
    ("hrm:holidays:read", "hrm", "Read holidays"),
    ("hrm:holidays:write", "hrm", "Create/update holidays"),
    ("hrm:leave:read", "hrm", "Read leave types/balances/requests"),
    ("hrm:leave:write", "hrm", "Create/update leave"),
    ("hrm:leave:approve", "hrm", "Approve/reject leave requests"),
    ("hrm:attendance:read", "hrm", "Read attendance"),
    ("hrm:attendance:write", "hrm", "Create attendance"),
    ("hrm:attendance:correct", "hrm", "Correct attendance records"),
]

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@isp-erp.example.com")
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
