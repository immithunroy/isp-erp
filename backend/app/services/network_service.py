"""Network GIS service: CRUD for assets, fiber cables, cores, splices, splitters,
customer links, plus spatial map/bbox/nearby helpers.

The spatial helpers attempt a PostGIS query first (production runs PostgreSQL with
PostGIS) and gracefully fall back to plain latitude/longitude column filtering on
SQLite (used by the test suite). The `geog`/`route_geog` geometry columns are only
declared in the Alembic migration, not in the SQLAlchemy models, so the fallback
path works against tables created via `Base.metadata.create_all`.
"""
from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.errors import problem
from app.models.network import (
    CustomerNetworkLink,
    FiberCable,
    FiberCore,
    NetworkAsset,
    Splice,
    SplitterPort,
)
from app.schemas.network import MapItem

_EARTH_RADIUS_M = 6_371_000.0


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres between two lat/lon points."""
    p1 = radians(lat1)
    p2 = radians(lat2)
    dphi = radians(lat2 - lat1)
    dlam = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(p1) * cos(p2) * sin(dlam / 2) ** 2
    return 2 * _EARTH_RADIUS_M * asin(sqrt(a))


# ── Network Assets ─────────────────────────────────────────────────────
def list_assets(
    db: Session,
    *,
    search: str | None = None,
    organization_id: int | None = None,
    asset_type: str | None = None,
    status: str | None = None,
    parent_asset_id: int | None = None,
    is_active: bool | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[NetworkAsset], int]:
    stmt = select(NetworkAsset)
    count_stmt = select(func.count(NetworkAsset.id))
    if search:
        like = f"%{search}%"
        cond = NetworkAsset.name.ilike(like) | NetworkAsset.asset_code.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(NetworkAsset.organization_id == organization_id)
        count_stmt = count_stmt.where(NetworkAsset.organization_id == organization_id)
    if asset_type:
        stmt = stmt.where(NetworkAsset.asset_type == asset_type)
        count_stmt = count_stmt.where(NetworkAsset.asset_type == asset_type)
    if status:
        stmt = stmt.where(NetworkAsset.status == status)
        count_stmt = count_stmt.where(NetworkAsset.status == status)
    if parent_asset_id is not None:
        stmt = stmt.where(NetworkAsset.parent_asset_id == parent_asset_id)
        count_stmt = count_stmt.where(NetworkAsset.parent_asset_id == parent_asset_id)
    if is_active is not None:
        stmt = stmt.where(NetworkAsset.is_active == is_active)
        count_stmt = count_stmt.where(NetworkAsset.is_active == is_active)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_asset(db: Session, asset_id: int) -> NetworkAsset | None:
    return db.get(NetworkAsset, asset_id)


def create_asset(
    db: Session, payload: dict, *, user_id: int | None = None
) -> NetworkAsset:
    if db.scalar(
        select(NetworkAsset).where(NetworkAsset.asset_code == payload["asset_code"])
    ):
        raise problem(409, "Conflict", "Asset code already exists.")
    a = NetworkAsset(**payload)
    db.add(a)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="network_asset.create",
        entity_type="network_asset",
        entity_id=str(a.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(a)
    return a


def update_asset(
    db: Session, a: NetworkAsset, payload: dict, *, user_id: int | None = None
) -> NetworkAsset:
    prev = {k: getattr(a, k) for k in payload if hasattr(a, k)}
    for k, v in payload.items():
        setattr(a, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="network_asset.update",
        entity_type="network_asset",
        entity_id=str(a.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(a)
    return a


def delete_asset(db: Session, a: NetworkAsset, *, user_id: int | None = None) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="network_asset.delete",
        entity_type="network_asset",
        entity_id=str(a.id),
    )
    db.delete(a)
    db.commit()


# ── Fiber Cables ───────────────────────────────────────────────────────
def list_fiber_cables(
    db: Session,
    *,
    search: str | None = None,
    organization_id: int | None = None,
    start_asset_id: int | None = None,
    end_asset_id: int | None = None,
    status: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[FiberCable], int]:
    stmt = select(FiberCable)
    count_stmt = select(func.count(FiberCable.id))
    if search:
        like = f"%{search}%"
        cond = FiberCable.name.ilike(like) | FiberCable.cable_code.ilike(like)
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if organization_id is not None:
        stmt = stmt.where(FiberCable.organization_id == organization_id)
        count_stmt = count_stmt.where(FiberCable.organization_id == organization_id)
    if start_asset_id is not None:
        stmt = stmt.where(FiberCable.start_asset_id == start_asset_id)
        count_stmt = count_stmt.where(FiberCable.start_asset_id == start_asset_id)
    if end_asset_id is not None:
        stmt = stmt.where(FiberCable.end_asset_id == end_asset_id)
        count_stmt = count_stmt.where(FiberCable.end_asset_id == end_asset_id)
    if status:
        stmt = stmt.where(FiberCable.status == status)
        count_stmt = count_stmt.where(FiberCable.status == status)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_fiber_cable(db: Session, cable_id: int) -> FiberCable | None:
    return db.get(FiberCable, cable_id)


def create_fiber_cable(
    db: Session, payload: dict, *, user_id: int | None = None
) -> FiberCable:
    if db.scalar(
        select(FiberCable).where(FiberCable.cable_code == payload["cable_code"])
    ):
        raise problem(409, "Conflict", "Cable code already exists.")
    core_count = int(payload["core_count"])
    c = FiberCable(**payload)
    db.add(c)
    db.flush()
    # Auto-generate fiber cores 1..N with status="available"
    for n in range(1, core_count + 1):
        db.add(FiberCore(cable_id=c.id, core_number=n, status="available"))
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="fiber_cable.create",
        entity_type="fiber_cable",
        entity_id=str(c.id),
        new_value={**payload, "cores_autogenerated": core_count},
    )
    db.commit()
    db.refresh(c)
    return c


def update_fiber_cable(
    db: Session, c: FiberCable, payload: dict, *, user_id: int | None = None
) -> FiberCable:
    prev = {k: getattr(c, k) for k in payload if hasattr(c, k)}
    for k, v in payload.items():
        setattr(c, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="fiber_cable.update",
        entity_type="fiber_cable",
        entity_id=str(c.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(c)
    return c


def delete_fiber_cable(
    db: Session, c: FiberCable, *, user_id: int | None = None
) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="fiber_cable.delete",
        entity_type="fiber_cable",
        entity_id=str(c.id),
    )
    db.delete(c)
    db.commit()


# ── Fiber Cores ────────────────────────────────────────────────────────
def list_fiber_cores(
    db: Session,
    *,
    cable_id: int | None = None,
    status: str | None = None,
    offset: int = 0,
    limit: int = 100,
) -> tuple[list[FiberCore], int]:
    stmt = select(FiberCore)
    count_stmt = select(func.count(FiberCore.id))
    if cable_id is not None:
        stmt = stmt.where(FiberCore.cable_id == cable_id)
        count_stmt = count_stmt.where(FiberCore.cable_id == cable_id)
    if status:
        stmt = stmt.where(FiberCore.status == status)
        count_stmt = count_stmt.where(FiberCore.status == status)
    stmt = stmt.order_by(FiberCore.core_number.asc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_fiber_core(db: Session, core_id: int) -> FiberCore | None:
    return db.get(FiberCore, core_id)


def update_fiber_core(
    db: Session, core: FiberCore, payload: dict, *, user_id: int | None = None
) -> FiberCore:
    prev = {k: getattr(core, k) for k in payload if hasattr(core, k)}
    for k, v in payload.items():
        setattr(core, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="fiber_core.update",
        entity_type="fiber_core",
        entity_id=str(core.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(core)
    return core


def delete_fiber_core(
    db: Session, core: FiberCore, *, user_id: int | None = None
) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="fiber_core.delete",
        entity_type="fiber_core",
        entity_id=str(core.id),
    )
    db.delete(core)
    db.commit()


# ── Splices ────────────────────────────────────────────────────────────
def list_splices(
    db: Session,
    *,
    enclosure_asset_id: int | None = None,
    source_core_id: int | None = None,
    destination_core_id: int | None = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[Splice], int]:
    stmt = select(Splice)
    count_stmt = select(func.count(Splice.id))
    if enclosure_asset_id is not None:
        stmt = stmt.where(Splice.enclosure_asset_id == enclosure_asset_id)
        count_stmt = count_stmt.where(Splice.enclosure_asset_id == enclosure_asset_id)
    if source_core_id is not None:
        stmt = stmt.where(Splice.source_core_id == source_core_id)
        count_stmt = count_stmt.where(Splice.source_core_id == source_core_id)
    if destination_core_id is not None:
        stmt = stmt.where(Splice.destination_core_id == destination_core_id)
        count_stmt = count_stmt.where(Splice.destination_core_id == destination_core_id)
    stmt = stmt.order_by(Splice.spliced_at.desc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_splice(db: Session, splice_id: int) -> Splice | None:
    return db.get(Splice, splice_id)


def create_splice(
    db: Session, payload: dict, *, user_id: int | None = None
) -> Splice:
    s = Splice(**payload)
    db.add(s)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="splice.create",
        entity_type="splice",
        entity_id=str(s.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(s)
    return s


def delete_splice(db: Session, s: Splice, *, user_id: int | None = None) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="splice.delete",
        entity_type="splice",
        entity_id=str(s.id),
    )
    db.delete(s)
    db.commit()


# ── Splitter Ports ─────────────────────────────────────────────────────
def list_splitter_ports(
    db: Session,
    *,
    splitter_asset_id: int | None = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[SplitterPort], int]:
    stmt = select(SplitterPort)
    count_stmt = select(func.count(SplitterPort.id))
    if splitter_asset_id is not None:
        stmt = stmt.where(SplitterPort.splitter_asset_id == splitter_asset_id)
        count_stmt = count_stmt.where(
            SplitterPort.splitter_asset_id == splitter_asset_id
        )
    stmt = stmt.order_by(SplitterPort.port_index.asc())
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_splitter_port(db: Session, port_id: int) -> SplitterPort | None:
    return db.get(SplitterPort, port_id)


def create_splitter_port(
    db: Session, payload: dict, *, user_id: int | None = None
) -> SplitterPort:
    p = SplitterPort(**payload)
    db.add(p)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="splitter_port.create",
        entity_type="splitter_port",
        entity_id=str(p.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(p)
    return p


def update_splitter_port(
    db: Session, p: SplitterPort, payload: dict, *, user_id: int | None = None
) -> SplitterPort:
    prev = {k: getattr(p, k) for k in payload if hasattr(p, k)}
    for k, v in payload.items():
        setattr(p, k, v)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="splitter_port.update",
        entity_type="splitter_port",
        entity_id=str(p.id),
        previous_value=prev,
        new_value=payload,
    )
    db.commit()
    db.refresh(p)
    return p


# ── Customer Network Links ─────────────────────────────────────────────
def list_links(
    db: Session,
    *,
    customer_id: int | None = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[CustomerNetworkLink], int]:
    stmt = select(CustomerNetworkLink)
    count_stmt = select(func.count(CustomerNetworkLink.id))
    if customer_id is not None:
        stmt = stmt.where(CustomerNetworkLink.customer_id == customer_id)
        count_stmt = count_stmt.where(CustomerNetworkLink.customer_id == customer_id)
    total = db.scalar(count_stmt) or 0
    return list(db.scalars(stmt.offset(offset).limit(limit)).all()), total


def get_link(db: Session, link_id: int) -> CustomerNetworkLink | None:
    return db.get(CustomerNetworkLink, link_id)


def create_link(
    db: Session, payload: dict, *, user_id: int | None = None
) -> CustomerNetworkLink:
    link = CustomerNetworkLink(**payload)
    db.add(link)
    db.flush()
    write_audit(
        db,
        user_id=user_id,
        action="customer_network_link.create",
        entity_type="customer_network_link",
        entity_id=str(link.id),
        new_value=payload,
    )
    db.commit()
    db.refresh(link)
    return link


def delete_link(
    db: Session, link: CustomerNetworkLink, *, user_id: int | None = None
) -> None:
    write_audit(
        db,
        user_id=user_id,
        action="customer_network_link.delete",
        entity_type="customer_network_link",
        entity_id=str(link.id),
    )
    db.delete(link)
    db.commit()


# ── GIS / Map ──────────────────────────────────────────────────────────
def _row_to_map_item(row: tuple) -> MapItem:
    return MapItem(
        id=row[0],
        asset_code=row[1],
        asset_type=row[2],
        name=row[3],
        status=row[4],
        latitude=row[5],
        longitude=row[6],
    )


def _asset_to_map_item(a: NetworkAsset) -> MapItem:
    return MapItem(
        id=a.id,
        asset_code=a.asset_code,
        asset_type=a.asset_type,
        name=a.name,
        status=a.status,
        latitude=a.latitude,
        longitude=a.longitude,
    )


def get_map_bbox(
    db: Session,
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
    asset_type: str | None = None,
) -> list[MapItem]:
    """Return lightweight map items within the bounding box.

    Tries a PostGIS `geog && ST_MakeEnvelope` spatial query first (production),
    then falls back to plain lat/lon column filtering (SQLite/tests).
    """
    try:
        sql = (
            "SELECT id, asset_code, asset_type, name, status, latitude, longitude "
            "FROM network_assets "
            "WHERE geog && ST_MakeEnvelope(:min_lon, :min_lat, :max_lon, :max_lat, 4326)"
        )
        params: dict[str, object] = {
            "min_lon": min_lon,
            "min_lat": min_lat,
            "max_lon": max_lon,
            "max_lat": max_lat,
        }
        if asset_type:
            sql += " AND asset_type = :asset_type"
            params["asset_type"] = asset_type
        rows = db.execute(text(sql), params).fetchall()
        return [_row_to_map_item(r) for r in rows]
    except Exception:
        db.rollback()

    # Fallback: bounding-box filtering on latitude/longitude columns
    stmt = select(NetworkAsset).where(
        and_(
            NetworkAsset.latitude.is_not(None),
            NetworkAsset.longitude.is_not(None),
            NetworkAsset.latitude >= min_lat,
            NetworkAsset.latitude <= max_lat,
            NetworkAsset.longitude >= min_lon,
            NetworkAsset.longitude <= max_lon,
        )
    )
    if asset_type:
        stmt = stmt.where(NetworkAsset.asset_type == asset_type)
    return [_asset_to_map_item(a) for a in db.scalars(stmt).all()]


def nearby_assets(
    db: Session,
    lat: float,
    lon: float,
    radius_m: float = 100.0,
    asset_type: str | None = None,
) -> list[MapItem]:
    """Return map items within `radius_m` metres of (lat, lon).

    Tries a PostGIS `ST_DWithin` spatial query first (production), then falls
    back to a bounding-box pre-filter followed by a haversine distance check in
    Python (SQLite/tests).
    """
    try:
        sql = (
            "SELECT id, asset_code, asset_type, name, status, latitude, longitude "
            "FROM network_assets "
            "WHERE ST_DWithin(geog, ST_MakePoint(:lon, :lat)::geography, :radius)"
        )
        params: dict[str, object] = {"lat": lat, "lon": lon, "radius": radius_m}
        if asset_type:
            sql += " AND asset_type = :asset_type"
            params["asset_type"] = asset_type
        rows = db.execute(text(sql), params).fetchall()
        return [_row_to_map_item(r) for r in rows]
    except Exception:
        db.rollback()

    # Fallback: bounding-box pre-filter + haversine refinement in Python.
    # ~1 degree latitude ≈ 111_000 m; longitude scales by cos(lat).
    lat_delta = radius_m / 111_000.0
    cos_lat = max(abs(cos(radians(lat))), 1e-6)
    lon_delta = radius_m / (111_000.0 * cos_lat)
    stmt = select(NetworkAsset).where(
        and_(
            NetworkAsset.latitude.is_not(None),
            NetworkAsset.longitude.is_not(None),
            NetworkAsset.latitude >= lat - lat_delta,
            NetworkAsset.latitude <= lat + lat_delta,
            NetworkAsset.longitude >= lon - lon_delta,
            NetworkAsset.longitude <= lon + lon_delta,
        )
    )
    if asset_type:
        stmt = stmt.where(NetworkAsset.asset_type == asset_type)
    rows = db.scalars(stmt).all()
    return [
        _asset_to_map_item(a)
        for a in rows
        if _haversine_m(lat, lon, a.latitude, a.longitude) <= radius_m
    ]
