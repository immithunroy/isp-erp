"""Phase 7 — Network Trace tests."""
from sqlalchemy import select

from app.models.customers import Customer
from app.models.network import (
    CustomerNetworkLink,
    FiberCable,
    FiberCore,
    NetworkAsset,
    Splice,
    SplitterPort,
)


def _setup_trace_data(db_session):
    """Create a trace chain: OLT → Cable A → Core 1 → Splice → Core 2 (Cable B) → Splitter → Customer.
    Idempotent: checks for existing records before creating."""
    org_id = 1

    # Check if already set up
    existing_cust = db_session.scalar(
        select(Customer).where(Customer.customer_code == "TRACE-CUST")
    )
    if existing_cust:
        olt = db_session.scalar(
            select(NetworkAsset).where(NetworkAsset.asset_code == "TRACE-OLT")
        )
        enc = db_session.scalar(
            select(NetworkAsset).where(NetworkAsset.asset_code == "TRACE-ENC")
        )
        ca = db_session.scalar(
            select(FiberCable).where(FiberCable.cable_code == "TRACE-FIBA")
        )
        cb = db_session.scalar(
            select(FiberCable).where(FiberCable.cable_code == "TRACE-FIBB")
        )
        spl = db_session.scalar(
            select(NetworkAsset).where(NetworkAsset.asset_code == "TRACE-SPL")
        )
        cores_a = db_session.scalars(
            select(FiberCore).where(FiberCore.cable_id == ca.id)
        ).all() if ca else []
        cores_b = db_session.scalars(
            select(FiberCore).where(FiberCore.cable_id == cb.id)
        ).all() if cb else []
        # Check splice connects correct cores (source from cable A, dest from cable B)
        splice = None
        if cores_a and cores_b:
            splice = db_session.scalar(
                select(Splice).where(
                    Splice.source_core_id == cores_a[0].id,
                    Splice.destination_core_id == cores_b[0].id,
                )
            )
        # Check splitter port connects to correct core on cable B
        port = None
        if cores_b and spl:
            port = db_session.scalar(
                select(SplitterPort).where(
                    SplitterPort.connected_core_id == cores_b[1].id,
                )
            )
        link = db_session.scalar(
            select(CustomerNetworkLink).where(
                CustomerNetworkLink.customer_id == existing_cust.id
            )
        )
        return {
            "olt": olt, "cable_a": ca, "cable_b": cb,
            "cores_a": cores_a, "cores_b": cores_b,
            "splice": splice, "splitter": spl,
            "port": port, "customer": existing_cust, "link": link,
        }

    # OLT asset
    olt = db_session.scalar(
        select(NetworkAsset).where(NetworkAsset.asset_code == "TRACE-OLT")
    )
    if not olt:
        olt = NetworkAsset(
            organization_id=org_id, asset_code="TRACE-OLT", asset_type="olt",
            name="Main OLT", status="active", latitude=23.81, longitude=90.41,
        )
        db_session.add(olt)
        db_session.flush()

    # Enclosure
    enc = db_session.scalar(
        select(NetworkAsset).where(NetworkAsset.asset_code == "TRACE-ENC")
    )
    if not enc:
        enc = NetworkAsset(
            organization_id=org_id, asset_code="TRACE-ENC", asset_type="enclosure",
            name="Street Enclosure", status="active",
        )
        db_session.add(enc)
        db_session.flush()

    # Cable A (OLT → Enclosure)
    cable_a = db_session.scalar(
        select(FiberCable).where(FiberCable.cable_code == "TRACE-FIBA")
    )
    if not cable_a:
        cable_a = FiberCable(
            organization_id=org_id, cable_code="TRACE-FIBA", name="Cable A",
            cable_type="underground", core_count=4,
            start_asset_id=olt.id, end_asset_id=enc.id, status="active",
        )
        db_session.add(cable_a)
        db_session.flush()

    # Cores for Cable A
    cores_a = db_session.scalars(
        select(FiberCore).where(FiberCore.cable_id == cable_a.id)
    ).all() if cable_a else []
    if not cores_a:
        cores_a = []
        for i in range(1, 5):
            c = FiberCore(cable_id=cable_a.id, core_number=i, status="available")
            db_session.add(c)
            cores_a.append(c)
        db_session.flush()

    # Cable B (Enclosure → Splitter)
    splitter = db_session.scalar(
        select(NetworkAsset).where(NetworkAsset.asset_code == "TRACE-SPL")
    )
    if not splitter:
        splitter = NetworkAsset(
            organization_id=org_id, asset_code="TRACE-SPL", asset_type="splitter",
            name="Splitter1:8", status="active",
        )
        db_session.add(splitter)
        db_session.flush()

    cable_b = db_session.scalar(
        select(FiberCable).where(FiberCable.cable_code == "TRACE-FIBB")
    )
    if not cable_b:
        cable_b = FiberCable(
            organization_id=org_id, cable_code="TRACE-FIBB", name="Cable B",
            cable_type="aerial", core_count=2,
            start_asset_id=enc.id, end_asset_id=splitter.id, status="active",
        )
        db_session.add(cable_b)
        db_session.flush()

    cores_b = db_session.scalars(
        select(FiberCore).where(FiberCore.cable_id == cable_b.id)
    ).all() if cable_b else []
    if not cores_b:
        cores_b = []
        for i in range(1, 3):
            c = FiberCore(cable_id=cable_b.id, core_number=i, status="available")
            db_session.add(c)
            cores_b.append(c)
        db_session.flush()

    # Splice: Cable A Core 1 → Cable B Core 1
    splice = db_session.scalar(
        select(Splice).where(
            Splice.source_core_id == cores_a[0].id,
            Splice.destination_core_id == cores_b[0].id,
        )
    ) if cores_a and cores_b else None
    if not splice:
        splice = Splice(
            enclosure_asset_id=enc.id,
            source_core_id=cores_a[0].id,
            destination_core_id=cores_b[0].id,
            splice_loss=0.3,
        )
        db_session.add(splice)
        db_session.flush()

    # Splitter port connected to Cable B Core 2
    port = db_session.scalar(
        select(SplitterPort).where(
            SplitterPort.connected_core_id == cores_b[1].id,
        )
    ) if cores_b else None
    if not port:
        port = SplitterPort(
            splitter_asset_id=splitter.id, port_kind="output", port_index=1,
            connected_core_id=cores_b[1].id, status="in_use",
        )
        db_session.add(port)
        db_session.flush()

    # Customer
    cust = db_session.scalar(
        select(Customer).where(Customer.customer_code == "TRACE-CUST")
    )
    if not cust:
        cust = Customer(
            organization_id=org_id, customer_code="TRACE-CUST",
            name="Test Customer", phone="1234567890", status="active",
        )
        db_session.add(cust)
        db_session.flush()

    # Customer network link via splitter port
    link = db_session.scalar(
        select(CustomerNetworkLink).where(
            CustomerNetworkLink.customer_id == cust.id
        )
    )
    if not link:
        link = CustomerNetworkLink(
            customer_id=cust.id, link_kind="splitter_port",
            target_asset_id=splitter.id, target_port_index=1,
        )
        db_session.add(link)
    db_session.commit()

    return {
        "olt": olt, "cable_a": cable_a, "cable_b": cable_b,
        "cores_a": cores_a, "cores_b": cores_b,
        "splice": splice, "splitter": splitter,
        "port": port, "customer": cust, "link": link,
    }


def test_trace_customer_to_olt(seeded_client, auth_headers, db_session):
    data = _setup_trace_data(db_session)

    resp = seeded_client.get(
        f"/api/v1/network/trace/customer/{data['customer'].id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["direction"] == "customer_to_olt"
    assert result["found"] is True
    assert len(result["nodes"]) >= 5

    # First node should be the customer
    assert result["nodes"][0]["kind"] == "customer"
    assert result["nodes"][0]["id"] == data["customer"].id

    # Should contain an OLT node
    olt_nodes = [
        n for n in result["nodes"]
        if n["kind"] == "network_asset"
        and n["detail"].get("asset_type") == "olt"
    ]
    assert len(olt_nodes) >= 1

    # Should contain fiber cables
    cable_nodes = [n for n in result["nodes"] if n["kind"] == "fiber_cable"]
    assert len(cable_nodes) >= 2

    # Should contain splices
    splice_nodes = [n for n in result["nodes"] if n["kind"] == "splice"]
    assert len(splice_nodes) >= 1


def test_trace_customer_not_found(seeded_client, auth_headers):
    resp = seeded_client.get(
        "/api/v1/network/trace/customer/99999",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["found"] is False
    assert resp.json()["error"] is not None


def test_trace_customer_no_link(seeded_client, auth_headers, db_session):
    cust = Customer(
        organization_id=1, customer_code="CUST-NOLINK",
        name="No Link Customer", status="active",
    )
    db_session.add(cust)
    db_session.commit()

    resp = seeded_client.get(
        f"/api/v1/network/trace/customer/{cust.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["found"] is False
    assert "No network link" in (resp.json()["error"] or "")


def test_trace_olt_to_customers(seeded_client, auth_headers, db_session):
    data = _setup_trace_data(db_session)

    resp = seeded_client.get(
        f"/api/v1/network/trace/olt/{data['olt'].id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) >= 1

    found = [r for r in results if r["found"]]
    assert len(found) >= 1

    cust_nodes = [n for n in found[0]["nodes"] if n["kind"] == "customer"]
    assert len(cust_nodes) >= 1


def test_trace_core(seeded_client, auth_headers, db_session):
    data = _setup_trace_data(db_session)
    core_id = data["cores_a"][0].id

    resp = seeded_client.get(
        f"/api/v1/network/trace/core/{core_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["found"] is True
    assert len(result["nodes"]) >= 2

    core_nodes = [n for n in result["nodes"] if n["kind"] == "fiber_core"]
    assert len(core_nodes) >= 1


def test_trace_unauthenticated(client):
    for path in [
        "/api/v1/network/trace/customer/1",
        "/api/v1/network/trace/olt/1",
        "/api/v1/network/trace/core/1",
    ]:
        resp = client.get(path)
        assert resp.status_code == 401, path
