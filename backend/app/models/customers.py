from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.core import BigIntType, JSONType


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("branches.id", ondelete="SET NULL")
    )
    customer_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    installation_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String(20), server_default="active", nullable=False
    )
    assigned_technician_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="SET NULL")
    )
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    assigned_technician = relationship("Employee", foreign_keys=[assigned_technician_id])
    locations = relationship(
        "CustomerLocation", back_populates="customer", cascade="all, delete-orphan"
    )
    visits = relationship(
        "CustomerVisit", back_populates="customer", cascade="all, delete-orphan"
    )


class CustomerLocation(Base):
    """Location history — never overwrite, append-only."""
    __tablename__ = "customer_locations"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float | None] = mapped_column(Numeric(6, 2))
    address: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), server_default="mobile", nullable=False)
    collected_by: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="SET NULL")
    )
    collection_method: Mapped[str | None] = mapped_column(String(30))
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_current: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    customer = relationship("Customer", back_populates="locations")


class CustomerVisit(TimestampMixin, Base):
    __tablename__ = "customer_visits"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    employee_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="SET NULL")
    )
    purpose: Mapped[str | None] = mapped_column(Text)
    visited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    gps_accuracy: Mapped[float | None] = mapped_column(Numeric(6, 2))
    photos: Mapped[dict | None] = mapped_column(JSONType)
    notes: Mapped[str | None] = mapped_column(Text)

    customer = relationship("Customer", back_populates="visits")
    employee = relationship("Employee")


class WorkOrder(TimestampMixin, Base):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    customer_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("customers.id", ondelete="SET NULL")
    )
    work_order_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    job_type: Mapped[str] = mapped_column(String(30), nullable=False)
    priority: Mapped[str] = mapped_column(
        String(20), server_default="medium", nullable=False
    )
    assigned_employee_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="SET NULL")
    )
    scheduled_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String(20), server_default="open", nullable=False
    )
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    photos: Mapped[dict | None] = mapped_column(JSONType)
    equipment_used: Mapped[dict | None] = mapped_column(JSONType)
    notes: Mapped[str | None] = mapped_column(Text)
    completion_report: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    customer = relationship("Customer")
    assigned_employee = relationship("Employee", foreign_keys=[assigned_employee_id])
    events = relationship(
        "WorkOrderEvent", back_populates="work_order", cascade="all, delete-orphan"
    )


class WorkOrderEvent(Base):
    __tablename__ = "work_order_events"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    work_order_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    actor_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    work_order = relationship("WorkOrder", back_populates="events")
