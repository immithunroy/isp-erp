from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.customers import (
    CustomerCreate,
    CustomerLocationCreate,
    CustomerLocationOut,
    CustomerOut,
    CustomerUpdate,
    CustomerVisitCreate,
    CustomerVisitOut,
    WorkOrderAction,
    WorkOrderCreate,
    WorkOrderEventOut,
    WorkOrderOut,
    WorkOrderUpdate,
)
from app.services import customer_service

# ── Customers ─────────────────────────────────────────────────────────
customers_router = APIRouter(prefix="/customers", tags=["customers"])


@customers_router.get("", response_model=Page[CustomerOut])
async def list_customers(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    branch_id: int | None = Query(None),
    status: str | None = Query(None),
    assigned_technician_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    _: Annotated[User, Depends(require_permission("customers:read"))] = None,
):
    rows, total = customer_service.list_customers(
        db, search=search, organization_id=organization_id, branch_id=branch_id,
        status=status, assigned_technician_id=assigned_technician_id,
        is_active=is_active, offset=pagination.offset, limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@customers_router.get("/{cid}", response_model=CustomerOut)
async def get_customer(
    cid: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("customers:read"))] = None,
):
    c = customer_service.get_customer(db, cid)
    if not c:
        raise problem(404, "Not Found", "Customer not found.")
    return c


@customers_router.post(
    "", response_model=CustomerOut, status_code=status.HTTP_201_CREATED,
)
async def create_customer(
    payload: CustomerCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("customers:write"))],
):
    return customer_service.create_customer(db, payload.model_dump(), user_id=user.id)


@customers_router.put("/{cid}", response_model=CustomerOut)
async def update_customer(
    cid: int,
    payload: CustomerUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("customers:write"))],
):
    c = customer_service.get_customer(db, cid)
    if not c:
        raise problem(404, "Not Found", "Customer not found.")
    return customer_service.update_customer(
        db, c, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@customers_router.delete("/{cid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    cid: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("customers:write"))],
):
    c = customer_service.get_customer(db, cid)
    if not c:
        raise problem(404, "Not Found", "Customer not found.")
    customer_service.delete_customer(db, c, user_id=user.id)
    return None


# ── Customer Locations ────────────────────────────────────────────────
customer_locations_router = APIRouter(
    prefix="/customer-locations", tags=["customer-locations"],
)


@customer_locations_router.get("", response_model=Page[CustomerLocationOut])
async def list_customer_locations(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    customer_id: int | None = Query(None),
    is_current: bool | None = Query(None),
    _: Annotated[User, Depends(require_permission("customers:read"))] = None,
):
    rows, total = customer_service.list_locations(
        db, customer_id=customer_id, is_current=is_current,
        offset=pagination.offset, limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@customer_locations_router.post(
    "",
    response_model=CustomerLocationOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_customer_location(
    payload: CustomerLocationCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("customers:write"))],
):
    return customer_service.add_location(
        db, payload.model_dump(), user_id=user.id
    )


# ── Customer Visits ───────────────────────────────────────────────────
customer_visits_router = APIRouter(
    prefix="/customer-visits", tags=["customer-visits"],
)


@customer_visits_router.get("", response_model=Page[CustomerVisitOut])
async def list_customer_visits(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    customer_id: int | None = Query(None),
    employee_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("customers:read"))] = None,
):
    rows, total = customer_service.list_visits(
        db, customer_id=customer_id, employee_id=employee_id,
        offset=pagination.offset, limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@customer_visits_router.post(
    "", response_model=CustomerVisitOut, status_code=status.HTTP_201_CREATED,
)
async def create_customer_visit(
    payload: CustomerVisitCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("customers:write"))],
):
    return customer_service.create_visit(
        db, payload.model_dump(), user_id=user.id
    )


# ── Work Orders ───────────────────────────────────────────────────────
work_orders_router = APIRouter(prefix="/work-orders", tags=["work-orders"])


@work_orders_router.get("", response_model=Page[WorkOrderOut])
async def list_work_orders(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    status: str | None = Query(None),
    assigned_employee_id: int | None = Query(None),
    customer_id: int | None = Query(None),
    priority: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("field_service:read"))] = None,
):
    rows, total = customer_service.list_work_orders(
        db, search=search, organization_id=organization_id, status=status,
        assigned_employee_id=assigned_employee_id, customer_id=customer_id,
        priority=priority, offset=pagination.offset, limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@work_orders_router.get("/{woid}", response_model=WorkOrderOut)
async def get_work_order(
    woid: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("field_service:read"))] = None,
):
    w = customer_service.get_work_order(db, woid)
    if not w:
        raise problem(404, "Not Found", "Work order not found.")
    return w


@work_orders_router.post(
    "", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED,
)
async def create_work_order(
    payload: WorkOrderCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("field_service:write"))],
):
    return customer_service.create_work_order(
        db, payload.model_dump(), user_id=user.id
    )


@work_orders_router.put("/{woid}", response_model=WorkOrderOut)
async def update_work_order(
    woid: int,
    payload: WorkOrderUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("field_service:write"))],
):
    w = customer_service.get_work_order(db, woid)
    if not w:
        raise problem(404, "Not Found", "Work order not found.")
    return customer_service.update_work_order(
        db, w, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@work_orders_router.post("/{woid}/transition", response_model=WorkOrderOut)
async def transition_work_order(
    woid: int,
    payload: WorkOrderAction,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[
        User,
        Depends(require_permission("field_service:write", "field_service:approve")),
    ],
):
    w = customer_service.get_work_order(db, woid)
    if not w:
        raise problem(404, "Not Found", "Work order not found.")
    return customer_service.transition_work_order(
        db, w, payload.status, user_id=user.id, notes=payload.notes
    )


@work_orders_router.delete("/{woid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order(
    woid: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("field_service:write"))],
):
    w = customer_service.get_work_order(db, woid)
    if not w:
        raise problem(404, "Not Found", "Work order not found.")
    customer_service.delete_work_order(db, w, user_id=user.id)
    return None


# ── Work Order Events ─────────────────────────────────────────────────
work_order_events_router = APIRouter(
    prefix="/work-order-events", tags=["work-order-events"],
)


@work_order_events_router.get("", response_model=Page[WorkOrderEventOut])
async def list_work_order_events(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    work_order_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("field_service:read"))] = None,
):
    rows, total = customer_service.list_work_order_events(
        db, work_order_id=work_order_id,
        offset=pagination.offset, limit=pagination.limit,
    )
    return paginate(rows, total, pagination)
