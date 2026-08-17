from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.errors import problem
from app.models.customers import (
    Customer,
    CustomerLocation,
    CustomerVisit,
    WorkOrder,
    WorkOrderEvent,
)


# ── Customers ─────────────────────────────────────────────────────────
def list_customers(
    db: Session, *, search: str | None = None, organization_id: int | None = None,
    branch_id: int | None = None, status: str | None = None,
    assigned_technician_id: int | None = None, is_active: bool | None = None,
    offset: int = 0, limit: int = 20,
) -> tuple[list[Customer], int]:
    stmt = select(Customer)
    count_stmt = select(func.count(Customer.id))
    if search:
        like = f"%{search}%"
        cond = (
            Customer.name.ilike(like)
            | Customer.customer_code.ilike(like)
            | Customer.phone.ilike(like)
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(Customer.organization_id == organization_id)
        count_stmt = count_stmt.where(Customer.organization_id == organization_id)
    if branch_id is not None:
        stmt = stmt.where(Customer.branch_id == branch_id)
        count_stmt = count_stmt.where(Customer.branch_id == branch_id)
    if status:
        stmt = stmt.where(Customer.status == status)
        count_stmt = count_stmt.where(Customer.status == status)
    if assigned_technician_id is not None:
        stmt = stmt.where(Customer.assigned_technician_id == assigned_technician_id)
        count_stmt = count_stmt.where(
            Customer.assigned_technician_id == assigned_technician_id
        )
    if is_active is not None:
        stmt = stmt.where(Customer.is_active == is_active)
        count_stmt = count_stmt.where(Customer.is_active == is_active)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_customer(db: Session, cid: int) -> Customer | None:
    return db.get(Customer, cid)


def create_customer(db: Session, payload: dict, *, user_id: int | None = None) -> Customer:
    if db.scalar(select(Customer).where(Customer.customer_code == payload["customer_code"])):
        raise problem(409, "Conflict", "Customer code already exists.")
    c = Customer(**payload)
    db.add(c)
    db.flush()
    write_audit(
        db, user_id=user_id, action="customer.create",
        entity_type="customer", entity_id=str(c.id), new_value=payload,
    )
    db.commit()
    db.refresh(c)
    return c


def update_customer(
    db: Session, c: Customer, payload: dict, *, user_id: int | None = None
) -> Customer:
    prev = {k: getattr(c, k) for k in payload if hasattr(c, k)}
    for k, v in payload.items():
        setattr(c, k, v)
    db.flush()
    write_audit(
        db, user_id=user_id, action="customer.update",
        entity_type="customer", entity_id=str(c.id),
        previous_value=prev, new_value=payload,
    )
    db.commit()
    db.refresh(c)
    return c


def delete_customer(db: Session, c: Customer, *, user_id: int | None = None) -> None:
    write_audit(
        db, user_id=user_id, action="customer.delete",
        entity_type="customer", entity_id=str(c.id),
    )
    db.delete(c)
    db.commit()


# ── Customer Locations ────────────────────────────────────────────────
def list_locations(
    db: Session, *, customer_id: int | None = None, is_current: bool | None = None,
    offset: int = 0, limit: int = 50,
) -> tuple[list[CustomerLocation], int]:
    stmt = select(CustomerLocation)
    count_stmt = select(func.count(CustomerLocation.id))
    if customer_id is not None:
        stmt = stmt.where(CustomerLocation.customer_id == customer_id)
        count_stmt = count_stmt.where(CustomerLocation.customer_id == customer_id)
    if is_current is not None:
        stmt = stmt.where(CustomerLocation.is_current == is_current)
        count_stmt = count_stmt.where(CustomerLocation.is_current == is_current)
    stmt = stmt.order_by(CustomerLocation.recorded_at.desc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def add_location(
    db: Session, payload: dict, *, user_id: int | None = None
) -> CustomerLocation:
    customer_id = payload["customer_id"]
    # Mark all previous locations as not current — never overwrite history.
    db.execute(
        update(CustomerLocation)
        .where(CustomerLocation.customer_id == customer_id)
        .values(is_current=False)
    )
    loc = CustomerLocation(**payload, is_current=True)
    db.add(loc)
    db.flush()
    write_audit(
        db, user_id=user_id, action="customer_location.add",
        entity_type="customer_location", entity_id=str(loc.id), new_value=payload,
    )
    db.commit()
    db.refresh(loc)
    return loc


def get_current_location(db: Session, customer_id: int) -> CustomerLocation | None:
    return db.scalar(
        select(CustomerLocation).where(
            CustomerLocation.customer_id == customer_id,
            CustomerLocation.is_current.is_(True),
        )
    )


# ── Customer Visits ───────────────────────────────────────────────────
def list_visits(
    db: Session, *, customer_id: int | None = None, employee_id: int | None = None,
    offset: int = 0, limit: int = 20,
) -> tuple[list[CustomerVisit], int]:
    stmt = select(CustomerVisit)
    count_stmt = select(func.count(CustomerVisit.id))
    if customer_id is not None:
        stmt = stmt.where(CustomerVisit.customer_id == customer_id)
        count_stmt = count_stmt.where(CustomerVisit.customer_id == customer_id)
    if employee_id is not None:
        stmt = stmt.where(CustomerVisit.employee_id == employee_id)
        count_stmt = count_stmt.where(CustomerVisit.employee_id == employee_id)
    stmt = stmt.order_by(CustomerVisit.visited_at.desc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def create_visit(
    db: Session, payload: dict, *, user_id: int | None = None
) -> CustomerVisit:
    v = CustomerVisit(**payload)
    db.add(v)
    db.flush()
    write_audit(
        db, user_id=user_id, action="customer_visit.create",
        entity_type="customer_visit", entity_id=str(v.id), new_value=payload,
    )
    db.commit()
    db.refresh(v)
    return v


# ── Work Orders ───────────────────────────────────────────────────────
VALID_TRANSITIONS: dict[str, set[str]] = {
    "open": {"assigned", "cancelled"},
    "assigned": {"accepted", "cancelled"},
    "accepted": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": {"approved", "cancelled"},
    "approved": set(),
    "cancelled": set(),
}


def list_work_orders(
    db: Session, *, search: str | None = None, organization_id: int | None = None,
    status: str | None = None, assigned_employee_id: int | None = None,
    customer_id: int | None = None, priority: str | None = None,
    offset: int = 0, limit: int = 20,
) -> tuple[list[WorkOrder], int]:
    stmt = select(WorkOrder)
    count_stmt = select(func.count(WorkOrder.id))
    if search:
        like = f"%{search}%"
        cond = WorkOrder.work_order_code.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(WorkOrder.organization_id == organization_id)
        count_stmt = count_stmt.where(WorkOrder.organization_id == organization_id)
    if status:
        stmt = stmt.where(WorkOrder.status == status)
        count_stmt = count_stmt.where(WorkOrder.status == status)
    if assigned_employee_id is not None:
        stmt = stmt.where(WorkOrder.assigned_employee_id == assigned_employee_id)
        count_stmt = count_stmt.where(
            WorkOrder.assigned_employee_id == assigned_employee_id
        )
    if customer_id is not None:
        stmt = stmt.where(WorkOrder.customer_id == customer_id)
        count_stmt = count_stmt.where(WorkOrder.customer_id == customer_id)
    if priority:
        stmt = stmt.where(WorkOrder.priority == priority)
        count_stmt = count_stmt.where(WorkOrder.priority == priority)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_work_order(db: Session, woid: int) -> WorkOrder | None:
    return db.get(WorkOrder, woid)


def create_work_order(
    db: Session, payload: dict, *, user_id: int | None = None
) -> WorkOrder:
    if db.scalar(
        select(WorkOrder).where(WorkOrder.work_order_code == payload["work_order_code"])
    ):
        raise problem(409, "Conflict", "Work order code already exists.")
    w = WorkOrder(**payload)
    db.add(w)
    db.flush()
    write_audit(
        db, user_id=user_id, action="work_order.create",
        entity_type="work_order", entity_id=str(w.id), new_value=payload,
    )
    db.commit()
    db.refresh(w)
    return w


def update_work_order(
    db: Session, w: WorkOrder, payload: dict, *, user_id: int | None = None
) -> WorkOrder:
    prev = {k: getattr(w, k) for k in payload if hasattr(w, k)}
    for k, v in payload.items():
        setattr(w, k, v)
    db.flush()
    write_audit(
        db, user_id=user_id, action="work_order.update",
        entity_type="work_order", entity_id=str(w.id),
        previous_value=prev, new_value=payload,
    )
    db.commit()
    db.refresh(w)
    return w


def transition_work_order(
    db: Session, w: WorkOrder, new_status: str, *,
    user_id: int | None = None, notes: str | None = None,
) -> WorkOrder:
    allowed = VALID_TRANSITIONS.get(w.status, set())
    if new_status not in allowed:
        raise problem(
            400, "Bad Request",
            f"Cannot transition from '{w.status}' to '{new_status}'.",
        )
    prev = {"status": w.status}
    w.status = new_status
    if new_status == "approved":
        w.approved_by = user_id
        w.approved_at = datetime.now(UTC)
    db.flush()
    event = WorkOrderEvent(
        work_order_id=w.id,
        event_type=new_status,
        actor_id=user_id,
        notes=notes,
    )
    db.add(event)
    db.flush()
    write_audit(
        db, user_id=user_id, action="work_order.transition",
        entity_type="work_order", entity_id=str(w.id),
        previous_value=prev, new_value={"status": new_status},
    )
    db.commit()
    db.refresh(w)
    return w


def delete_work_order(db: Session, w: WorkOrder, *, user_id: int | None = None) -> None:
    write_audit(
        db, user_id=user_id, action="work_order.delete",
        entity_type="work_order", entity_id=str(w.id),
    )
    db.delete(w)
    db.commit()


# ── Work Order Events ─────────────────────────────────────────────────
def list_work_order_events(
    db: Session, *, work_order_id: int | None = None,
    offset: int = 0, limit: int = 50,
) -> tuple[list[WorkOrderEvent], int]:
    stmt = select(WorkOrderEvent)
    count_stmt = select(func.count(WorkOrderEvent.id))
    if work_order_id is not None:
        stmt = stmt.where(WorkOrderEvent.work_order_id == work_order_id)
        count_stmt = count_stmt.where(WorkOrderEvent.work_order_id == work_order_id)
    stmt = stmt.order_by(WorkOrderEvent.created_at.desc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total
