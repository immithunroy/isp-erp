from datetime import datetime

from app.schemas.base import ORMModel


class AuditLogOut(ORMModel):
    id: int
    user_id: int | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    previous_value: dict | None = None
    new_value: dict | None = None
    ip: str | None = None
    user_agent: str | None = None
    device_id: str | None = None
    created_at: datetime


class SystemSettingOut(ORMModel):
    id: int
    key: str
    value: dict | None = None
    category: str | None = None
    description: str | None = None


class SystemSettingCreate(ORMModel):
    key: str
    value: dict | None = None
    category: str | None = None
    description: str | None = None


class SystemSettingUpdate(ORMModel):
    value: dict | None = None
    category: str | None = None
    description: str | None = None
