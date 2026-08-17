from __future__ import annotations

from datetime import date as dt_date
from datetime import datetime

from app.schemas.base import ORMModel, TimestampedOut


# ── Network Asset ──────────────────────────────────────────────────────
class NetworkAssetOut(TimestampedOut):
    id: int
    organization_id: int
    asset_code: str
    asset_type: str
    name: str
    status: str = "active"
    latitude: float | None = None
    longitude: float | None = None
    accuracy_m: float | None = None
    installed_at: dt_date | None = None
    owner: str | None = None
    department_id: int | None = None
    parent_asset_id: int | None = None
    capacity: int | None = None
    photos: dict | None = None
    documents: dict | None = None
    notes: str | None = None
    is_active: bool = True


class NetworkAssetCreate(ORMModel):
    organization_id: int
    asset_code: str
    asset_type: str
    name: str
    status: str = "active"
    latitude: float | None = None
    longitude: float | None = None
    accuracy_m: float | None = None
    installed_at: dt_date | None = None
    owner: str | None = None
    department_id: int | None = None
    parent_asset_id: int | None = None
    capacity: int | None = None
    photos: dict | None = None
    documents: dict | None = None
    notes: str | None = None
    is_active: bool = True


class NetworkAssetUpdate(ORMModel):
    asset_code: str | None = None
    asset_type: str | None = None
    name: str | None = None
    status: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    accuracy_m: float | None = None
    installed_at: dt_date | None = None
    owner: str | None = None
    department_id: int | None = None
    parent_asset_id: int | None = None
    capacity: int | None = None
    photos: dict | None = None
    documents: dict | None = None
    notes: str | None = None
    is_active: bool | None = None


# ── Fiber Cable ────────────────────────────────────────────────────────
class FiberCableOut(TimestampedOut):
    id: int
    organization_id: int
    cable_code: str
    name: str
    cable_type: str | None = None
    core_count: int
    start_asset_id: int | None = None
    end_asset_id: int | None = None
    route_geojson: dict | None = None
    length_m: float | None = None
    installed_at: dt_date | None = None
    status: str = "active"
    owner: str | None = None
    notes: str | None = None


class FiberCableCreate(ORMModel):
    organization_id: int
    cable_code: str
    name: str
    cable_type: str | None = None
    core_count: int
    start_asset_id: int | None = None
    end_asset_id: int | None = None
    route_geojson: dict | None = None
    length_m: float | None = None
    installed_at: dt_date | None = None
    status: str = "active"
    owner: str | None = None
    notes: str | None = None


class FiberCableUpdate(ORMModel):
    cable_code: str | None = None
    name: str | None = None
    cable_type: str | None = None
    core_count: int | None = None
    start_asset_id: int | None = None
    end_asset_id: int | None = None
    route_geojson: dict | None = None
    length_m: float | None = None
    installed_at: dt_date | None = None
    status: str | None = None
    owner: str | None = None
    notes: str | None = None


# ── Fiber Core ─────────────────────────────────────────────────────────
class FiberCoreOut(ORMModel):
    id: int
    cable_id: int
    core_number: int
    color: str | None = None
    status: str = "available"
    source_asset_id: int | None = None
    destination_asset_id: int | None = None
    related_customer_id: int | None = None
    notes: str | None = None


class FiberCoreCreate(ORMModel):
    cable_id: int
    core_number: int
    color: str | None = None
    status: str = "available"
    source_asset_id: int | None = None
    destination_asset_id: int | None = None
    related_customer_id: int | None = None
    notes: str | None = None


class FiberCoreUpdate(ORMModel):
    status: str | None = None
    source_asset_id: int | None = None
    destination_asset_id: int | None = None
    related_customer_id: int | None = None
    notes: str | None = None


# ── Splice ─────────────────────────────────────────────────────────────
class SpliceOut(ORMModel):
    id: int
    enclosure_asset_id: int | None = None
    source_core_id: int
    destination_core_id: int
    splice_loss: float | None = None
    technician_id: int | None = None
    spliced_at: datetime
    notes: str | None = None


class SpliceCreate(ORMModel):
    enclosure_asset_id: int | None = None
    source_core_id: int
    destination_core_id: int
    splice_loss: float | None = None
    technician_id: int | None = None
    notes: str | None = None


# ── Splitter Port ──────────────────────────────────────────────────────
class SplitterPortOut(ORMModel):
    id: int
    splitter_asset_id: int
    port_kind: str
    port_index: int
    connected_core_id: int | None = None
    status: str = "available"
    notes: str | None = None


class SplitterPortCreate(ORMModel):
    splitter_asset_id: int
    port_kind: str
    port_index: int
    connected_core_id: int | None = None
    status: str = "available"
    notes: str | None = None


class SplitterPortUpdate(ORMModel):
    connected_core_id: int | None = None
    status: str | None = None
    notes: str | None = None


# ── Customer Network Link ──────────────────────────────────────────────
class CustomerNetworkLinkOut(ORMModel):
    id: int
    customer_id: int
    link_kind: str
    target_asset_id: int | None = None
    target_core_id: int | None = None
    target_port_index: int | None = None
    notes: str | None = None


class CustomerNetworkLinkCreate(ORMModel):
    customer_id: int
    link_kind: str
    target_asset_id: int | None = None
    target_core_id: int | None = None
    target_port_index: int | None = None
    notes: str | None = None


# ── Map / GIS helpers ──────────────────────────────────────────────────
class MapItem(ORMModel):
    id: int
    asset_code: str
    asset_type: str
    name: str
    status: str
    latitude: float | None = None
    longitude: float | None = None


class BBoxRequest(ORMModel):
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float
