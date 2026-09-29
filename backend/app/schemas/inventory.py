from __future__ import annotations

from datetime import date as dt_date
from datetime import datetime

from app.schemas.base import ORMModel, TimestampedOut


# ── Warehouse ──────────────────────────────────────────────────────────
class WarehouseOut(TimestampedOut):
    id: int
    organization_id: int
    code: str
    name: str
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    manager_id: int | None = None
    is_active: bool = True
    notes: str | None = None


class WarehouseCreate(ORMModel):
    organization_id: int
    code: str
    name: str
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    manager_id: int | None = None
    is_active: bool = True
    notes: str | None = None


class WarehouseUpdate(ORMModel):
    code: str | None = None
    name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    manager_id: int | None = None
    is_active: bool | None = None
    notes: str | None = None


# ── Stock Item ─────────────────────────────────────────────────────────
class StockItemOut(TimestampedOut):
    id: int
    organization_id: int
    sku: str
    name: str
    description: str | None = None
    category: str | None = None
    unit: str = "pcs"
    unit_cost: float | None = None
    reorder_level: float = 0
    asset_class: str | None = None
    is_active: bool = True
    notes: str | None = None


class StockItemCreate(ORMModel):
    organization_id: int
    sku: str
    name: str
    description: str | None = None
    category: str | None = None
    unit: str = "pcs"
    unit_cost: float | None = None
    reorder_level: float = 0
    asset_class: str | None = None
    is_active: bool = True
    notes: str | None = None


class StockItemUpdate(ORMModel):
    sku: str | None = None
    name: str | None = None
    description: str | None = None
    category: str | None = None
    unit: str | None = None
    unit_cost: float | None = None
    reorder_level: float | None = None
    asset_class: str | None = None
    is_active: bool | None = None
    notes: str | None = None


# ── Stock Level ────────────────────────────────────────────────────────
class StockLevelOut(ORMModel):
    id: int
    warehouse_id: int
    item_id: int
    quantity: float
    reserved_quantity: float
    available_quantity: float
    reorder_level: float
    is_low: bool
    updated_at: datetime


# ── Stock Movement ─────────────────────────────────────────────────────
class StockMovementOut(TimestampedOut):
    id: int
    organization_id: int
    movement_type: str
    item_id: int
    warehouse_id: int
    to_warehouse_id: int | None = None
    quantity: float
    signed_delta: float
    balance_after: float | None = None
    network_asset_id: int | None = None
    work_order_id: int | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    reason: str | None = None
    moved_at: datetime
    created_by: int | None = None


class StockMovementCreate(ORMModel):
    organization_id: int
    # receipt | issue | adjustment
    movement_type: str
    item_id: int
    warehouse_id: int
    # For "adjustment" this is a signed delta. For receipt/issue it must be > 0.
    quantity: float
    network_asset_id: int | None = None
    work_order_id: int | None = None
    reason: str | None = None


class StockTransferCreate(ORMModel):
    organization_id: int
    item_id: int
    from_warehouse_id: int
    to_warehouse_id: int
    quantity: float
    reason: str | None = None


# ── Purchase Order ─────────────────────────────────────────────────────
class PurchaseOrderLineOut(ORMModel):
    id: int
    purchase_order_id: int
    item_id: int
    quantity: float
    received_quantity: float
    unit_cost: float
    line_total: float
    notes: str | None = None


class PurchaseOrderLineCreate(ORMModel):
    item_id: int
    quantity: float
    unit_cost: float = 0
    notes: str | None = None


class PurchaseOrderOut(TimestampedOut):
    id: int
    organization_id: int
    po_number: str
    supplier_name: str
    supplier_contact: str | None = None
    supplier_email: str | None = None
    status: str = "draft"
    warehouse_id: int
    order_date: dt_date
    expected_date: dt_date | None = None
    currency: str = "USD"
    subtotal: float
    tax_amount: float
    total_amount: float
    notes: str | None = None
    created_by: int | None = None
    approved_by: int | None = None
    approved_at: datetime | None = None
    received_at: datetime | None = None
    cancelled_at: datetime | None = None
    lines: list[PurchaseOrderLineOut] = []


class PurchaseOrderCreate(ORMModel):
    organization_id: int
    po_number: str
    supplier_name: str
    warehouse_id: int
    supplier_contact: str | None = None
    supplier_email: str | None = None
    expected_date: dt_date | None = None
    currency: str = "USD"
    tax_amount: float = 0
    notes: str | None = None
    lines: list[PurchaseOrderLineCreate] = []


class PurchaseOrderUpdate(ORMModel):
    supplier_name: str | None = None
    supplier_contact: str | None = None
    supplier_email: str | None = None
    warehouse_id: int | None = None
    expected_date: dt_date | None = None
    currency: str | None = None
    tax_amount: float | None = None
    notes: str | None = None


class PurchaseOrderReceiveLine(ORMModel):
    line_id: int
    quantity: float


class PurchaseOrderReceive(ORMModel):
    lines: list[PurchaseOrderReceiveLine]
    notes: str | None = None


# ── Low stock / summary helpers ────────────────────────────────────────
class LowStockItem(ORMModel):
    warehouse_id: int
    item_id: int
    sku: str
    item_name: str
    unit: str
    quantity: float
    reorder_level: float
    shortfall: float
