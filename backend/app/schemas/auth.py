from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.base import Email, ORMModel


# ── auth ──────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: Email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class PermissionOut(ORMModel):
    id: int
    code: str
    module: str
    description: str | None = None


class RoleOut(ORMModel):
    id: int
    name: str
    code: str
    is_system: bool = False
    description: str | None = None


class UserOut(ORMModel):
    id: int
    email: Email
    full_name: str
    phone: str | None = None
    is_active: bool
    is_superuser: bool
    last_login_at: datetime | None = None
    roles: list[RoleOut] = Field(default_factory=list)
    permissions: list[PermissionOut] = Field(default_factory=list)
