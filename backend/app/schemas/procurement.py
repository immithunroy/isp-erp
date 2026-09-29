from __future__ import annotations

from datetime import date as dt_date
from datetime import datetime

from app.schemas.base import ORMModel, TimestampedOut


# ── Supplier ───────────────────────────────────────────────────────────
class SupplierOut(TimestampedOut):
    id: int
    organization_id: int
    code: str
    name: str
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    category: str | None = None
    payment_terms: str | None = None
    lead_time_days: int | None = None
    tax_id: str | None = None
    bank_account: str | None = None
    is_active: bool = True
    notes: str | None = None


class SupplierCreate(ORMModel):
    organization_id: int
    code: str
    name: str
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    category: str | None = None
    payment_terms: str | None = None
    lead_time_days: int | None = None
    tax_id: str | None = None
    bank_account: str | None = None
    is_active: bool = True
    notes: str | None = None


class SupplierUpdate(ORMModel):
    code: str | None = None
    name: str | None = None
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    category: str | None = None
    payment_terms: str | None = None
    lead_time_days: int | None = None
    tax_id: str | None = None
    bank_account: str | None = None
    is_active: bool | None = None
    notes: str | None = None


# ── RFQ ────────────────────────────────────────────────────────────────
class RfqLineOut(ORMModel):
    id: int
    rfq_id: int
    stock_item_id: int
    quantity: float
    target_unit_cost: float | None = None
    notes: str | None = None


class RfqLineCreate(ORMModel):
    stock_item_id: int
    quantity: float
    target_unit_cost: float | None = None
    notes: str | None = None


class RfqOut(TimestampedOut):
    id: int
    organization_id: int
    rfq_number: str
    title: str
    status: str = "draft"
    due_date: dt_date | None = None
    currency: str = "USD"
    notes: str | None = None
    created_by: int | None = None
    issued_at: datetime | None = None
    closed_at: datetime | None = None
    cancelled_at: datetime | None = None
    lines: list[RfqLineOut] = []
    quote_count: int = 0


class RfqCreate(ORMModel):
    organization_id: int
    rfq_number: str
    title: str
    due_date: dt_date | None = None
    currency: str = "USD"
    notes: str | None = None
    lines: list[RfqLineCreate] = []


class RfqUpdate(ORMModel):
    title: str | None = None
    due_date: dt_date | None = None
    currency: str | None = None
    notes: str | None = None


# ── Supplier Quote ─────────────────────────────────────────────────────
class SupplierQuoteLineOut(ORMModel):
    id: int
    quote_id: int
    rfq_line_id: int
    quantity: float
    unit_cost: float
    line_total: float
    notes: str | None = None
    # Convenience: does this quote exceed the RFQ line's target unit cost?
    over_target: bool = False


class SupplierQuoteLineCreate(ORMModel):
    rfq_line_id: int
    quantity: float
    unit_cost: float
    notes: str | None = None


class SupplierQuoteOut(TimestampedOut):
    id: int
    organization_id: int
    rfq_id: int
    supplier_id: int
    supplier_name: str | None = None
    status: str = "received"
    currency: str = "USD"
    subtotal: float
    tax_amount: float
    total_amount: float
    lead_time_days: int | None = None
    valid_until: dt_date | None = None
    notes: str | None = None
    received_at: datetime
    purchase_order_id: int | None = None
    decided_at: datetime | None = None
    lines: list[SupplierQuoteLineOut] = []


class SupplierQuoteCreate(ORMModel):
    organization_id: int
    rfq_id: int
    supplier_id: int
    tax_amount: float = 0
    lead_time_days: int | None = None
    valid_until: dt_date | None = None
    notes: str | None = None
    lines: list[SupplierQuoteLineCreate] = []


# ── Purchase Order Approval ────────────────────────────────────────────
class PurchaseOrderApprovalOut(ORMModel):
    id: int
    purchase_order_id: int
    sequence: int
    approver_id: int
    approver_name: str | None = None
    status: str = "pending"
    decided_at: datetime | None = None
    comments: str | None = None
    created_at: datetime


class ApprovalChainCreate(ORMModel):
    # Ordered list of approver user ids. Position in the list is the
    # sequence, so the chain is decided in ascending order.
    approver_ids: list[int] = []


class ApprovalDecision(ORMModel):
    comments: str | None = None
