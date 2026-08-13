from app.schemas.base import ORMModel, TimestampedOut


class OrganizationOut(TimestampedOut):
    id: int
    name: str
    legal_name: str | None = None
    code: str | None = None
    address: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    is_active: bool = True


class OrganizationCreate(ORMModel):
    name: str
    legal_name: str | None = None
    code: str | None = None
    address: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    is_active: bool = True


class OrganizationUpdate(ORMModel):
    name: str | None = None
    legal_name: str | None = None
    code: str | None = None
    address: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    is_active: bool | None = None


class BranchOut(TimestampedOut):
    id: int
    organization_id: int
    name: str
    code: str | None = None
    address: str | None = None
    is_active: bool = True


class BranchCreate(ORMModel):
    organization_id: int
    name: str
    code: str | None = None
    address: str | None = None
    is_active: bool = True


class BranchUpdate(ORMModel):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    is_active: bool | None = None


class DepartmentOut(TimestampedOut):
    id: int
    organization_id: int
    branch_id: int | None = None
    parent_id: int | None = None
    name: str
    code: str | None = None
    is_active: bool = True


class DepartmentCreate(ORMModel):
    organization_id: int
    branch_id: int | None = None
    parent_id: int | None = None
    name: str
    code: str | None = None
    is_active: bool = True


class DepartmentUpdate(ORMModel):
    branch_id: int | None = None
    parent_id: int | None = None
    name: str | None = None
    code: str | None = None
    is_active: bool | None = None
