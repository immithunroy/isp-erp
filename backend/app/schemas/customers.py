from __future__ import annotations

from datetime import date as dt_date
from datetime import datetime

from app.schemas.base import ORMModel, TimestampedOut


# ── Customer ──────────────────────────────────────────────────────────
class CustomerOut(TimestampedOut):
    id: int
    organization_id: int
    branch_id: int | None = None
    customer_code: str
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    installation_date: dt_date | None = None
    status: str = "active"
    assigned_technician_id: int | None = None
    notes: str | None = None
    is_active: bool = True


class CustomerCreate(ORMModel):
    organization_id: int
    branch_id: int | None = None
    customer_code: str
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    installation_date: dt_date | None = None
    status: str = "active"
    assigned_technician_id: int | None = None
    notes: str | None = None
    is_active: bool = True


class CustomerUpdate(ORMModel):
    branch_id: int | None = None
    customer_code: str | None = None
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    installation_date: dt_date | None = None
    status: str | None = None
    assigned_technician_id: int | None = None
    notes: str | None = None
    is_active: bool | None = None


# ── Customer Location ─────────────────────────────────────────────────
class CustomerLocationOut(ORMModel):
    id: int
    customer_id: int
    latitude: float
    longitude: float
    accuracy: float | None = None
    address: str | None = None
    source: str = "mobile"
    collected_by: int | None = None
    collection_method: str | None = None
    recorded_at: datetime
    is_current: bool = True
    notes: str | None = None


class CustomerLocationCreate(ORMModel):
    customer_id: int
    latitude: float
    longitude: float
    accuracy: float | None = None
    address: str | None = None
    source: str = "mobile"
    collected_by: int | None = None
    collection_method: str | None = None
    notes: str | None = None


# ── Customer Visit ────────────────────────────────────────────────────
class CustomerVisitOut(TimestampedOut):
    id: int
    customer_id: int
    employee_id: int | None = None
    purpose: str | None = None
    visited_at: datetime
    latitude: float | None = None
    longitude: float | None = None
    gps_accuracy: float | None = None
    photos: dict | None = None
    notes: str | None = None


class CustomerVisitCreate(ORMModel):
    customer_id: int
    employee_id: int | None = None
    purpose: str | None = None
    visited_at: datetime
    latitude: float | None = None
    longitude: float | None = None
    gps_accuracy: float | None = None
    photos: dict | None = None
    notes: str | None = None


# ── Work Order ────────────────────────────────────────────────────────
class WorkOrderOut(TimestampedOut):
    id: int
    organization_id: int
    customer_id: int | None = None
    work_order_code: str
    job_type: str
    priority: str = "medium"
    assigned_employee_id: int | None = None
    scheduled_date: dt_date | None = None
    status: str = "open"
    latitude: float | None = None
    longitude: float | None = None
    photos: dict | None = None
    equipment_used: dict | None = None
    notes: str | None = None
    completion_report: str | None = None
    approved_by: int | None = None
    approved_at: datetime | None = None


class WorkOrderCreate(ORMModel):
    organization_id: int
    customer_id: int | None = None
    work_order_code: str
    job_type: str
    priority: str = "medium"
    assigned_employee_id: int | None = None
    scheduled_date: dt_date | None = None
    status: str = "open"
    latitude: float | None = None
    longitude: float | None = None
    photos: dict | None = None
    equipment_used: dict | None = None
    notes: str | None = None


class WorkOrderUpdate(ORMModel):
    customer_id: int | None = None
    job_type: str | None = None
    priority: str | None = None
    assigned_employee_id: int | None = None
    scheduled_date: dt_date | None = None
    status: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    photos: dict | None = None
    equipment_used: dict | None = None
    notes: str | None = None
    completion_report: str | None = None


# ── Work Order Event ──────────────────────────────────────────────────
class WorkOrderEventOut(ORMModel):
    id: int
    work_order_id: int
    event_type: str
    actor_id: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None
    created_at: datetime


# ── Work Order Action (transition) ────────────────────────────────────
class WorkOrderAction(ORMModel):
    status: str  # assigned/accepted/in_progress/completed/cancelled/approved
    notes: str | None = None
