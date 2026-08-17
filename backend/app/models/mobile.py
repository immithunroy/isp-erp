from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
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
from app.models.core import BigIntType, JSONType


class GpsRecord(Base):
    __tablename__ = "gps_records"

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float | None] = mapped_column(Numeric(6, 2))
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    source: Mapped[str] = mapped_column(String(30), server_default="mobile", nullable=False)
    activity: Mapped[str] = mapped_column(String(30), nullable=False)
    related_type: Mapped[str | None] = mapped_column(String(50))
    related_id: Mapped[str | None] = mapped_column(String(50))
    device_id: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    employee = relationship("Employee")


class SyncQueue(TimestampMixin, Base):
    __tablename__ = "sync_queue"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_sync_queue_idempotency"),
    )

    id: Mapped[int] = mapped_column(BigIntType, primary_key=True, autoincrement=True)
    device_id: Mapped[str | None] = mapped_column(Text)
    employee_id: Mapped[int | None] = mapped_column(
        BigIntType, ForeignKey("employees.id", ondelete="SET NULL")
    )
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONType)
    status: Mapped[str] = mapped_column(
        String(20), server_default="pending", nullable=False
    )
    retries: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    processed_record_id: Mapped[int | None] = mapped_column(BigIntType)
