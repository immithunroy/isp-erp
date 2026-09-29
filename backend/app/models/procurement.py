from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.core import BigIntType

# ── Supplier ───────────────────────────────────────────────────────────


class Supplier(TimestampMixin, Base):
    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_supplier_org_code"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    contact_name: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(Text)
    # fiber | hardware | logistics | services | other
    category: Mapped[str | None] = mapped_column(String(30))
    # cod | net15 | net30 | net60
    payment_terms: Mapped[str | None] = mapped_column(String(20))
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    tax_id: Mapped[str | None] = mapped_column(String(60))
    bank_account: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    quotes = relationship("SupplierQuote")


# ── Request for Quotation ──────────────────────────────────────────────


class Rfq(TimestampMixin, Base):
    __tablename__ = "rfqs"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    rfq_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    # draft | issued | closed | cancelled
    status: Mapped[str] = mapped_column(String(20), server_default="draft", nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3), server_default="USD", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="SET NULL")
    )
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lines = relationship("RfqLine", back_populates="rfq", cascade="all, delete-orphan")
    quotes = relationship("SupplierQuote", back_populates="rfq")


class RfqLine(Base):
    __tablename__ = "rfq_lines"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    rfq_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False
    )
    stock_item_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("stock_items.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    # Optional budget ceiling per unit, used to flag quotes that overrun it.
    target_unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 2))
    notes: Mapped[str | None] = mapped_column(Text)

    rfq = relationship("Rfq", back_populates="lines")
    item = relationship("StockItem")


# ── Supplier Quote (a supplier's response to an RFQ) ───────────────────


class SupplierQuote(TimestampMixin, Base):
    __tablename__ = "supplier_quotes"
    __table_args__ = (
        UniqueConstraint("rfq_id", "supplier_id", name="uq_quote_rfq_supplier"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    rfq_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False
    )
    supplier_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False
    )
    # received | accepted | rejected
    status: Mapped[str] = mapped_column(String(20), server_default="received", nullable=False)
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
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    valid_until: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Set when this quote is converted into a purchase order.
    purchase_order_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("purchase_orders.id", ondelete="SET NULL")
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    rfq = relationship("Rfq", back_populates="quotes")
    supplier = relationship("Supplier", back_populates="quotes")
    lines = relationship(
        "SupplierQuoteLine", back_populates="quote", cascade="all, delete-orphan"
    )


class SupplierQuoteLine(Base):
    __tablename__ = "supplier_quote_lines"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    quote_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("supplier_quotes.id", ondelete="CASCADE"), nullable=False
    )
    rfq_line_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("rfq_lines.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(
        Numeric(14, 2), server_default="0", nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)

    quote = relationship("SupplierQuote", back_populates="lines")
    rfq_line = relationship("RfqLine")


# ── Purchase Order Approval (multi-level approval chain) ───────────────


class PurchaseOrderApproval(Base):
    __tablename__ = "purchase_order_approvals"
    __table_args__ = (
        UniqueConstraint("purchase_order_id", "sequence", name="uq_po_approval_seq"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    purchase_order_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    # 1-based position in the chain; must be decided in ascending order.
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    # pending | approved | rejected
    status: Mapped[str] = mapped_column(String(20), server_default="pending", nullable=False)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    comments: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    approver = relationship("User")
