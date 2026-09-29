from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.inventory import PurchaseOrderOut
from app.schemas.procurement import (
    ApprovalChainCreate,
    ApprovalDecision,
    RfqCreate,
    RfqLineCreate,
    RfqLineOut,
    RfqOut,
    RfqUpdate,
    SupplierCreate,
    SupplierOut,
    SupplierQuoteCreate,
    SupplierQuoteOut,
    SupplierUpdate,
)
from app.services import inventory_service, procurement_service

# ── Suppliers ──────────────────────────────────────────────────────────
suppliers_router = APIRouter(prefix="/procurement/suppliers", tags=["procurement-suppliers"])


@suppliers_router.get("", response_model=Page[SupplierOut])
async def list_suppliers(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    category: str | None = Query(None),
    is_active: bool | None = Query(None),
    _: Annotated[User, Depends(require_permission("procurement:suppliers:read"))] = None,
):
    rows, total = procurement_service.list_suppliers(
        db,
        search=search,
        organization_id=organization_id,
        category=category,
        is_active=is_active,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@suppliers_router.get("/{supplier_id}", response_model=SupplierOut)
async def get_supplier(
    supplier_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("procurement:suppliers:read"))] = None,
):
    s = procurement_service.get_supplier(db, supplier_id)
    if not s:
        raise problem(404, "Not Found", "Supplier not found.")
    return s


@suppliers_router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: SupplierCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:suppliers:write"))],
):
    return procurement_service.create_supplier(db, payload.model_dump(), user_id=user.id)


@suppliers_router.put("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:suppliers:write"))],
):
    s = procurement_service.get_supplier(db, supplier_id)
    if not s:
        raise problem(404, "Not Found", "Supplier not found.")
    return procurement_service.update_supplier(
        db, s, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@suppliers_router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:suppliers:write"))],
):
    s = procurement_service.get_supplier(db, supplier_id)
    if not s:
        raise problem(404, "Not Found", "Supplier not found.")
    procurement_service.delete_supplier(db, s, user_id=user.id)
    return None


# ── RFQs ───────────────────────────────────────────────────────────────
rfqs_router = APIRouter(prefix="/procurement/rfqs", tags=["procurement-rfqs"])


@rfqs_router.get("", response_model=Page[RfqOut])
async def list_rfqs(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    status: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("procurement:rfq:read"))] = None,
):
    rows, total = procurement_service.list_rfqs(
        db,
        search=search,
        organization_id=organization_id,
        status=status,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    items = [procurement_service.rfq_out(db, r) for r in rows]
    return paginate(items, total, pagination)


@rfqs_router.get("/{rfq_id}", response_model=RfqOut)
async def get_rfq(
    rfq_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("procurement:rfq:read"))] = None,
):
    out = procurement_service.getrfq_out(db, rfq_id)
    if not out:
        raise problem(404, "Not Found", "RFQ not found.")
    return out


@rfqs_router.post("", response_model=RfqOut, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    payload: RfqCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:rfq:write"))],
):
    return procurement_service.create_rfq(db, payload.model_dump(), user_id=user.id)


@rfqs_router.put("/{rfq_id}", response_model=RfqOut)
async def update_rfq(
    rfq_id: int,
    payload: RfqUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:rfq:write"))],
):
    rfq = procurement_service.get_rfq(db, rfq_id)
    if not rfq:
        raise problem(404, "Not Found", "RFQ not found.")
    return procurement_service.update_rfq(
        db, rfq, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@rfqs_router.post("/{rfq_id}/lines", response_model=RfqLineOut)
async def add_rfq_line(
    rfq_id: int,
    payload: RfqLineCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:rfq:write"))],
):
    rfq = procurement_service.get_rfq(db, rfq_id)
    if not rfq:
        raise problem(404, "Not Found", "RFQ not found.")
    return procurement_service.add_rfq_line(db, rfq, payload.model_dump(), user_id=user.id)


@rfqs_router.delete("/{rfq_id}/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rfq_line(
    rfq_id: int,
    line_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:rfq:write"))],
):
    rfq = procurement_service.get_rfq(db, rfq_id)
    if not rfq:
        raise problem(404, "Not Found", "RFQ not found.")
    line = next((x for x in rfq.lines if x.id == line_id), None)
    if not line:
        raise problem(404, "Not Found", "RFQ line not found.")
    procurement_service.delete_rfq_line(db, rfq, line, user_id=user.id)
    return None


@rfqs_router.post("/{rfq_id}/issue", response_model=RfqOut)
async def issue_rfq(
    rfq_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:rfq:write"))],
):
    rfq = procurement_service.get_rfq(db, rfq_id)
    if not rfq:
        raise problem(404, "Not Found", "RFQ not found.")
    return procurement_service.issue_rfq(db, rfq, user_id=user.id)


@rfqs_router.post("/{rfq_id}/cancel", response_model=RfqOut)
async def cancel_rfq(
    rfq_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:rfq:write"))],
):
    rfq = procurement_service.get_rfq(db, rfq_id)
    if not rfq:
        raise problem(404, "Not Found", "RFQ not found.")
    return procurement_service.cancel_rfq(db, rfq, user_id=user.id)


# ── Quotes ─────────────────────────────────────────────────────────────
quotes_router = APIRouter(prefix="/procurement/quotes", tags=["procurement-quotes"])


@quotes_router.get("", response_model=Page[SupplierQuoteOut])
async def list_quotes(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    rfq_id: int | None = Query(None),
    supplier_id: int | None = Query(None),
    organization_id: int | None = Query(None),
    status: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("procurement:quotes:read"))] = None,
):
    rows, total = procurement_service.list_quotes(
        db,
        rfq_id=rfq_id,
        supplier_id=supplier_id,
        organization_id=organization_id,
        status=status,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    items = [procurement_service.quote_out(db, q) for q in rows]
    return paginate(items, total, pagination)


@quotes_router.get("/{quote_id}", response_model=SupplierQuoteOut)
async def get_quote(
    quote_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("procurement:quotes:read"))] = None,
):
    out = procurement_service.getquote_out(db, quote_id)
    if not out:
        raise problem(404, "Not Found", "Quote not found.")
    return out


@quotes_router.post(
    "", response_model=SupplierQuoteOut, status_code=status.HTTP_201_CREATED,
)
async def create_quote(
    payload: SupplierQuoteCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:quotes:write"))],
):
    return procurement_service.create_quote(db, payload.model_dump(), user_id=user.id)


@quotes_router.post("/{quote_id}/accept", response_model=SupplierQuoteOut)
async def accept_quote(
    quote_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:quotes:approve"))],
):
    q = procurement_service.get_quote(db, quote_id)
    if not q:
        raise problem(404, "Not Found", "Quote not found.")
    return procurement_service.accept_quote(db, q, user_id=user.id)


@quotes_router.post("/{quote_id}/reject", response_model=SupplierQuoteOut)
async def reject_quote(
    quote_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:quotes:approve"))],
):
    q = procurement_service.get_quote(db, quote_id)
    if not q:
        raise problem(404, "Not Found", "Quote not found.")
    return procurement_service.reject_quote(db, q, user_id=user.id)


@quotes_router.post(
    "/{quote_id}/convert-to-po", response_model=PurchaseOrderOut,
    status_code=status.HTTP_201_CREATED,
)
async def convert_quote_to_po(
    quote_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("procurement:quotes:approve"))],
    warehouse_id: int = Query(..., description="Warehouse to receive the goods into"),
):
    q = procurement_service.get_quote(db, quote_id)
    if not q:
        raise problem(404, "Not Found", "Quote not found.")
    return procurement_service.convert_quote_to_po(db, q, warehouse_id, user_id=user.id)


# ── Purchase order approvals ───────────────────────────────────────────
approvals_router = APIRouter(
    prefix="/procurement/purchase-orders", tags=["procurement-po-approvals"],
)


@approvals_router.get("/{po_id}/approvals")
async def list_po_approvals(
    po_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("procurement:purchase_orders:read"))] = None,
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return procurement_service.list_approvals(db, po_id)


@approvals_router.post("/{po_id}/approvals", status_code=status.HTTP_201_CREATED)
async def submit_for_approval(
    po_id: int,
    payload: ApprovalChainCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[
        User, Depends(require_permission("procurement:purchase_orders:write"))
    ],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return procurement_service.build_approval_chain(
        db, po, payload.approver_ids, user_id=user.id
    )


@approvals_router.post("/{po_id}/approvals/{sequence}/approve")
async def approve_level(
    po_id: int,
    sequence: int,
    payload: ApprovalDecision,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[
        User, Depends(require_permission("procurement:purchase_orders:approve"))
    ],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return procurement_service.decide_approval(
        db, po, sequence, True, user=user, comments=payload.comments
    )


@approvals_router.post("/{po_id}/approvals/{sequence}/reject")
async def reject_level(
    po_id: int,
    sequence: int,
    payload: ApprovalDecision,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[
        User, Depends(require_permission("procurement:purchase_orders:approve"))
    ],
):
    po = inventory_service.get_purchase_order(db, po_id)
    if not po:
        raise problem(404, "Not Found", "Purchase order not found.")
    return procurement_service.decide_approval(
        db, po, sequence, False, user=user, comments=payload.comments
    )
