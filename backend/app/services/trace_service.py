"""Network trace: walks explicit DB relationships, never geographic proximity.

Trace path (customer → OLT):
  Customer → CustomerNetworkLink → SplitterPort → FiberCore (connected)
  → Splice (source_core) → FiberCore (destination) → Splice → ... → OLT

Reverse trace (OLT → customer):
  OLT → FiberCable (start_asset=OLT) → FiberCore → Splice (destination_core) → ...
  → SplitterPort (connected_core) → CustomerNetworkLink → Customer
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customers import Customer
from app.models.network import (
    CustomerNetworkLink,
    FiberCable,
    FiberCore,
    NetworkAsset,
    Splice,
    SplitterPort,
)


@dataclass
class TraceNode:
    """A single hop in a network trace."""
    kind: str  # customer | network_asset | fiber_cable | fiber_core | splice | splitter_port
    id: int
    label: str
    detail: dict = field(default_factory=dict)


@dataclass
class TraceResult:
    """Full trace result."""
    direction: str  # "customer_to_olt" | "olt_to_customer"
    nodes: list[TraceNode] = field(default_factory=list)
    found: bool = False
    error: str | None = None


def _node_asset(a: NetworkAsset) -> TraceNode:
    return TraceNode(
        kind="network_asset",
        id=a.id,
        label=f"{a.asset_type}: {a.name} ({a.asset_code})",
        detail={"asset_type": a.asset_type, "status": a.status,
                "lat": a.latitude, "lon": a.longitude},
    )


def _node_core(c: FiberCore, cable: FiberCable | None = None) -> TraceNode:
    label = f"Core {c.core_number}"
    if cable:
        label += f" on {cable.cable_code}"
    return TraceNode(
        kind="fiber_core",
        id=c.id,
        label=label,
        detail={"core_number": c.core_number, "status": c.status,
                "color": c.color, "related_customer_id": c.related_customer_id},
    )


def _node_splice(s: Splice) -> TraceNode:
    return TraceNode(
        kind="splice",
        id=s.id,
        label=f"Splice #{s.id}",
        detail={"splice_loss": float(s.splice_loss) if s.splice_loss else None,
                "enclosure_asset_id": s.enclosure_asset_id},
    )


def _node_splitter_port(p: SplitterPort) -> TraceNode:
    return TraceNode(
        kind="splitter_port",
        id=p.id,
        label=f"{p.port_kind} port {p.port_index}",
        detail={"port_kind": p.port_kind, "port_index": p.port_index,
                "status": p.status, "connected_core_id": p.connected_core_id},
    )


def _node_customer(cu: Customer) -> TraceNode:
    return TraceNode(
        kind="customer",
        id=cu.id,
        label=f"Customer: {cu.name} ({cu.customer_code})",
        detail={"customer_code": cu.customer_code, "status": cu.status},
    )


# ── Customer → OLT trace ────────────────────────────────────────────────

def trace_customer_to_olt(db: Session, customer_id: int) -> TraceResult:
    result = TraceResult(direction="customer_to_olt")
    customer = db.get(Customer, customer_id)
    if not customer:
        result.error = "Customer not found."
        return result

    result.nodes.append(_node_customer(customer))

    # Step 1: Customer → CustomerNetworkLink
    links = db.scalars(
        select(CustomerNetworkLink).where(
            CustomerNetworkLink.customer_id == customer_id
        )
    ).all()
    if not links:
        result.error = "No network link found for this customer."
        return result

    for link in links:
        result.nodes.append(
            TraceNode(
                kind="customer_network_link",
                id=link.id,
                label=f"Link: {link.link_kind}",
                detail={"link_kind": link.link_kind,
                         "target_asset_id": link.target_asset_id,
                         "target_core_id": link.target_core_id},
            )
        )

        # Step 2: If link → splitter port, find connected fiber core
        core: FiberCore | None = None
        if link.link_kind == "splitter_port" and link.target_asset_id:
            port = db.scalar(
                select(SplitterPort).where(
                    SplitterPort.splitter_asset_id == link.target_asset_id,
                    SplitterPort.port_index == (link.target_port_index or 0),
                )
            )
            if port and port.connected_core_id:
                core = db.get(FiberCore, port.connected_core_id)
                if port:
                    result.nodes.append(_node_splitter_port(port))

        # Step 3: If link → core directly
        if not core and link.target_core_id:
            core = db.get(FiberCore, link.target_core_id)

        if not core:
            # Try to find any core that references this customer
            core = db.scalar(
                select(FiberCore).where(
                    FiberCore.related_customer_id == customer_id
                )
            )

        if not core:
            continue

        # Step 4: Walk splices from this core upstream to OLT
        _walk_core_upstream(db, core, result)

    result.found = len(result.nodes) > 1
    return result


def _walk_core_upstream(db: Session, core: FiberCore, result: TraceResult) -> None:
    """Walk splice chain from a fiber core upstream until we reach an OLT or exhaust splices.

    The trace walks through explicit DB relationships:
    core → cable → splices (where this cable's cores are destinations)
    → source cores → their cables → ... → OLT

    When a specific core has no splice where it's the destination, we check ALL
    cores on the same cable — any sibling core that has a splice gives us the
    upstream path. This handles splitters that connect to a specific core while
    the splice chain runs through a different core on the same cable.
    """
    visited: set[int] = set()
    current_core = core

    while current_core and current_core.id not in visited:
        visited.add(current_core.id)
        cable = db.get(FiberCable, current_core.cable_id) if current_core.cable_id else None
        if cable:
            result.nodes.append(
                TraceNode(
                    kind="fiber_cable",
                    id=cable.id,
                    label=f"Cable: {cable.cable_code} ({cable.core_count} cores)",
                    detail={"cable_code": cable.cable_code,
                             "core_count": cable.core_count,
                             "start_asset_id": cable.start_asset_id,
                             "end_asset_id": cable.end_asset_id},
                )
            )
        result.nodes.append(_node_core(current_core, cable))

        # Find splice where this core is the destination (upstream direction)
        splice = db.scalar(
            select(Splice).where(Splice.destination_core_id == current_core.id)
        )
        if splice:
            result.nodes.append(_node_splice(splice))
            source_core = db.get(FiberCore, splice.source_core_id)
            if source_core:
                current_core = source_core
                continue
            else:
                break
        else:
            # No splice on THIS core — check ALL sibling cores on the same cable
            # for splices where they are the destination
            found_upstream = False
            if cable:
                sibling_cores = db.scalars(
                    select(FiberCore).where(
                        FiberCore.cable_id == cable.id,
                        FiberCore.id != current_core.id,
                    )
                ).all()
                for sib in sibling_cores:
                    sib_splice = db.scalar(
                        select(Splice).where(
                            Splice.destination_core_id == sib.id
                        )
                    )
                    if sib_splice:
                        result.nodes.append(_node_core(sib, cable))
                        result.nodes.append(_node_splice(sib_splice))
                        source_core = db.get(FiberCore, sib_splice.source_core_id)
                        if source_core:
                            current_core = source_core
                            found_upstream = True
                            break

            if found_upstream:
                continue

            # No splice upstream at all — check if cable start asset is OLT
            if cable and cable.start_asset_id:
                start_asset = db.get(NetworkAsset, cable.start_asset_id)
                if start_asset and start_asset.asset_type == "olt":
                    result.nodes.append(_node_asset(start_asset))
                    result.found = True
                    return
            # No more upstream path
            break

    # Check if current cable's start asset is OLT
    if cable and cable.start_asset_id:
        start_asset = db.get(NetworkAsset, cable.start_asset_id)
        if start_asset and start_asset.asset_type == "olt":
            result.nodes.append(_node_asset(start_asset))
            result.found = True


# ── OLT → Customer trace (reverse) ──────────────────────────────────────

def trace_olt_to_customers(db: Session, olt_asset_id: int) -> list[TraceResult]:
    """Trace from an OLT asset to all connected customers (reverse trace)."""
    results: list[TraceResult] = []

    # Find all fiber cables starting from this OLT
    cables = db.scalars(
        select(FiberCable).where(FiberCable.start_asset_id == olt_asset_id)
    ).all()
    if not cables:
        return results

    for cable in cables:
        # Walk downstream through each cable's cores
        cores = db.scalars(
            select(FiberCore).where(FiberCore.cable_id == cable.id)
        ).all()
        for core in cores:
            trace = TraceResult(direction="olt_to_customer")
            olt = db.get(NetworkAsset, olt_asset_id)
            if olt:
                trace.nodes.append(_node_asset(olt))
            trace.nodes.append(
                TraceNode(
                    kind="fiber_cable",
                    id=cable.id,
                    label=f"Cable: {cable.cable_code}",
                    detail={"cable_code": cable.cable_code, "core_count": cable.core_count},
                )
            )
            _walk_core_downstream(db, core, trace, results)

    return results


def _find_customer_via_port(
    db: Session, port: SplitterPort, trace: TraceResult, results: list[TraceResult]
) -> None:
    """Find customer network links via a splitter port and append to results."""
    links = db.scalars(
        select(CustomerNetworkLink).where(
            CustomerNetworkLink.target_asset_id == port.splitter_asset_id,
            CustomerNetworkLink.target_port_index == port.port_index,
        )
    ).all()
    for link in links:
        customer = db.get(Customer, link.customer_id)
        if customer:
            trace.nodes.append(_node_customer(customer))
            trace.found = True
            results.append(trace)


def _walk_core_downstream(
    db: Session, core: FiberCore, trace: TraceResult, results: list[TraceResult]
) -> None:
    """Walk splice chain from a fiber core downstream to customers."""
    visited: set[int] = set()
    current_core = core

    while current_core and current_core.id not in visited:
        visited.add(current_core.id)
        trace.nodes.append(_node_core(current_core))

        # Check if this core is directly linked to a customer
        if current_core.related_customer_id:
            customer = db.get(Customer, current_core.related_customer_id)
            if customer:
                trace.nodes.append(_node_customer(customer))
                trace.found = True
                results.append(trace)
                return

        # Find splice where this core is the source (downstream direction)
        splice = db.scalar(
            select(Splice).where(Splice.source_core_id == current_core.id)
        )
        if splice:
            trace.nodes.append(_node_splice(splice))
            dest_core = db.get(FiberCore, splice.destination_core_id)
            if dest_core:
                current_core = dest_core
                continue
            else:
                break
        else:
            # No splice on THIS core — check ALL sibling cores on same cable
            # for splices where they are the source (downstream)
            found_downstream = False
            cable = db.get(FiberCable, current_core.cable_id) if current_core.cable_id else None
            if cable:
                sibling_cores = db.scalars(
                    select(FiberCore).where(
                        FiberCore.cable_id == cable.id,
                        FiberCore.id != current_core.id,
                    )
                ).all()
                for sib in sibling_cores:
                    sib_splice = db.scalar(
                        select(Splice).where(
                            Splice.source_core_id == sib.id
                        )
                    )
                    if sib_splice:
                        trace.nodes.append(_node_core(sib, cable))
                        trace.nodes.append(_node_splice(sib_splice))
                        dest_core = db.get(FiberCore, sib_splice.destination_core_id)
                        if dest_core:
                            current_core = dest_core
                            found_downstream = True
                            break

            if found_downstream:
                continue

            # No splice downstream at all — check splitter ports on THIS core
            ports = db.scalars(
                select(SplitterPort).where(
                    SplitterPort.connected_core_id == current_core.id
                )
            ).all()
            for port in ports:
                _find_customer_via_port(db, port, trace, results)

            # Also check splitter ports on SIBLING cores (same cable)
            if not ports and cable:
                for sib in sibling_cores:
                    sib_ports = db.scalars(
                        select(SplitterPort).where(
                            SplitterPort.connected_core_id == sib.id
                        )
                    ).all()
                    for port in sib_ports:
                        trace.nodes.append(_node_core(sib, cable))
                        trace.nodes.append(_node_splitter_port(port))
                        _find_customer_via_port(db, port, trace, results)
            break


# ── Fiber core trace ─────────────────────────────────────────────────

def trace_core(db: Session, core_id: int) -> TraceResult:
    """Trace a single fiber core: show its cable, splices, and both endpoints."""
    result = TraceResult(direction="core_trace")
    core = db.get(FiberCore, core_id)
    if not core:
        result.error = "Fiber core not found."
        return result

    cable = db.get(FiberCable, core.cable_id) if core.cable_id else None
    if cable:
        result.nodes.append(
            TraceNode(
                kind="fiber_cable",
                id=cable.id,
                label=f"Cable: {cable.cable_code}",
                detail={"cable_code": cable.cable_code, "core_count": cable.core_count},
            )
        )
    result.nodes.append(_node_core(core, cable))

    # Upstream splice (this core is destination)
    up_splice = db.scalar(
        select(Splice).where(Splice.destination_core_id == core_id)
    )
    if up_splice:
        result.nodes.append(_node_splice(up_splice))
        src = db.get(FiberCore, up_splice.source_core_id)
        if src:
            result.nodes.append(_node_core(src))

    # Downstream splice (this core is source)
    down_splice = db.scalar(
        select(Splice).where(Splice.source_core_id == core_id)
    )
    if down_splice:
        result.nodes.append(_node_splice(down_splice))
        dst = db.get(FiberCore, down_splice.destination_core_id)
        if dst:
            result.nodes.append(_node_core(dst))

    result.found = True
    return result
