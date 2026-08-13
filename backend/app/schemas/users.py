from app.schemas.auth import PermissionOut, RoleOut
from app.schemas.base import Email, ORMModel


class RoleCreate(ORMModel):
    organization_id: int | None = None
    name: str
    code: str
    description: str | None = None
    is_system: bool = False
    permission_ids: list[int] = []


class RoleUpdate(ORMModel):
    name: str | None = None
    description: str | None = None
    permission_ids: list[int] | None = None


class PermissionCreate(ORMModel):
    code: str
    module: str
    description: str | None = None


class PermissionUpdate(ORMModel):
    module: str | None = None
    description: str | None = None


class RoleOutWithPermissions(RoleOut):
    permissions: list[PermissionOut] = []


class UserCreate(ORMModel):
    email: Email
    full_name: str
    password: str
    phone: str | None = None
    organization_id: int | None = None
    branch_id: int | None = None
    is_superuser: bool = False
    is_active: bool = True
    role_ids: list[int] = []
    permission_ids: list[int] = []


class UserUpdate(ORMModel):
    full_name: str | None = None
    phone: str | None = None
    organization_id: int | None = None
    branch_id: int | None = None
    is_superuser: bool | None = None
    is_active: bool | None = None
    role_ids: list[int] | None = None
    permission_ids: list[int] | None = None


class PasswordChange(ORMModel):
    current_password: str
    new_password: str
