from datetime import datetime

from app.schemas.base import ORMModel


class GpsRecordOut(ORMModel):
    id: int
    employee_id: int
    latitude: float
    longitude: float
    accuracy: float | None = None
    recorded_at: datetime
    received_at: datetime
    source: str = "mobile"
    activity: str
    related_type: str | None = None
    related_id: str | None = None
    device_id: str | None = None
    notes: str | None = None


class GpsRecordCreate(ORMModel):
    latitude: float
    longitude: float
    accuracy: float | None = None
    recorded_at: datetime
    source: str = "mobile"
    activity: str
    related_type: str | None = None
    related_id: str | None = None
    device_id: str | None = None
    notes: str | None = None


class MobileAttendanceCreate(ORMModel):
    employee_id: int
    date: str
    attendance_type: str
    local_ts: datetime
    latitude: float | None = None
    longitude: float | None = None
    gps_accuracy: float | None = None
    face_verified: bool | None = None
    face_score: float | None = None
    device_id: str | None = None
    notes: str | None = None


class MobileAttendanceOut(ORMModel):
    id: int
    employee_id: int
    date: str
    attendance_type: str
    local_ts: datetime
    latitude: float | None = None
    longitude: float | None = None
    gps_accuracy: float | None = None
    face_verified: bool | None = None
    face_score: float | None = None
    device_id: str | None = None
    source: str = "mobile"
    notes: str | None = None
    is_corrected: bool = False
    created_at: datetime


class SyncItemCreate(ORMModel):
    idempotency_key: str
    entity_type: str
    payload: dict


class SyncItemResult(ORMModel):
    idempotency_key: str
    status: str
    record_id: int | None = None
    error: str | None = None


class SyncBatchRequest(ORMModel):
    items: list[SyncItemCreate]


class SyncBatchResponse(ORMModel):
    results: list[SyncItemResult]
    total: int
    succeeded: int
    failed: int


class MobileProfileOut(ORMModel):
    user_id: int
    employee_id: int | None = None
    email: str
    full_name: str
    employee_code: str | None = None
    department: str | None = None
    designation: str | None = None
    phone: str | None = None


class MobileSettingsOut(ORMModel):
    gps_max_accuracy_meters: float = 50.0
    gps_accuracy_mode: str = "high"
    tracking_enabled: bool = False
    face_verification_required: bool = True
    sync_interval_seconds: int = 30
