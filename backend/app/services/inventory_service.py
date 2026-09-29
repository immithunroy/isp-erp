"""Inventory service: warehouses, stock item catalog, stock levels, movements
(receipt / issue / adjustment / transfer) and purchase orders with a
receive-to-stock workflow.

Every quantity change is driven through `stock_movements`, which is append-only
and records the resulting `balance_after`, so stock on hand is always
reproducible from the movement history. Movements may be linked to a network
asset, which is how field consumption of spares (OLTs, splice closures,
fiber, etc.) is attributed to the asset it was installed into.
"""
from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.audit import write_audit
from app.errors import problem
from app.models.core import User
from app.models.inventory import (
    PurchaseOrder,
    PurchaseOrderLine,
    StockItem,
    StockLevel,
    StockMovement,
    Warehouse,
)
from app.models.network import NetworkAsset
from app.schemas.inventory import LowStockItem, StockLevelOut

# movement_type values accepted from clients for single-warehouse movements
DIRECT_MOVEMENT_TYPES = {"receipt", "issue", "adjustment"}
PO_RECEIVABLE_STATUSES = {"approved", "partially_received"}
_EPS = Decimal("0.000001")


def _dec(value: float | int | Decimal | None) -> Decimal:
    if value is None:
        return Decimal(0)
    return Decimal(str(value))


# ── Warehouses ─────────────────────────────────────────────────────────
def list_warehouses(
    db: Session,
    *,
    search: str | None = None,
    organization_id: int | None = None,
    is_active: bool | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Warehouse], int]:
    stmt = select(Warehouse)
    count_stmt = select(func.count(Warehouse.id))
    if search:
        like = f"%{search}%"
        cond = Warehouse.name.ilike(like) | Warehouse.code.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(Warehouse.organization_id == organization_id)
        count_stmt = count_stmt.where(Warehouse.organization_id == organization_id)
    if is_active is not None:
        stmt = stmt.where(Warehouse.is_active == is_active)
        count_stmt = count_stmt.where(Warehouse.is_active == is_active)
    stmt = stmt.order_by(Warehouse.id)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_warehouse(db: Session, warehouse_id: int) -> Warehouse | None:
    return db.get(Warehouse, warehouse_id)


def create_warehouse(
    db: Session, payload: dict, *, user_id: int | None = None
) -> Warehouse:
    if db.scalar(
        select(Warehouse).where(
            Warehouse.organization_id == payload["organization_id"],
            Warehouse.code == payload["code"],
        )
    ):
        raise problem(409, "Conflict", "Warehouse code already exists for this organization.")
    w = Warehouse(**payload)
    db.add(w)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="warehouse.create",
        entity_type="warehouse",
        entity_id=str(w.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(w)
    return w


def update_warehouse(
    db: Session, w: Warehouse, payload: dict, *, user_id: int | None = None
) -> Warehouse:
    prev = {k: getattr(w, k) for k in payload if hasattr(w, k)}
    for k, v in payload.items():
        setattr(w, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="warehouse.update",
        entity_type="warehouse",
        entity_id=str(w.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(w)
    return w


def delete_warehouse(
    db: Session, w: Warehouse, *, user_id: int | None = None
) -> None:
    if db.scalar(select(StockLevel).where(StockLevel.warehouse_id == w.id)):
        raise problem(409, "Conflict", "Warehouse still holds stock. Move or zero it first.")
    if db.scalar(select(PurchaseOrder).where(PurchaseOrder.warehouse_id == w.id)):
        raise problem(409, "Conflict", "Warehouse is referenced by purchase orders.")
    write_audit(
        db,
        user_id=user_id,
        action="warehouse.delete",
        entity_type="warehouse",
        entity_id=str(w.id),
    )
    db.delete(w)
    db.commit()


# ── Stock Items ────────────────────────────────────────────────────────
def list_items(
    db: Session,
    *,
    search: str | None = None,
    organization_id: int | None = None,
    category: str | None = None,
    asset_class: str | None = None,
    is_active: bool | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[StockItem], int]:
    stmt = select(StockItem)
    count_stmt = select(func.count(StockItem.id))
    if search:
        like = f"%{search}%"
        cond = (
            StockItem.name.ilike(like)
            | StockItem.sku.ilike(like)
            | StockItem.description.ilike(like)
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(StockItem.organization_id == organization_id)
        count_stmt = count_stmt.where(StockItem.organization_id == organization_id)
    if category:
        stmt = stmt.where(StockItem.category == category)
        count_stmt = count_stmt.where(StockItem.category == category)
    if asset_class:
        stmt = stmt.where(StockItem.asset_class == asset_class)
        count_stmt = count_stmt.where(StockItem.asset_class == asset_class)
    if is_active is not None:
        stmt = stmt.where(StockItem.is_active == is_active)
        count_stmt = count_stmt.where(StockItem.is_active == is_active)
    stmt = stmt.order_by(StockItem.id)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_item(db: Session, item_id: int) -> StockItem | None:
    return db.get(StockItem, item_id)


def create_item(db: Session, payload: dict, *, user_id: int | None = None) -> StockItem:
    if db.scalar(
        select(StockItem).where(
            StockItem.organization_id == payload["organization_id"],
            StockItem.sku == payload["sku"],
        )
    ):
        raise problem(409, "Conflict", "SKU already exists for this organization.")
    item = StockItem(**payload)
    db.add(item)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="stock_item.create",
        entity_type="stock_item",
        entity_id=str(item.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(item)
    return item


def update_item(
    db: Session, item: StockItem, payload: dict, *, user_id: int | None = None
) -> StockItem:
    prev = {k: getattr(item, k) for k in payload if hasattr(item, k)}
    for k, v in payload.items():
        setattr(item, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="stock_item.update",
        entity_type="stock_item",
        entity_id=str(item.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item: StockItem, *, user_id: int | None = None) -> None:
    if db.scalar(
        select(PurchaseOrderLine).where(PurchaseOrderLine.item_id == item.id)
    ):
        raise problem(409, "Conflict", "Item is referenced by purchase order lines.")
    write_audit(
        db,
        user_id=user_id,
        action="stock_item.delete",
        entity_type="stock_item",
        entity_id=str(item.id),
    )
    db.delete(item)
    db.commit()


# ── Stock Levels ───────────────────────────────────────────────────────
def get_or_create_level(db: Session, warehouse_id: int, item_id: int) -> StockLevel:
    level = db.scalar(
        select(StockLevel).where(
            StockLevel.warehouse_id == warehouse_id, StockLevel.item_id == item_id
        )
    )
    if level is None:
        level = StockLevel(warehouse_id=warehouse_id, item_id=item_id, quantity=0)
        db.add(level)
        db.flush()
    return level


def _level_out(level: StockLevel, item: StockItem) -> StockLevelOut:
    qty = _dec(level.quantity)
    reserved = _dec(level.reserved_quantity)
    reorder = _dec(item.reorder_level)
    return StockLevelOut(
        id=level.id,
        warehouse_id=level.warehouse_id,
        item_id=level.item_id,
        quantity=float(qty),
        reserved_quantity=float(reserved),
        available_quantity=float(qty - reserved),
        reorder_level=float(reorder),
        is_low=qty <= reorder,
        updated_at=level.updated_at,
    )


def list_levels(
    db: Session,
    *,
    organization_id: int | None = None,
    warehouse_id: int | None = None,
    item_id: int | None = None,
    category: str | None = None,
    low_only: bool = False,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[StockLevelOut], int]:
    stmt = (
        select(StockLevel, StockItem)
        .join(StockItem, StockItem.id == StockLevel.item_id)
        .where(StockItem.is_active.is_(True))
    )
    if organization_id is not None:
        stmt = stmt.where(StockItem.organization_id == organization_id)
    if warehouse_id is not None:
        stmt = stmt.where(StockLevel.warehouse_id == warehouse_id)
    if item_id is not None:
        stmt = stmt.where(StockLevel.item_id == item_id)
    if category:
        stmt = stmt.where(StockItem.category == category)
    rows = list(db.execute(stmt.order_by(StockLevel.id)).all())
    outs = [_level_out(level, item) for level, item in rows]
    if low_only:
        outs = [o for o in outs if o.is_low]
    total = len(outs)
    return outs[offset : offset + limit], total


def get_level_out(db: Session, level_id: int) -> StockLevelOut | None:
    level = db.get(StockLevel, level_id)
    if not level:
        return None
    item = db.get(StockItem, level.item_id)
    if not item:
        return None
    return _level_out(level, item)


def low_stock_items(
    db: Session, *, organization_id: int | None = None
) -> list[LowStockItem]:
    out: list[LowStockItem] = []
    rows, _ = list_levels(
        db, organization_id=organization_id, low_only=True, offset=0, limit=200_000
    )
    for o in rows:
        item = db.get(StockItem, o.item_id)
        if not item:
            continue
        out.append(
            LowStockItem(
                warehouse_id=o.warehouse_id,
                item_id=o.item_id,
                sku=item.sku,
                item_name=item.name,
                unit=item.unit,
                quantity=o.quantity,
                reorder_level=o.reorder_level,
                shortfall=max(0.0, round(o.reorder_level - o.quantity, 3)),
            )
        )
    return out


# ── Stock Movements ────────────────────────────────────────────────────
def list_movements(
    db: Session,
    *,
    organization_id: int | None = None,
    item_id: int | None = None,
    warehouse_id: int | None = None,
    movement_type: str | None = None,
    network_asset_id: int | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[StockMovement], int]:
    stmt = select(StockMovement)
    count_stmt = select(func.count(StockMovement.id))
    if organization_id is not None:
        stmt = stmt.where(StockMovement.organization_id == organization_id)
        count_stmt = count_stmt.where(StockMovement.organization_id == organization_id)
    if item_id is not None:
        stmt = stmt.where(StockMovement.item_id == item_id)
        count_stmt = count_stmt.where(StockMovement.item_id == item_id)
    if warehouse_id is not None:
        stmt = stmt.where(StockMovement.warehouse_id == warehouse_id)
        count_stmt = count_stmt.where(StockMovement.warehouse_id == warehouse_id)
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type == movement_type)
        count_stmt = count_stmt.where(StockMovement.movement_type == movement_type)
    if network_asset_id is not None:
        stmt = stmt.where(StockMovement.network_asset_id == network_asset_id)
        count_stmt = count_stmt.where(StockMovement.network_asset_id == network_asset_id)
    if reference_type:
        stmt = stmt.where(StockMovement.reference_type == reference_type)
        count_stmt = count_stmt.where(StockMovement.reference_type == reference_type)
    if reference_id is not None:
        stmt = stmt.where(StockMovement.reference_id == reference_id)
        count_stmt = count_stmt.where(StockMovement.reference_id == reference_id)
    stmt = stmt.order_by(StockMovement.moved_at.desc(), StockMovement.id.desc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_movement(db: Session, movement_id: int) -> StockMovement | None:
    return db.get(StockMovement, movement_id)


def _apply_delta(
    db: Session, warehouse_id: int, item_id: int, delta: Decimal
) -> StockLevel:
    level = get_or_create_level(db, warehouse_id, item_id)
    new_qty = _dec(level.quantity) + delta
    if new_qty < -_EPS:
        raise problem(
            409,
            "Insufficient Stock",
            "Movement would drive stock below zero at this warehouse.",
        )
    if new_qty < 0:
        new_qty = Decimal(0)
    level.quantity = new_qty
    db.flush()
    return level


def create_movement(
    db: Session, payload: dict, *, user_id: int | None = None
) -> StockMovement:
    movement_type = payload["movement_type"]
    if movement_type not in DIRECT_MOVEMENT_TYPES:
        raise problem(
            400,
            "Bad Request",
            "movement_type must be one of: receipt, issue, adjustment.",
        )
    item = db.get(StockItem, payload["item_id"])
    if not item:
        raise problem(404, "Not Found", "Stock item not found.")
    warehouse = db.get(Warehouse, payload["warehouse_id"])
    if not warehouse:
        raise problem(404, "Not Found", "Warehouse not found.")
    if not warehouse.is_active:
        raise problem(409, "Conflict", "Warehouse is inactive.")

    qty = _dec(payload["quantity"])
    if movement_type == "adjustment":
        if abs(qty) < _EPS:
            raise problem(400, "Bad Request", "Adjustment quantity must be non-zero.")
        delta = qty
    else:
        if qty <= _EPS:
            raise problem(400, "Bad Request", "Quantity must be greater than zero.")
        delta = qty if movement_type == "receipt" else -qty

    asset_id = payload.get("network_asset_id")
    if asset_id is not None and not db.get(NetworkAsset, asset_id):
        raise problem(404, "Not Found", "Network asset not found.")

    level = _apply_delta(db, warehouse.id, item.id, delta)
    mv = StockMovement(
        organization_id=payload["organization_id"],
        movement_type=movement_type,
        item_id=item.id,
        warehouse_id=warehouse.id,
        to_warehouse_id=None,
        quantity=abs(delta),
        signed_delta=delta,
        balance_after=_dec(level.quantity),
        network_asset_id=asset_id,
        work_order_id=payload.get("work_order_id"),
        reference_type="manual",
        reason=payload.get("reason"),
        created_by=user_id,
    )
    db.add(mv)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action=f"stock_movement.{movement_type}",
        entity_type="stock_movement",
        entity_id=str(mv.id),
        new_value={
            "item_id": item.id,
            "warehouse_id": warehouse.id,
            "delta": float(delta),
            "balance_after": float(_dec(level.quantity)),
        },
    )
    db.commit()
    db.refresh(mv)
    return mv


def transfer_stock(
    db: Session, payload: dict, *, user_id: int | None = None
) -> list[StockMovement]:
    from_id = payload["from_warehouse_id"]
    to_id = payload["to_warehouse_id"]
    if from_id == to_id:
        raise problem(400, "Bad Request", "Source and destination warehouses must differ.")
    item = db.get(StockItem, payload["item_id"])
    if not item:
        raise problem(404, "Not Found", "Stock item not found.")
    src = db.get(Warehouse, from_id)
    dst = db.get(Warehouse, to_id)
    if not src:
        raise problem(404, "Not Found", "Source warehouse not found.")
    if not dst:
        raise problem(404, "Not Found", "Destination warehouse not found.")
    if not src.is_active or not dst.is_active:
        raise problem(409, "Conflict", "Both warehouses must be active.")

    qty = _dec(payload["quantity"])
    if qty <= _EPS:
        raise problem(400, "Bad Request", "Quantity must be greater than zero.")

    out_level = _apply_delta(db, src.id, item.id, -qty)
    in_level = _apply_delta(db, dst.id, item.id, qty)
    now = datetime.now(UTC)
    common = {
        "organization_id": payload["organization_id"],
        "item_id": item.id,
        "reference_type": "manual",
        "reason": payload.get("reason"),
        "created_by": user_id,
        "moved_at": now,
    }
    out_mv = StockMovement(
        **common,
        movement_type="transfer_out",
        warehouse_id=src.id,
        to_warehouse_id=dst.id,
        quantity=qty,
        signed_delta=-qty,
        balance_after=_dec(out_level.quantity),
    )
    in_mv = StockMovement(
        **common,
        movement_type="transfer_in",
        warehouse_id=dst.id,
        to_warehouse_id=None,
        quantity=qty,
        signed_delta=qty,
        balance_after=_dec(in_level.quantity),
    )
    db.add_all([out_mv, in_mv])
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="stock_transfer",
        entity_type="stock_movement",
        entity_id=str(out_mv.id),
        new_value={
            "item_id": item.id,
            "from_warehouse_id": src.id,
            "to_warehouse_id": dst.id,
            "quantity": float(qty),
        },
    )
    db.commit()
    return [out_mv, in_mv]


# ── Purchase Orders ────────────────────────────────────────────────────
def recalc_purchase_order_totals(db: Session, po: PurchaseOrder) -> None:
    lines = list(po.lines)
    for line in lines:
        line.line_total = _dec(line.quantity) * _dec(line.unit_cost)
    subtotal = sum((_dec(line.line_total) for line in lines), Decimal(0))
    po.subtotal = subtotal
    po.total_amount = subtotal + _dec(po.tax_amount)
    db.flush()


def list_purchase_orders(
    db: Session,
    *,
    search: str | None = None,
    organization_id: int | None = None,
    status: str | None = None,
    warehouse_id: int | None = None,
    supplier_name: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[PurchaseOrder], int]:
    stmt = select(PurchaseOrder).options(
        selectinload(PurchaseOrder.lines).selectinload(PurchaseOrderLine.item),
    )
    count_stmt = select(func.count(PurchaseOrder.id))
    if search:
        like = f"%{search}%"
        cond = PurchaseOrder.po_number.ilike(like) | PurchaseOrder.supplier_name.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(PurchaseOrder.organization_id == organization_id)
        count_stmt = count_stmt.where(PurchaseOrder.organization_id == organization_id)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
        count_stmt = count_stmt.where(PurchaseOrder.status == status)
    if warehouse_id is not None:
        stmt = stmt.where(PurchaseOrder.warehouse_id == warehouse_id)
        count_stmt = count_stmt.where(PurchaseOrder.warehouse_id == warehouse_id)
    if supplier_name:
        cond = PurchaseOrder.supplier_name.ilike(f"%{supplier_name}%")
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    stmt = stmt.order_by(PurchaseOrder.id.desc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_purchase_order(db: Session, po_id: int) -> PurchaseOrder | None:
    return db.scalar(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines).selectinload(PurchaseOrderLine.item))
        .where(PurchaseOrder.id == po_id)
    )


def create_purchase_order(
    db: Session, payload: dict, *, user_id: int | None = None
) -> PurchaseOrder:
    if db.scalar(select(PurchaseOrder).where(PurchaseOrder.po_number == payload["po_number"])):
        raise problem(409, "Conflict", "PO number already exists.")
    if not db.get(Warehouse, payload["warehouse_id"]):
        raise problem(404, "Not Found", "Warehouse not found.")
    lines = payload.pop("lines", []) or []
    if not lines:
        raise problem(400, "Bad Request", "A purchase order needs at least one line.")
    for line in lines:
        if not db.get(StockItem, line["item_id"]):
            raise problem(404, "Not Found", f"Stock item {line['item_id']} not found.")
        if _dec(line["quantity"]) <= _EPS:
            raise problem(400, "Bad Request", "Line quantity must be greater than zero.")
    po = PurchaseOrder(**payload, created_by=user_id)
    for line in lines:
        po.lines.append(
            PurchaseOrderLine(
                item_id=line["item_id"],
                quantity=_dec(line["quantity"]),
                unit_cost=_dec(line.get("unit_cost")),
                notes=line.get("notes"),
            )
        )
    db.add(po)
    db.flush()
    recalc_purchase_order_totals(db, po)
    write_audit(
        db,
        user_id=user_id,
        action="purchase_order.create",
        entity_type="purchase_order",
        entity_id=str(po.id),
        new_value={"po_number": po.po_number, "supplier_name": po.supplier_name},
    )
    db.commit()
    db.refresh(po)
    return po


def update_purchase_order(
    db: Session, po: PurchaseOrder, payload: dict, *, user_id: int | None = None
) -> PurchaseOrder:
    if po.status != "draft":
        raise problem(
            409, "Conflict", "Only draft purchase orders can be edited."
        )
    if "warehouse_id" in payload and not db.get(Warehouse, payload["warehouse_id"]):
        raise problem(404, "Not Found", "Warehouse not found.")
    prev = {k: getattr(po, k) for k in payload if hasattr(po, k)}
    for k, v in payload.items():
        setattr(po, k, v)
    db.flush()
    recalc_purchase_order_totals(db, po)
    write_audit(
        db,
        user_id=user_id,
        action="purchase_order.update",
        entity_type="purchase_order",
        entity_id=str(po.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(po)
    return po


def add_po_line(
    db: Session, po: PurchaseOrder, payload: dict, *, user_id: int | None = None
) -> PurchaseOrderLine:
    if po.status != "draft":
        raise problem(409, "Conflict", "Only draft purchase orders can be edited.")
    if not db.get(StockItem, payload["item_id"]):
        raise problem(404, "Not Found", "Stock item not found.")
    if _dec(payload["quantity"]) <= _EPS:
        raise problem(400, "Bad Request", "Quantity must be greater than zero.")
    line = PurchaseOrderLine(
        item_id=payload["item_id"],
        quantity=_dec(payload["quantity"]),
        unit_cost=_dec(payload.get("unit_cost")),
        notes=payload.get("notes"),
    )
    po.lines.append(line)
    db.flush()
    recalc_purchase_order_totals(db, po)
    db.commit()
    return line


def delete_po_line(
    db: Session, po: PurchaseOrder, line: PurchaseOrderLine, *, user_id: int | None = None
) -> None:
    if po.status != "draft":
        raise problem(409, "Conflict", "Only draft purchase orders can be edited.")
    # Remove from the collection first, otherwise the still-loaded line is
    # included in the totals recalculation below.
    po.lines.remove(line)
    db.delete(line)
    db.flush()
    recalc_purchase_order_totals(db, po)
    db.commit()


def cancel_purchase_order(
    db: Session, po: PurchaseOrder, *, user: User
) -> PurchaseOrder:
    if po.status not in {"draft", "pending_approval", "approved"}:
        raise problem(409, "Conflict", f"Cannot cancel a {po.status} purchase order.")
    po.status = "cancelled"
    po.cancelled_at = datetime.now(UTC)
    db.flush()
    write_audit(
        db,
        user_id=user.id,
        action="purchase_order.cancel",
        entity_type="purchase_order",
        entity_id=str(po.id),
        new_value={"status": po.status},
    )
    db.commit()
    db.refresh(po)
    return po


def receive_purchase_order(
    db: Session, po: PurchaseOrder, payload: dict, *, user_id: int | None = None
) -> PurchaseOrder:
    if po.status not in PO_RECEIVABLE_STATUSES:
        raise problem(
            409,
            "Conflict",
            f"Purchase order must be approved to receive stock (is {po.status}).",
        )
    receipts = payload.get("lines") or []
    if not receipts:
        raise problem(400, "Bad Request", "No lines supplied to receive.")
    by_id = {line.id: line for line in po.lines}
    for entry in receipts:
        line = by_id.get(entry["line_id"])
        if line is None:
            raise problem(
                404, "Not Found", f"Line {entry['line_id']} not on this purchase order."
            )
        qty = _dec(entry["quantity"])
        if qty <= _EPS:
            raise problem(400, "Bad Request", "Received quantity must be greater than zero.")
        outstanding = _dec(line.quantity) - _dec(line.received_quantity)
        if qty - outstanding > _EPS:
            raise problem(
                400,
                "Bad Request",
                f"Received quantity for line {line.id} exceeds the outstanding "
                f"{float(outstanding)}.",
            )

    for entry in receipts:
        line = by_id[entry["line_id"]]
        qty = _dec(entry["quantity"])
        line.received_quantity = _dec(line.received_quantity) + qty
        level = _apply_delta(db, po.warehouse_id, line.item_id, qty)
        mv = StockMovement(
            organization_id=po.organization_id,
            movement_type="receipt",
            item_id=line.item_id,
            warehouse_id=po.warehouse_id,
            to_warehouse_id=None,
            quantity=qty,
            signed_delta=qty,
            balance_after=_dec(level.quantity),
            reference_type="purchase_order",
            reference_id=po.id,
            reason=f"Goods receipt for {po.po_number}",
            created_by=user_id,
        )
        db.add(mv)

    db.flush()
    fully_received = all(
        _dec(line.received_quantity) >= _dec(line.quantity) - _EPS for line in po.lines
    )
    if fully_received:
        po.status = "received"
        po.received_at = datetime.now(UTC)
    else:
        po.status = "partially_received"
    recalc_purchase_order_totals(db, po)
    write_audit(
        db,
        user_id=user_id,
        action="purchase_order.receive",
        entity_type="purchase_order",
        entity_id=str(po.id),
        new_value={
            "status": po.status,
            "lines": [
                {"line_id": e["line_id"], "quantity": float(_dec(e["quantity"]))}
                for e in receipts
            ],
        },
    )
    db.commit()
    db.refresh(po)
    return po


def delete_purchase_order(
    db: Session, po: PurchaseOrder, *, user_id: int | None = None
) -> None:
    if po.status not in {"draft", "cancelled"}:
        raise problem(
            409, "Conflict", "Only draft or cancelled purchase orders can be deleted."
        )
    write_audit(
        db,
        user_id=user_id,
        action="purchase_order.delete",
        entity_type="purchase_order",
        entity_id=str(po.id),
    )
    db.delete(po)
    db.commit()


# ── Summary ────────────────────────────────────────────────────────────
def inventory_summary(
    db: Session, *, organization_id: int | None = None
) -> dict[str, object]:
    item_q = select(func.count(StockItem.id))
    wh_q = select(func.count(Warehouse.id))
    wh_active_q = select(func.count(Warehouse.id)).where(Warehouse.is_active.is_(True))
    if organization_id is not None:
        item_q = item_q.where(StockItem.organization_id == organization_id)
        wh_q = wh_q.where(Warehouse.organization_id == organization_id)
        wh_active_q = wh_active_q.where(Warehouse.organization_id == organization_id)
    levels, _ = list_levels(
        db, organization_id=organization_id, offset=0, limit=200_000
    )
    total_qty = sum(_dec(o.quantity) for o in levels)
    total_value = Decimal(0)
    for o in levels:
        item = db.get(StockItem, o.item_id)
        if item and item.unit_cost is not None:
            total_value += _dec(o.quantity) * _dec(item.unit_cost)
    return {
        "item_count": db.scalar(item_q) or 0,
        "warehouse_count": db.scalar(wh_q) or 0,
        "active_warehouse_count": db.scalar(wh_active_q) or 0,
        "level_count": len(levels),
        "total_quantity": float(total_qty),
        "total_value": float(total_value),
        "low_stock_count": sum(1 for o in levels if o.is_low),
    }
