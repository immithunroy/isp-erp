from datetime import datetime
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, BaseModel, ConfigDict, Field


def _validate_email(value: str) -> str:
    try:
        return validate_email(value, check_deliverability=False).normalized
    except EmailNotValidError as exc:
        raise ValueError(str(exc)) from exc


Email = Annotated[str, AfterValidator(_validate_email)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


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


class UserOut(ORMModel):
    id: int
    email: Email
    full_name: str
    phone: str | None = None
    is_active: bool
    is_superuser: bool
    last_login_at: datetime | None = None
    roles: list["RoleOut"] = Field(default_factory=list)
    permissions: list["PermissionOut"] = Field(default_factory=list)


class RoleOut(ORMModel):
    id: int
    name: str
    code: str
    is_system: bool = False


class PermissionOut(ORMModel):
    id: int
    code: str
    module: str


class UserCreate(BaseModel):
    email: Email
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None
    organization_id: int | None = None
    branch_id: int | None = None
    is_superuser: bool = False


UserOut.model_rebuild()
RoleOut.model_rebuild()
PermissionOut.model_rebuild()
