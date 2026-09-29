from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.inventory import (
    LowStockItem,
    PurchaseOrderCreate,
    PurchaseOrderLineCreate,
    PurchaseOrderLineOut,
    PurchaseOrderOut,
    PurchaseOrderReceive,
    PurchaseOrderUpdate,
    StockItemCreate,
    StockItemOut,
    StockItemUpdate,
    StockLevelOut,
    StockMovementCreate,
    StockMovementOut,
    StockTransferCreate,
    WarehouseCreate,
    WarehouseOut,
    WarehouseUpdate,
)
from app.services import inventory_service

# ── Warehouses ─────────────────────────────────────────────────────────
warehouses_router = APIRouter(prefix="/inventory/warehouses", tags=["inventory-warehouses"])


@warehouses_router.get("", response_model=Page[WarehouseOut])
async def list_warehouses(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    _: Annotated[User, Depends(require_permission("inventory:warehouses:read"))] = None,
):
    rows, total = inventory_service.list_warehouses(
        db,
        search=search,
        organization_id=organization_id,
        is_active=is_active,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@warehouses_router.get("/{warehouse_id}", response_model=WarehouseOut)
async def get_warehouse(
    warehouse_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("inventory:warehouses:read"))] = None,
):
    w = inventory_service.get_warehouse(db, warehouse_id)
    if not w:
        raise problem(404, "Not Found", "Warehouse not found.")
    return w


@warehouses_router.post(
    "", response_model=WarehouseOut, status_code=status.HTTP_201_CREATED,
)
async def create_warehouse(
    payload: WarehouseCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:warehouses:write"))],
):
    return inventory_service.create_warehouse(db, payload.model_dump(), user_id=user.id)


@warehouses_router.put("/{warehouse_id}", response_model=WarehouseOut)
async def update_warehouse(
    warehouse_id: int,
    payload: WarehouseUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:warehouses:write"))],
):
    w = inventory_service.get_warehouse(db, warehouse_id)
    if not w:
        raise problem(404, "Not Found", "Warehouse not found.")
    return inventory_service.update_warehouse(
        db, w, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@warehouses_router.delete("/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_warehouse(
    warehouse_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:warehouses:write"))],
):
    w = inventory_service.get_warehouse(db, warehouse_id)
    if not w:
        raise problem(404, "Not Found", "Warehouse not found.")
    inventory_service.delete_warehouse(db, w, user_id=user.id)
    return None


# ── Stock Items ────────────────────────────────────────────────────────
items_router = APIRouter(prefix="/inventory/items", tags=["inventory-items"])


@items_router.get("", response_model=Page[StockItemOut])
async def list_items(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    category: str | None = Query(None),
    asset_class: str | None = Query(None),
    is_active: bool | None = Query(None),
    _: Annotated[User, Depends(require_permission("inventory:items:read"))] = None,
):
    rows, total = inventory_service.list_items(
        db,
        search=search,
        organization_id=organization_id,
        category=category,
        asset_class=asset_class,
        is_active=is_active,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@items_router.get("/{item_id}", response_model=StockItemOut)
async def get_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("inventory:items:read"))] = None,
):
    item = inventory_service.get_item(db, item_id)
    if not item:
        raise problem(404, "Not Found", "Stock item not found.")
    return item


@items_router.post("", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: StockItemCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:items:write"))],
):
    return inventory_service.create_item(db, payload.model_dump(), user_id=user.id)


@items_router.put("/{item_id}", response_model=StockItemOut)
async def update_item(
    item_id: int,
    payload: StockItemUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:items:write"))],
):
    item = inventory_service.get_item(db, item_id)
    if not item:
        raise problem(404, "Not Found", "Stock item not found.")
    return inventory_service.update_item(
        db, item, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@items_router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:items:write"))],
):
    item = inventory_service.get_item(db, item_id)
    if not item:
        raise problem(404, "Not Found", "Stock item not found.")
    inventory_service.delete_item(db, item, user_id=user.id)
    return None


# ── Stock Levels ───────────────────────────────────────────────────────
stock_router = APIRouter(prefix="/inventory/stock", tags=["inventory-stock"])


@stock_router.get("", response_model=Page[StockLevelOut])
async def list_levels(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    warehouse_id: int | None = Query(None),
    item_id: int | None = Query(None),
    category: str | None = Query(None),
    low_only: bool = Query(False, description="Only levels at or below reorder level"),
    _: Annotated[User, Depends(require_permission("inventory:stock:read"))] = None,
):
    rows, total = inventory_service.list_levels(
        db,
        organization_id=organization_id,
        warehouse_id=warehouse_id,
        item_id=item_id,
        category=category,
        low_only=low_only,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@stock_router.get("/low", response_model=list[LowStockItem])
async def list_low_stock(
    db: Annotated[Session, Depends(get_db)],
    organization_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("inventory:stock:read"))] = None,
):
    return inventory_service.low_stock_items(db, organization_id=organization_id)


@stock_router.get("/summary")
async def get_summary(
    db: Annotated[Session, Depends(get_db)],
    organization_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("inventory:stock:read"))] = None,
):
    return inventory_service.inventory_summary(db, organization_id=organization_id)


@stock_router.get("/{level_id}", response_model=StockLevelOut)
async def get_level(
    level_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("inventory:stock:read"))] = None,
):
    out = inventory_service.get_level_out(db, level_id)
    if not out:
        raise problem(404, "Not Found", "Stock level not found.")
    return out


# ── Stock Movements ────────────────────────────────────────────────────
movements_router = APIRouter(prefix="/inventory/movements", tags=["inventory-movements"])


@movements_router.get("", response_model=Page[StockMovementOut])
async def list_movements(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    organization_id: int | None = Query(None),
    item_id: int | None = Query(None),
    warehouse_id: int | None = Query(None),
    movement_type: str | None = Query(None),
    network_asset_id: int | None = Query(
        None, description="Movements of stock consumed by this network asset"
    ),
    reference_type: str | None = Query(None),
    reference_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("inventory:movements:read"))] = None,
):
    rows, total = inventory_service.list_movements(
        db,
        organization_id=organization_id,
        item_id=item_id,
        warehouse_id=warehouse_id,
        movement_type=movement_type,
        network_asset_id=network_asset_id,
        reference_type=reference_type,
        reference_id=reference_id,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@movements_router.get("/{movement_id}", response_model=StockMovementOut)
async def get_movement(
    movement_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("inventory:movements:read"))] = None,
):
    mv = inventory_service.get_movement(db, movement_id)
    if not mv:
        raise problem(404, "Not Found", "Stock movement not found.")
    return mv


@movements_router.post(
    "", response_model=StockMovementOut, status_code=status.HTTP_201_CREATED,
)
async def create_movement(
    payload: StockMovementCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:stock:write"))],
):
    return inventory_service.create_movement(db, payload.model_dump(), user_id=user.id)


@movements_router.post(
    "/transfer",
    response_model=list[StockMovementOut],
    status_code=status.HTTP_201_CREATED,
)
async def transfer_stock(
    payload: StockTransferCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:stock:write"))],
):
    moves = inventory_service.transfer_stock(db, payload.model_dump(), user_id=user.id)
    return moves


# ── Purchase Orders ────────────────────────────────────────────────────
purchase_orders_router = APIRouter(
    prefix="/inventory/purchase-orders", tags=["inventory-purchase-orders"],
)


@purchase_orders_router.get("", response_model=Page[PurchaseOrderOut])
async def list_purchase_orders(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    status: str | None = Query(None),
    warehouse_id: int | None = Query(None),
    supplier_name: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("inventory:purchase_orders:read"))] = None,
):
    rows, total = inventory_service.list_purchase_orders(
        db,
        search=search,
        organization_id=organization_id,
        status=status,
        warehouse_id=warehouse_id,
        supplier_name=supplier_name,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@purchase_orders_router.get("/{po_id}", response_model=PurchaseOrderOut)
async def get_purchase_order(
    po_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("inventory:purchase_orders:read"))] = None,
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return po


@purchase_orders_router.post(
    "", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED,
)
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:purchase_orders:write"))],
):
    return inventory_service.create_purchase_order(
        db, payload.model_dump(), user_id=user.id
    )


@purchase_orders_router.put("/{po_id}", response_model=PurchaseOrderOut)
async def update_purchase_order(
    po_id: int,
    payload: PurchaseOrderUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:purchase_orders:write"))],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return inventory_service.update_purchase_order(
        db, po, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@purchase_orders_router.post("/{po_id}/lines", response_model=PurchaseOrderLineOut)
async def add_po_line(
    po_id: int,
    payload: PurchaseOrderLineCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:purchase_orders:write"))],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return inventory_service.add_po_line(db, po, payload.model_dump(), user_id=user.id)


@purchase_orders_router.delete(
    "/{po_id}/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_po_line(
    po_id: int,
    line_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:purchase_orders:write"))],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    line = next((line for line in po.lines if line.id == line_id), None)
    if not line:
        raise problem(404, "Not Found", "Purchase order line not found.")
    inventory_service.delete_po_line(db, po, line, user_id=user.id)
    return None


@purchase_orders_router.post("/{po_id}/cancel", response_model=PurchaseOrderOut)
async def cancel_purchase_order(
    po_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:purchase_orders:write"))],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return inventory_service.cancel_purchase_order(db, po, user=user)


@purchase_orders_router.post("/{po_id}/receive", response_model=PurchaseOrderOut)
async def receive_purchase_order(
    po_id: int,
    payload: PurchaseOrderReceive,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:purchase_orders:write"))],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return inventory_service.receive_purchase_order(
        db, po, payload.model_dump(), user_id=user.id
    )


@purchase_orders_router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchase_order(
    po_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("inventory:purchase_orders:write"))],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    inventory_service.delete_purchase_order(db, po, user_id=user.id)
    return None
