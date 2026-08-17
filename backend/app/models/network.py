from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.core import BigIntType, JSONType

# ── Network Asset (unified table for point assets) ───────────────────────
# asset_type discriminator: olt, pop, odf, tj_box, enclosure, splitter,
#   dist_box, pole, manhole, cabinet, dc_site


class NetworkAsset(TimestampMixin, Base):
    __tablename__ = "network_assets"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    asset_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    asset_type: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), server_default="active", nullable=False
    )
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    accuracy_m: Mapped[float | None] = mapped_column(Numeric(6, 2))
    installed_at: Mapped[date | None] = mapped_column(Date)
    owner: Mapped[str | None] = mapped_column(Text)
    department_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("departments.id", ondelete="SET NULL")
    )
    parent_asset_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="SET NULL")
    )
    capacity: Mapped[int | None] = mapped_column(Integer)
    photos: Mapped[dict | None] = mapped_column(JSONType)
    documents: Mapped[dict | None] = mapped_column(JSONType)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", nullable=False)

    parent = relationship("NetworkAsset", remote_side="NetworkAsset.id")


# ── Fiber Cable ────────────────────────────────────────────────────────


class FiberCable(TimestampMixin, Base):
    __tablename__ = "fiber_cables"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    cable_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    cable_type: Mapped[str | None] = mapped_column(String(50))
    core_count: Mapped[int] = mapped_column(Integer, nullable=False)
    start_asset_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="SET NULL")
    )
    end_asset_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="SET NULL")
    )
    # route geometry stored as GeoJSON in JSON for portability;
    # on PostgreSQL with PostGIS, a geometry column is used (see migration).
    route_geojson: Mapped[dict | None] = mapped_column(JSONType)
    length_m: Mapped[float | None] = mapped_column(Numeric(10, 2))
    installed_at: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String(20), server_default="active", nullable=False
    )
    owner: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    cores = relationship(
        "FiberCore", back_populates="cable", cascade="all, delete-orphan"
    )


# ── Fiber Core ─────────────────────────────────────────────────────────


class FiberCore(Base):
    __tablename__ = "fiber_cores"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    cable_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("fiber_cables.id", ondelete="CASCADE"), nullable=False
    )
    core_number: Mapped[int] = mapped_column(Integer, nullable=False)
    color: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(
        String(20), server_default="available", nullable=False
    )
    source_asset_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="SET NULL")
    )
    destination_asset_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="SET NULL")
    )
    related_customer_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("customers.id", ondelete="SET NULL")
    )
    notes: Mapped[str | None] = mapped_column(Text)

    cable = relationship("FiberCable", back_populates="cores")


# ── Splice ────────────────────────────────────────────────────────────


class Splice(Base):
    __tablename__ = "splices"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    enclosure_asset_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="SET NULL")
    )
    source_core_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("fiber_cores.id", ondelete="CASCADE"), nullable=False
    )
    destination_core_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("fiber_cores.id", ondelete="CASCADE"), nullable=False
    )
    splice_loss: Mapped[float | None] = mapped_column(Numeric(5, 2))
    technician_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="SET NULL")
    )
    spliced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)

    source_core = relationship("FiberCore", foreign_keys=[source_core_id])
    destination_core = relationship("FiberCore", foreign_keys=[destination_core_id])


# ── Splitter Port ─────────────────────────────────────────────────────


class SplitterPort(Base):
    __tablename__ = "splitter_ports"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    splitter_asset_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="CASCADE"), nullable=False
    )
    port_kind: Mapped[str] = mapped_column(String(10), nullable=False)  # input | output
    port_index: Mapped[int] = mapped_column(Integer, nullable=False)
    connected_core_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("fiber_cores.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(
        String(20), server_default="available", nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)


# ── Customer Network Link (explicit customer-to-network connection) ────


class CustomerNetworkLink(Base):
    __tablename__ = "customer_network_links"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False
    )
    link_kind: Mapped[str] = mapped_column(String(20), nullable=False)  # splitter_port | core
    target_asset_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("network_assets.id", ondelete="SET NULL")
    )
    target_core_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("fiber_cores.id", ondelete="SET NULL")
    )
    target_port_index: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    customer = relationship("Customer")
    target_asset = relationship("NetworkAsset")
