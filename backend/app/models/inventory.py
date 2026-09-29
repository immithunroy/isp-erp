from __future__ import annotations

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
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.core import BigIntType

# ── Warehouse ──────────────────────────────────────────────────────────


class Warehouse(TimestampMixin, Base):
    __tablename__ = "warehouses"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_warehouse_org_code"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    manager_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="SET NULL")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


# ── Stock Item (catalog) ───────────────────────────────────────────────


class StockItem(TimestampMixin, Base):
    __tablename__ = "stock_items"
    __table_args__ = (
        UniqueConstraint("organization_id", "sku", name="uq_stock_item_org_sku"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    sku: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(50))
    unit: Mapped[str] = mapped_column(String(20), server_default="pcs", nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 2))
    reorder_level: Mapped[float] = mapped_column(
        Numeric(14, 3), server_default="0", nullable=False
    )
    # Which network asset_type this item is typically installed into
    # (olt, splitter, enclosure, tj_box, ...). Informational: the authoritative
    # link is stock_movements.network_asset_id.
    asset_class: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


# ── Stock Level (item x warehouse on-hand quantity) ─────────────────────


class StockLevel(Base):
    __tablename__ = "stock_levels"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "item_id", name="uq_stock_level_wh_item"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    warehouse_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("stock_items.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[float] = mapped_column(
        Numeric(14, 3), server_default="0", nullable=False
    )
    reserved_quantity: Mapped[float] = mapped_column(
        Numeric(14, 3), server_default="0", nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    warehouse = relationship("Warehouse")
    item = relationship("StockItem")


# ── Stock Movement (immutable audit trail of every quantity change) ─────


class StockMovement(TimestampMixin, Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    # receipt | issue | adjustment | transfer_in | transfer_out
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    item_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("stock_items.id", ondelete="CASCADE"), nullable=False
    )
    warehouse_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False
    )
    to_warehouse_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("warehouses.id", ondelete="SET NULL")
    )
    # Always stored as a positive magnitude; the movement_type carries direction.
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    # Signed delta actually applied to the level, for easy auditing.
    signed_delta: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    balance_after: Mapped[float | None] = mapped_column(Numeric(14, 3))
    # The network asset that consumed the item (issues/adjustments in the field).
    network_asset_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="SET NULL")
    )
    work_order_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("work_orders.id", ondelete="SET NULL")
    )
    # purchase_order | manual
    reference_type: Mapped[str | None] = mapped_column(String(30))
    reference_id: Mapped[int | None] = mapped_column(BigIntType)
    reason: Mapped[str | None] = mapped_column(Text)
    moved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )

    item = relationship("StockItem")
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    to_warehouse = relationship("Warehouse", foreign_keys=[to_warehouse_id])
    network_asset = relationship("NetworkAsset")


# ── Purchase Order ─────────────────────────────────────────────────────


class PurchaseOrder(TimestampMixin, Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    po_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    supplier_name: Mapped[str] = mapped_column(Text, nullable=False)
    supplier_contact: Mapped[str | None] = mapped_column(Text)
    supplier_email: Mapped[str | None] = mapped_column(Text)
    # draft | approved | partially_received | received | cancelled
    status: Mapped[str] = mapped_column(String(20), server_default="draft", nullable=False)
    warehouse_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False
    )
    order_date: Mapped[date] = mapped_column(
        Date, server_default=func.current_date(), nullable=False
    )
    expected_date: Mapped[date | None] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3), server_default="USD", nullable=False)
    subtotal: Mapped[float] = mapped_column(
        Numeric(14, 2), server_default="0", nullable=False
    )
    tax_amount: Mapped[float] = mapped_column(
        Numeric(14, 2), server_default="0", nullable=False
    )
    total_amount: Mapped[float] = mapped_column(
        Numeric(14, 2), server_default="0", nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )
    approved_by: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    warehouse = relationship("Warehouse")
    lines = relationship(
        "PurchaseOrderLine",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
    )


# ── Purchase Order Line ────────────────────────────────────────────────


class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    purchase_order_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("stock_items.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    received_quantity: Mapped[float] = mapped_column(
        Numeric(14, 3), server_default="0", nullable=False
    )
    unit_cost: Mapped[float] = mapped_column(
        Numeric(14, 2), server_default="0", nullable=False
    )
    line_total: Mapped[float] = mapped_column(
        Numeric(14, 2), server_default="0", nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)

    purchase_order = relationship("PurchaseOrder", back_populates="lines")
    item = relationship("StockItem")
