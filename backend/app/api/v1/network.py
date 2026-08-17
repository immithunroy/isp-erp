from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.db.session import get_db
from app.errors import problem
from app.models.core import User
from app.pagination import Page, PaginationParams, paginate
from app.schemas.network import (
    CustomerNetworkLinkCreate,
    CustomerNetworkLinkOut,
    FiberCableCreate,
    FiberCableOut,
    FiberCableUpdate,
    FiberCoreOut,
    FiberCoreUpdate,
    MapItem,
    NetworkAssetCreate,
    NetworkAssetOut,
    NetworkAssetUpdate,
    SpliceCreate,
    SpliceOut,
    SplitterPortCreate,
    SplitterPortOut,
    SplitterPortUpdate,
)
from app.services import network_service

# ── Network Assets ─────────────────────────────────────────────────────
assets_router = APIRouter(prefix="/network/assets", tags=["network-assets"])


@assets_router.get("", response_model=Page[NetworkAssetOut])
async def list_assets(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    asset_type: str | None = Query(None),
    status: str | None = Query(None),
    parent_asset_id: int | None = Query(None),
    is_active: bool | None = Query(None),
    _: Annotated[User, Depends(require_permission("network:assets:read"))] = None,
):
    rows, total = network_service.list_assets(
        db,
        search=search,
        organization_id=organization_id,
        asset_type=asset_type,
        status=status,
        parent_asset_id=parent_asset_id,
        is_active=is_active,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@assets_router.get("/{asset_id}", response_model=NetworkAssetOut)
async def get_asset(
    asset_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("network:assets:read"))] = None,
):
    a = network_service.get_asset(db, asset_id)
    if not a:
        raise problem(404, "Not Found", "Network asset not found.")
    return a


@assets_router.post(
    "",
    response_model=NetworkAssetOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_asset(
    payload: NetworkAssetCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:assets:write"))],
):
    return network_service.create_asset(db, payload.model_dump(), user_id=user.id)


@assets_router.put("/{asset_id}", response_model=NetworkAssetOut)
async def update_asset(
    asset_id: int,
    payload: NetworkAssetUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:assets:write"))],
):
    a = network_service.get_asset(db, asset_id)
    if not a:
        raise problem(404, "Not Found", "Network asset not found.")
    return network_service.update_asset(
        db, a, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@assets_router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:assets:write"))],
):
    a = network_service.get_asset(db, asset_id)
    if not a:
        raise problem(404, "Not Found", "Network asset not found.")
    network_service.delete_asset(db, a, user_id=user.id)
    return None


# ── Fiber Cables ───────────────────────────────────────────────────────
fiber_router = APIRouter(prefix="/network/fiber", tags=["fiber-cables"])


@fiber_router.get("", response_model=Page[FiberCableOut])
async def list_fiber_cables(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    search: str | None = Query(None),
    organization_id: int | None = Query(None),
    start_asset_id: int | None = Query(None),
    end_asset_id: int | None = Query(None),
    status: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("network:fiber:read"))] = None,
):
    rows, total = network_service.list_fiber_cables(
        db,
        search=search,
        organization_id=organization_id,
        start_asset_id=start_asset_id,
        end_asset_id=end_asset_id,
        status=status,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@fiber_router.get("/{cable_id}", response_model=FiberCableOut)
async def get_fiber_cable(
    cable_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("network:fiber:read"))] = None,
):
    c = network_service.get_fiber_cable(db, cable_id)
    if not c:
        raise problem(404, "Not Found", "Fiber cable not found.")
    return c


@fiber_router.post(
    "",
    response_model=FiberCableOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_fiber_cable(
    payload: FiberCableCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:fiber:write"))],
):
    return network_service.create_fiber_cable(
        db, payload.model_dump(), user_id=user.id
    )


@fiber_router.put("/{cable_id}", response_model=FiberCableOut)
async def update_fiber_cable(
    cable_id: int,
    payload: FiberCableUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:fiber:write"))],
):
    c = network_service.get_fiber_cable(db, cable_id)
    if not c:
        raise problem(404, "Not Found", "Fiber cable not found.")
    return network_service.update_fiber_cable(
        db, c, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@fiber_router.delete("/{cable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fiber_cable(
    cable_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:fiber:write"))],
):
    c = network_service.get_fiber_cable(db, cable_id)
    if not c:
        raise problem(404, "Not Found", "Fiber cable not found.")
    network_service.delete_fiber_cable(db, c, user_id=user.id)
    return None


# ── Fiber Cores ────────────────────────────────────────────────────────
fiber_cores_router = APIRouter(prefix="/network/fiber-cores", tags=["fiber-cores"])


@fiber_cores_router.get("", response_model=Page[FiberCoreOut])
async def list_fiber_cores(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    cable_id: int | None = Query(None),
    status: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("network:fiber:read"))] = None,
):
    rows, total = network_service.list_fiber_cores(
        db,
        cable_id=cable_id,
        status=status,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@fiber_cores_router.get("/{core_id}", response_model=FiberCoreOut)
async def get_fiber_core(
    core_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("network:fiber:read"))] = None,
):
    core = network_service.get_fiber_core(db, core_id)
    if not core:
        raise problem(404, "Not Found", "Fiber core not found.")
    return core


@fiber_cores_router.put("/{core_id}", response_model=FiberCoreOut)
async def update_fiber_core(
    core_id: int,
    payload: FiberCoreUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:fiber:write"))],
):
    core = network_service.get_fiber_core(db, core_id)
    if not core:
        raise problem(404, "Not Found", "Fiber core not found.")
    return network_service.update_fiber_core(
        db, core, payload.model_dump(exclude_unset=True), user_id=user.id
    )


@fiber_cores_router.delete("/{core_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fiber_core(
    core_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:fiber:write"))],
):
    core = network_service.get_fiber_core(db, core_id)
    if not core:
        raise problem(404, "Not Found", "Fiber core not found.")
    network_service.delete_fiber_core(db, core, user_id=user.id)
    return None


# ── Splices ────────────────────────────────────────────────────────────
splices_router = APIRouter(prefix="/network/splices", tags=["splices"])


@splices_router.get("", response_model=Page[SpliceOut])
async def list_splices(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    enclosure_asset_id: int | None = Query(None),
    source_core_id: int | None = Query(None),
    destination_core_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("network:splices:read"))] = None,
):
    rows, total = network_service.list_splices(
        db,
        enclosure_asset_id=enclosure_asset_id,
        source_core_id=source_core_id,
        destination_core_id=destination_core_id,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@splices_router.post(
    "",
    response_model=SpliceOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_splice(
    payload: SpliceCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:splices:write"))],
):
    return network_service.create_splice(
        db, payload.model_dump(), user_id=user.id
    )


@splices_router.delete("/{splice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_splice(
    splice_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:splices:write"))],
):
    s = network_service.get_splice(db, splice_id)
    if not s:
        raise problem(404, "Not Found", "Splice not found.")
    network_service.delete_splice(db, s, user_id=user.id)
    return None


# ── Splitter Ports ─────────────────────────────────────────────────────
splitter_ports_router = APIRouter(
    prefix="/network/splitter-ports", tags=["splitter-ports"],
)


@splitter_ports_router.get("", response_model=Page[SplitterPortOut])
async def list_splitter_ports(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    splitter_asset_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("network:assets:read"))] = None,
):
    rows, total = network_service.list_splitter_ports(
        db,
        splitter_asset_id=splitter_asset_id,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@splitter_ports_router.post(
    "",
    response_model=SplitterPortOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_splitter_port(
    payload: SplitterPortCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:assets:write"))],
):
    return network_service.create_splitter_port(
        db, payload.model_dump(), user_id=user.id
    )


@splitter_ports_router.put("/{port_id}", response_model=SplitterPortOut)
async def update_splitter_port(
    port_id: int,
    payload: SplitterPortUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:assets:write"))],
):
    p = network_service.get_splitter_port(db, port_id)
    if not p:
        raise problem(404, "Not Found", "Splitter port not found.")
    return network_service.update_splitter_port(
        db, p, payload.model_dump(exclude_unset=True), user_id=user.id
    )


# ── Customer Network Links ─────────────────────────────────────────────
customer_links_router = APIRouter(
    prefix="/network/customer-links", tags=["customer-network-links"],
)


@customer_links_router.get("", response_model=Page[CustomerNetworkLinkOut])
async def list_customer_network_links(
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends()],
    customer_id: int | None = Query(None),
    _: Annotated[User, Depends(require_permission("network:assets:read"))] = None,
):
    rows, total = network_service.list_links(
        db,
        customer_id=customer_id,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return paginate(rows, total, pagination)


@customer_links_router.post(
    "",
    response_model=CustomerNetworkLinkOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_customer_network_link(
    payload: CustomerNetworkLinkCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:assets:write"))],
):
    return network_service.create_link(
        db, payload.model_dump(), user_id=user.id
    )


@customer_links_router.delete(
    "/{link_id}", status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_customer_network_link(
    link_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("network:assets:write"))],
):
    link = network_service.get_link(db, link_id)
    if not link:
        raise problem(404, "Not Found", "Customer network link not found.")
    network_service.delete_link(db, link, user_id=user.id)
    return None


# ── Network Map / GIS ──────────────────────────────────────────────────
map_router = APIRouter(prefix="/network/map", tags=["network-map"])


@map_router.get("", response_model=list[MapItem])
async def get_map(
    db: Annotated[Session, Depends(get_db)],
    min_lon: float = Query(..., description="Minimum longitude"),
    min_lat: float = Query(..., description="Minimum latitude"),
    max_lon: float = Query(..., description="Maximum longitude"),
    max_lat: float = Query(..., description="Maximum latitude"),
    asset_type: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("network:map:read"))] = None,
):
    return network_service.get_map_bbox(
        db, min_lon, min_lat, max_lon, max_lat, asset_type=asset_type
    )


@map_router.get("/nearby", response_model=list[MapItem])
async def get_nearby(
    db: Annotated[Session, Depends(get_db)],
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_m: float = Query(100.0, ge=0, description="Search radius in metres"),
    asset_type: str | None = Query(None),
    _: Annotated[User, Depends(require_permission("network:map:read"))] = None,
):
    return network_service.nearby_assets(
        db, lat, lon, radius_m=radius_m, asset_type=asset_type
    )
