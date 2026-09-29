"""Procurement service: suppliers, requests for quotation (RFQ), supplier
quotes, and the multi-level purchase order approval chain.

The RFQ flow is: draft -> issued -> closed. While issued, any number of
suppliers may submit a quote. Accepting one quote closes the RFQ and
automatically rejects the competing quotes, so exactly one supplier can win
an RFQ. An accepted quote can then be converted into a draft purchase
order, which is the hand-off point into the Phase 8 inventory module.
"""
from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.errors import problem
from app.models.core import User
from app.models.inventory import PurchaseOrder, PurchaseOrderLine, StockItem, Warehouse
from app.models.procurement import (
    PurchaseOrderApproval,
    Rfq,
    RfqLine,
    Supplier,
    SupplierQuote,
    SupplierQuoteLine,
)
from app.schemas.procurement import PurchaseOrderApprovalOut
from app.services import inventory_service

_EPS = Decimal("0.000001")


def to_dec(value: float | int | Decimal | None) -> Decimal:
    if value is None:
        return Decimal(0)
    return Decimal(str(value))


# ── Suppliers ──────────────────────────────────────────────────────────
def list_suppliers(
    db: Session,
    *,
    search: str | None = None,
    organization_id: int | None = None,
    category: str | None = None,
    is_active: bool | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Supplier], int]:
    stmt = select(Supplier)
    count_stmt = select(func.count(Supplier.id))
    if search:
        like = f"%{search}%"
        cond = (
            Supplier.name.ilike(like)
            | Supplier.code.ilike(like)
            | Supplier.contact_name.ilike(like)
            | Supplier.email.ilike(like)
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(Supplier.organization_id == organization_id)
        count_stmt = count_stmt.where(Supplier.organization_id == organization_id)
    if category:
        stmt = stmt.where(Supplier.category == category)
        count_stmt = count_stmt.where(Supplier.category == category)
    if is_active is not None:
        stmt = stmt.where(Supplier.is_active == is_active)
        count_stmt = count_stmt.where(Supplier.is_active == is_active)
    stmt = stmt.order_by(Supplier.id)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_supplier(db: Session, supplier_id: int) -> Supplier | None:
    return db.get(Supplier, supplier_id)


def create_supplier(
    db: Session, payload: dict, *, user_id: int | None = None
) -> Supplier:
    if db.scalar(
        select(Supplier).where(
            Supplier.organization_id == payload["organization_id"],
            Supplier.code == payload["code"],
        )
    ):
        raise problem(409, "Conflict", "Supplier code already exists for this organization.")
    s = Supplier(**payload)
    db.add(s)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="supplier.create",
        entity_type="supplier",
        entity_id=str(s.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(s)
    return s


def update_supplier(
    db: Session, s: Supplier, payload: dict, *, user_id: int | None = None
) -> Supplier:
    prev = {k: getattr(s, k) for k in payload if hasattr(s, k)}
    for k, v in payload.items():
        setattr(s, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="supplier.update",
        entity_type="supplier",
        entity_id=str(s.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(s)
    return s


def delete_supplier(db: Session, s: Supplier, *, user_id: int | None = None) -> None:
    if db.scalar(
        select(func.count(SupplierQuote.id)).where(SupplierQuote.supplier_id == s.id)
    ):
        raise problem(409, "Conflict", "Supplier has quotes and cannot be deleted.")
    write_audit(
        db,
        user_id=user_id,
        action="supplier.delete",
        entity_type="supplier",
        entity_id=str(s.id),
    )
    db.delete(s)
    db.commit()


# ── RFQ ────────────────────────────────────────────────────────────────
def rfq_lines(db: Session, rfq_id: int) -> list[RfqLine]:
    return list(db.scalars(select(RfqLine).where(RfqLine.rfq_id == rfq_id)).all())


def rfq_out(db: Session, rfq: Rfq) -> dict:
    lines = rfq_lines(db, rfq.id)
    quote_count = (
        db.scalar(
            select(func.count(SupplierQuote.id)).where(SupplierQuote.rfq_id == rfq.id)
        )
        or 0
    )
    return {
        "id": rfq.id,
        "organization_id": rfq.organization_id,
        "rfq_number": rfq.rfq_number,
        "title": rfq.title,
        "status": rfq.status,
        "due_date": rfq.due_date,
        "currency": rfq.currency,
        "notes": rfq.notes,
        "created_by": rfq.created_by,
        "issued_at": rfq.issued_at,
        "closed_at": rfq.closed_at,
        "cancelled_at": rfq.cancelled_at,
        "created_at": rfq.created_at,
        "updated_at": rfq.updated_at,
        "lines": lines,
        "quote_count": quote_count,
    }


def list_rfqs(
    db: Session,
    *,
    search: str | None = None,
    organization_id: int | None = None,
    status: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Rfq], int]:
    stmt = select(Rfq)
    count_stmt = select(func.count(Rfq.id))
    if search:
        like = f"%{search}%"
        cond = Rfq.rfq_number.ilike(like) | Rfq.title.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(Rfq.organization_id == organization_id)
        count_stmt = count_stmt.where(Rfq.organization_id == organization_id)
    if status:
        stmt = stmt.where(Rfq.status == status)
        count_stmt = count_stmt.where(Rfq.status == status)
    stmt = stmt.order_by(Rfq.id.desc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_rfq(db: Session, rfq_id: int) -> Rfq | None:
    return db.get(Rfq, rfq_id)


def getrfq_out(db: Session, rfq_id: int) -> dict | None:
    rfq = get_rfq(db, rfq_id)
    return rfq_out(db, rfq) if rfq else None


def create_rfq(db: Session, payload: dict, *, user_id: int | None = None) -> dict:
    if db.scalar(select(Rfq).where(Rfq.rfq_number == payload["rfq_number"])):
        raise problem(409, "Conflict", "RFQ number already exists.")
    lines = payload.pop("lines", []) or []
    if not lines:
        raise problem(400, "Bad Request", "An RFQ needs at least one line.")
    for line in lines:
        if not db.get(StockItem, line["stock_item_id"]):
            raise problem(404, "Not Found", f"Stock item {line['stock_item_id']} not found.")
        if to_dec(line["quantity"]) <= _EPS:
            raise problem(400, "Bad Request", "Line quantity must be greater than zero.")
    rfq = Rfq(**payload, created_by=user_id)
    for line in lines:
        rfq.lines.append(
            RfqLine(
                stock_item_id=line["stock_item_id"],
                quantity=to_dec(line["quantity"]),
                target_unit_cost=(
                    to_dec(line["target_unit_cost"])
                    if line.get("target_unit_cost") is not None
                    else None
                ),
                notes=line.get("notes"),
            )
        )
    db.add(rfq)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="rfq.create",
        entity_type="rfq",
        entity_id=str(rfq.id),
        new_value={"rfq_number": rfq.rfq_number, "title": rfq.title},
    )
    db.commit()
    db.refresh(rfq)
    return rfq_out(db, rfq)


def update_rfq(db: Session, rfq: Rfq, payload: dict, *, user_id: int | None = None) -> dict:
    if rfq.status != "draft":
        raise problem(409, "Conflict", "Only draft RFQs can be edited.")
    prev = {k: getattr(rfq, k) for k in payload if hasattr(rfq, k)}
    for k, v in payload.items():
        setattr(rfq, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="rfq.update",
        entity_type="rfq",
        entity_id=str(rfq.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(rfq)
    return rfq_out(db, rfq)


def add_rfq_line(
    db: Session, rfq: Rfq, payload: dict, *, user_id: int | None = None
) -> RfqLine:
    if rfq.status != "draft":
        raise problem(409, "Conflict", "Only draft RFQs can be edited.")
    if not db.get(StockItem, payload["stock_item_id"]):
        raise problem(404, "Not Found", "Stock item not found.")
    if to_dec(payload["quantity"]) <= _EPS:
        raise problem(400, "Bad Request", "Quantity must be greater than zero.")
    line = RfqLine(
        rfq_id=rfq.id,
        stock_item_id=payload["stock_item_id"],
        quantity=to_dec(payload["quantity"]),
        target_unit_cost=(
            to_dec(payload["target_unit_cost"])
            if payload.get("target_unit_cost") is not None
            else None
        ),
        notes=payload.get("notes"),
    )
    rfq.lines.append(line)
    db.flush()
    db.commit()
    return line


def delete_rfq_line(
    db: Session, rfq: Rfq, line: RfqLine, *, user_id: int | None = None
) -> None:
    if rfq.status != "draft":
        raise problem(409, "Conflict", "Only draft RFQs can be edited.")
    rfq.lines.remove(line)
    db.delete(line)
    db.flush()
    db.commit()


def issue_rfq(db: Session, rfq: Rfq, *, user_id: int | None = None) -> dict:
    if rfq.status != "draft":
        raise problem(409, "Conflict", f"RFQ is {rfq.status}, not draft.")
    if not rfq_lines(db, rfq.id):
        raise problem(400, "Bad Request", "Cannot issue an RFQ with no lines.")
    rfq.status = "issued"
    rfq.issued_at = datetime.now(UTC)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="rfq.issue",
        entity_type="rfq",
        entity_id=str(rfq.id),
        new_value={"status": rfq.status},
    )
    db.commit()
    db.refresh(rfq)
    return rfq_out(db, rfq)


def cancel_rfq(db: Session, rfq: Rfq, *, user_id: int | None = None) -> dict:
    if rfq.status not in {"draft", "issued"}:
        raise problem(409, "Conflict", f"Cannot cancel a {rfq.status} RFQ.")
    rfq.status = "cancelled"
    rfq.cancelled_at = datetime.now(UTC)
    db.flush()
    for q in db.scalars(
        select(SupplierQuote).where(
            SupplierQuote.rfq_id == rfq.id, SupplierQuote.status == "received"
        )
    ).all():
        q.status = "rejected"
        q.decided_at = datetime.now(UTC)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="rfq.cancel",
        entity_type="rfq",
        entity_id=str(rfq.id),
        new_value={"status": rfq.status},
    )
    db.commit()
    db.refresh(rfq)
    return rfq_out(db, rfq)


# ── Supplier Quotes ────────────────────────────────────────────────────
def quote_out(db: Session, quote: SupplierQuote) -> dict:
    supplier = db.get(Supplier, quote.supplier_id)
    lines = list(
        db.scalars(
            select(SupplierQuoteLine)
            .where(SupplierQuoteLine.quote_id == quote.id)
            .order_by(SupplierQuoteLine.id)
        ).all()
    )
    out_lines = []
    for line in lines:
        rfq_line = db.get(RfqLine, line.rfq_line_id)
        target = (
            to_dec(rfq_line.target_unit_cost)
            if rfq_line and rfq_line.target_unit_cost is not None
            else None
        )
        out_lines.append(
            {
                "id": line.id,
                "quote_id": line.quote_id,
                "rfq_line_id": line.rfq_line_id,
                "quantity": float(to_dec(line.quantity)),
                "unit_cost": float(to_dec(line.unit_cost)),
                "line_total": float(to_dec(line.line_total)),
                "notes": line.notes,
                "over_target": bool(
                    target is not None and to_dec(line.unit_cost) > target + _EPS
                ),
            }
        )
    return {
        "id": quote.id,
        "organization_id": quote.organization_id,
        "rfq_id": quote.rfq_id,
        "supplier_id": quote.supplier_id,
        "supplier_name": supplier.name if supplier else None,
        "status": quote.status,
        "currency": quote.currency,
        "subtotal": float(to_dec(quote.subtotal)),
        "tax_amount": float(to_dec(quote.tax_amount)),
        "total_amount": float(to_dec(quote.total_amount)),
        "lead_time_days": quote.lead_time_days,
        "valid_until": quote.valid_until,
        "notes": quote.notes,
        "received_at": quote.received_at,
        "purchase_order_id": quote.purchase_order_id,
        "decided_at": quote.decided_at,
        "created_at": quote.created_at,
        "updated_at": quote.updated_at,
        "lines": out_lines,
    }


def list_quotes(
    db: Session,
    *,
    rfq_id: int | None = None,
    supplier_id: int | None = None,
    organization_id: int | None = None,
    status: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[SupplierQuote], int]:
    stmt = select(SupplierQuote)
    count_stmt = select(func.count(SupplierQuote.id))
    if rfq_id is not None:
        stmt = stmt.where(SupplierQuote.rfq_id == rfq_id)
        count_stmt = count_stmt.where(SupplierQuote.rfq_id == rfq_id)
    if supplier_id is not None:
        stmt = stmt.where(SupplierQuote.supplier_id == supplier_id)
        count_stmt = count_stmt.where(SupplierQuote.supplier_id == supplier_id)
    if organization_id is not None:
        stmt = stmt.where(SupplierQuote.organization_id == organization_id)
        count_stmt = count_stmt.where(SupplierQuote.organization_id == organization_id)
    if status:
        stmt = stmt.where(SupplierQuote.status == status)
        count_stmt = count_stmt.where(SupplierQuote.status == status)
    stmt = stmt.order_by(SupplierQuote.total_amount.asc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_quote(db: Session, quote_id: int) -> SupplierQuote | None:
    return db.get(SupplierQuote, quote_id)


def getquote_out(db: Session, quote_id: int) -> dict | None:
    q = get_quote(db, quote_id)
    return quote_out(db, q) if q else None


def create_quote(
    db: Session, payload: dict, *, user_id: int | None = None
) -> dict:
    rfq = db.get(Rfq, payload["rfq_id"])
    if not rfq:
        raise problem(404, "Not Found", "RFQ not found.")
    if rfq.status != "issued":
        raise problem(409, "Conflict", "Quotes can only be recorded against an issued RFQ.")
    supplier = db.get(Supplier, payload["supplier_id"])
    if not supplier:
        raise problem(404, "Not Found", "Supplier not found.")
    if not supplier.is_active:
        raise problem(409, "Conflict", "Supplier is inactive.")
    if db.scalar(
        select(SupplierQuote).where(
            SupplierQuote.rfq_id == rfq.id, SupplierQuote.supplier_id == supplier.id
        )
    ):
        raise problem(409, "Conflict", "This supplier has already quoted this RFQ.")

    rfq_line_map = {line.id: line for line in rfq_lines(db, rfq.id)}
    lines = payload.pop("lines", []) or []
    if not lines:
        raise problem(400, "Bad Request", "A quote needs at least one line.")
    for line in lines:
        if line["rfq_line_id"] not in rfq_line_map:
            raise problem(
                400, "Bad Request", f"Line {line['rfq_line_id']} is not on this RFQ."
            )
        if to_dec(line["unit_cost"]) < 0:
            raise problem(400, "Bad Request", "Unit cost cannot be negative.")

    # the RFQ is the source of truth for the quote's currency and owner
    payload["rfq_id"] = rfq.id
    payload["currency"] = rfq.currency
    quote = SupplierQuote(**payload)
    for line in lines:
        quote.lines.append(
            SupplierQuoteLine(
                rfq_line_id=line["rfq_line_id"],
                quantity=to_dec(line["quantity"]),
                unit_cost=to_dec(line["unit_cost"]),
                line_total=to_dec(line["quantity"]) * to_dec(line["unit_cost"]),
            )
        )
    db.add(quote)
    db.flush()
    recalc_quote(db, quote)
    write_audit(
        db,
        user_id=user_id,
        action="supplier_quote.create",
        entity_type="supplier_quote",
        entity_id=str(quote.id),
        new_value={
            "rfq_id": rfq.id,
            "supplier_id": supplier.id,
            "total_amount": float(to_dec(quote.total_amount)),
        },
    )
    db.commit()
    db.refresh(quote)
    return quote_out(db, quote)


def recalc_quote(db: Session, quote: SupplierQuote) -> None:
    lines = list(
        db.scalars(
            select(SupplierQuoteLine).where(SupplierQuoteLine.quote_id == quote.id)
        ).all()
    )
    for line in lines:
        line.line_total = to_dec(line.quantity) * to_dec(line.unit_cost)
    subtotal = sum((to_dec(line.line_total) for line in lines), Decimal(0))
    quote.subtotal = subtotal
    quote.total_amount = subtotal + to_dec(quote.tax_amount)
    db.flush()


def accept_quote(db: Session, quote: SupplierQuote, *, user_id: int | None = None) -> dict:
    if quote.status != "received":
        raise problem(409, "Conflict", f"Quote is already {quote.status}.")
    rfq = db.get(Rfq, quote.rfq_id)
    if not rfq or rfq.status != "issued":
        raise problem(409, "Conflict", "RFQ is not open for quote selection.")
    now = datetime.now(UTC)
    quote.status = "accepted"
    quote.decided_at = now
    # Exactly one supplier may win an RFQ.
    rejected = 0
    for other in db.scalars(
        select(SupplierQuote).where(
            SupplierQuote.rfq_id == rfq.id,
            SupplierQuote.id != quote.id,
            SupplierQuote.status == "received",
        )
    ).all():
        other.status = "rejected"
        other.decided_at = now
        rejected += 1
    rfq.status = "closed"
    rfq.closed_at = now
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="supplier_quote.accept",
        entity_type="supplier_quote",
        entity_id=str(quote.id),
        new_value={
            "accepted_quote_id": quote.id,
            "supplier_id": quote.supplier_id,
            "rejected_count": rejected,
        },
    )
    db.commit()
    db.refresh(quote)
    return quote_out(db, quote)


def reject_quote(db: Session, quote: SupplierQuote, *, user_id: int | None = None) -> dict:
    if quote.status != "received":
        raise problem(409, "Conflict", f"Quote is already {quote.status}.")
    quote.status = "rejected"
    quote.decided_at = datetime.now(UTC)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="supplier_quote.reject",
        entity_type="supplier_quote",
        entity_id=str(quote.id),
        new_value={"status": quote.status},
    )
    db.commit()
    db.refresh(quote)
    return quote_out(db, quote)


def convert_quote_to_po(
    db: Session, quote: SupplierQuote, warehouse_id: int, *, user_id: int | None = None
) -> PurchaseOrder:
    if quote.status != "accepted":
        raise problem(409, "Conflict", "Only an accepted quote can become a purchase order.")
    if quote.purchase_order_id:
        raise problem(409, "Conflict", "This quote has already been converted to a PO.")
    warehouse = db.get(Warehouse, warehouse_id)
    if not warehouse:
        raise problem(404, "Not Found", "Warehouse not found.")
    rfq = db.get(Rfq, quote.rfq_id)
    if not rfq:
        raise problem(404, "Not Found", "RFQ not found.")
    supplier = db.get(Supplier, quote.supplier_id)
    if not supplier:
        raise problem(404, "Not Found", "Supplier not found.")

    lines = list(
        db.scalars(
            select(SupplierQuoteLine)
            .where(SupplierQuoteLine.quote_id == quote.id)
            .order_by(SupplierQuoteLine.id)
        ).all()
    )
    if not lines:
        raise problem(400, "Bad Request", "Quote has no lines to convert.")

    po_number = f"PO-{rfq.rfq_number}"
    if db.scalar(select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)):
        raise problem(409, "Conflict", f"Purchase order {po_number} already exists.")

    po = PurchaseOrder(
        organization_id=quote.organization_id,
        po_number=po_number,
        supplier_name=supplier.name,
        supplier_contact=supplier.contact_name,
        supplier_email=supplier.email,
        status="draft",
        warehouse_id=warehouse.id,
        currency=quote.currency,
        tax_amount=quote.tax_amount,
        notes=f"Converted from RFQ {rfq.rfq_number} / quote #{quote.id}",
        created_by=user_id,
    )
    for line in lines:
        rfq_line = db.get(RfqLine, line.rfq_line_id)
        if not rfq_line:
            continue
        po.lines.append(
            PurchaseOrderLine(
                item_id=rfq_line.stock_item_id,
                quantity=to_dec(line.quantity),
                unit_cost=to_dec(line.unit_cost),
            )
        )
    db.add(po)
    db.flush()
    # Derive subtotal/total from the converted lines rather than trusting the
    # quote, so the PO is internally consistent.
    inventory_service.recalc_purchase_order_totals(db, po)
    quote.purchase_order_id = po.id
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="supplier_quote.convert_to_po",
        entity_type="supplier_quote",
        entity_id=str(quote.id),
        new_value={"quote_id": quote.id, "purchase_order_id": po.id},
    )
    db.commit()
    db.refresh(po)
    return po


# ── Purchase Order approval chain ──────────────────────────────────────
def list_approvals(db: Session, purchase_order_id: int) -> list[PurchaseOrderApprovalOut]:
    rows = list(
        db.scalars(
            select(PurchaseOrderApproval)
            .where(PurchaseOrderApproval.purchase_order_id == purchase_order_id)
            .order_by(PurchaseOrderApproval.sequence)
        ).all()
    )
    out: list[PurchaseOrderApprovalOut] = []
    for row in rows:
        approver = db.get(User, row.approver_id)
        out.append(
            PurchaseOrderApprovalOut(
                id=row.id,
                purchase_order_id=row.purchase_order_id,
                sequence=row.sequence,
                approver_id=row.approver_id,
                approver_name=approver.full_name if approver else None,
                status=row.status,
                decided_at=row.decided_at,
                comments=row.comments,
                created_at=row.created_at,
            )
        )
    return out


def build_approval_chain(
    db: Session, po: PurchaseOrder, approver_ids: list[int], *, user_id: int | None = None
) -> list[PurchaseOrderApprovalOut]:
    if po.status != "draft":
        raise problem(
            409, "Conflict", f"Only draft purchase orders can be submitted (is {po.status})."
        )
    if not approver_ids:
        raise problem(400, "Bad Request", "At least one approver is required.")
    existing = list_approvals(db, po.id)
    if existing:
        raise problem(409, "Conflict", "An approval chain already exists for this PO.")
    seen: set[int] = set()
    for i, approver_id in enumerate(approver_ids, start=1):
        if approver_id in seen:
            raise problem(
                400, "Bad Request", f"Approver {approver_id} appears twice in the chain."
            )
        seen.add(approver_id)
        if not db.get(User, approver_id):
            raise problem(404, "Not Found", f"Approver user {approver_id} not found.")
        db.add(
            PurchaseOrderApproval(
                purchase_order_id=po.id, sequence=i, approver_id=approver_id
            )
        )
    po.status = "pending_approval"
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="purchase_order.submit_approval",
        entity_type="purchase_order",
        entity_id=str(po.id),
        new_value={"status": po.status, "chain": approver_ids},
    )
    db.commit()
    return list_approvals(db, po.id)


def decide_approval(
    db: Session,
    po: PurchaseOrder,
    sequence: int,
    approve: bool,
    *,
    user: User,
    comments: str | None = None,
) -> list[PurchaseOrderApprovalOut]:
    if po.status != "pending_approval":
        raise problem(
            409, "Conflict", f"Purchase order is {po.status}, not pending approval."
        )
    row = db.scalar(
        select(PurchaseOrderApproval).where(
            PurchaseOrderApproval.purchase_order_id == po.id,
            PurchaseOrderApproval.sequence == sequence,
        )
    )
    if not row:
        raise problem(404, "Not Found", f"Approval level {sequence} not found.")
    if row.status != "pending":
        raise problem(409, "Conflict", f"Approval level {sequence} is already {row.status}.")
    if row.approver_id != user.id and not user.is_superuser:
        raise problem(403, "Forbidden", "You are not the assigned approver for this level.")
    # Levels must be decided in ascending order.
    earlier_pending = db.scalar(
        select(func.count(PurchaseOrderApproval.id)).where(
            PurchaseOrderApproval.purchase_order_id == po.id,
            PurchaseOrderApproval.sequence < sequence,
            PurchaseOrderApproval.status == "pending",
        )
    )
    if earlier_pending:
        raise problem(
            409, "Conflict", "An earlier approval level is still pending."
        )

    row.status = "approved" if approve else "rejected"
    row.decided_at = datetime.now(UTC)
    row.comments = comments
    # Flush before counting remaining levels: sessions may run with
    # autoflush disabled, so the count must see this decision.
    db.flush()
    if not approve:
        # Send it back for revision; the chain is rebuilt on resubmission.
        po.status = "draft"
        db.flush()
        write_audit(
            db,
            user_id=user.id,
            action="purchase_order.approval_rejected",
            entity_type="purchase_order",
            entity_id=str(po.id),
            new_value={"sequence": sequence, "comments": comments},
        )
        db.commit()
        return list_approvals(db, po.id)

    remaining = db.scalar(
        select(func.count(PurchaseOrderApproval.id)).where(
            PurchaseOrderApproval.purchase_order_id == po.id,
            PurchaseOrderApproval.status == "pending",
        )
    )
    if not remaining:
        po.status = "approved"
        po.approved_by = user.id
        po.approved_at = datetime.now(UTC)
    db.flush()
    write_audit(
        db,
        user_id=user.id,
        action="purchase_order.approvalto_decision",
        entity_type="purchase_order",
        entity_id=str(po.id),
        new_value={"sequence": sequence, "approved": approve, "status": po.status},
    )
    db.commit()
    return list_approvals(db, po.id)
