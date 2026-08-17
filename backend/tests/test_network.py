"""Phase 6 — Network GIS tests: assets, fiber cables/cores, splices, splitters,
customer links, and map/bbox/nearby spatial queries.
"""


# ── Network Assets ─────────────────────────────────────────────────────
def test_create_and_list_assets(seeded_client, auth_headers):
    # create OLT asset
    resp = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "OLT-001",
            "asset_type": "olt",
            "name": "Main OLT",
            "latitude": 23.8103,
            "longitude": 90.4125,
            "capacity": 1024,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    aid = resp.json()["id"]
    assert resp.json()["asset_code"] == "OLT-001"
    assert resp.json()["asset_type"] == "olt"
    assert resp.json()["status"] == "active"
    assert resp.json()["capacity"] == 1024
    assert resp.json()["latitude"] == 23.8103

    # list
    resp = seeded_client.get("/api/v1/network/assets", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # filter by asset_type
    resp = seeded_client.get(
        "/api/v1/network/assets?asset_type=olt", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(a["id"] == aid for a in resp.json()["items"])

    # filter by organization_id
    resp = seeded_client.get(
        "/api/v1/network/assets?organization_id=1", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(a["id"] == aid for a in resp.json()["items"])

    # search by name
    resp = seeded_client.get(
        "/api/v1/network/assets?search=Main%20OLT", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(a["id"] == aid for a in resp.json()["items"])

    # search by code
    resp = seeded_client.get(
        "/api/v1/network/assets?search=OLT-001", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(a["id"] == aid for a in resp.json()["items"])

    # get by id
    resp = seeded_client.get(
        f"/api/v1/network/assets/{aid}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == aid

    # update
    resp = seeded_client.put(
        f"/api/v1/network/assets/{aid}",
        json={"name": "Main OLT Updated", "status": "maintenance", "capacity": 2048},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Main OLT Updated"
    assert resp.json()["status"] == "maintenance"
    assert resp.json()["capacity"] == 2048

    # delete
    resp = seeded_client.delete(
        f"/api/v1/network/assets/{aid}", headers=auth_headers
    )
    assert resp.status_code == 204

    # subsequent get should 404
    resp = seeded_client.get(
        f"/api/v1/network/assets/{aid}", headers=auth_headers
    )
    assert resp.status_code == 404


def test_duplicate_asset_code(seeded_client, auth_headers):
    seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "DUP-ASSET",
            "asset_type": "olt",
            "name": "Asset A",
        },
        headers=auth_headers,
    )
    resp = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "DUP-ASSET",
            "asset_type": "olt",
            "name": "Asset B",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409


def test_get_asset_not_found(seeded_client, auth_headers):
    resp = seeded_client.get(
        "/api/v1/network/assets/999999", headers=auth_headers
    )
    assert resp.status_code == 404


# ── Fiber Cables + Auto Core Generation ────────────────────────────────
def test_create_fiber_cable_with_auto_cores(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "CABLE-48",
            "name": "48-Core Cable",
            "cable_type": "single_mode",
            "core_count": 48,
            "length_m": 1500.0,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    cable_id = resp.json()["id"]
    assert resp.json()["cable_code"] == "CABLE-48"
    assert resp.json()["core_count"] == 48
    assert resp.json()["cable_type"] == "single_mode"
    assert float(resp.json()["length_m"]) == 1500.0

    # list cores — should be 48, numbered 1..48, all "available"
    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_id}&page_size=100",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 48
    core_numbers = sorted(c["core_number"] for c in data["items"])
    assert core_numbers == list(range(1, 49))
    statuses = {c["status"] for c in data["items"]}
    assert statuses == {"available"}


def test_list_fiber_cables(seeded_client, auth_headers):
    seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "CABLE-LIST-1",
            "name": "Backbone Cable A",
            "core_count": 12,
        },
        headers=auth_headers,
    )
    seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "CABLE-LIST-2",
            "name": "Distribution Cable B",
            "core_count": 24,
        },
        headers=auth_headers,
    )

    # list all
    resp = seeded_client.get("/api/v1/network/fiber", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2

    # search by name
    resp = seeded_client.get(
        "/api/v1/network/fiber?search=Backbone", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(c["cable_code"] == "CABLE-LIST-1" for c in resp.json()["items"])

    # search by code
    resp = seeded_client.get(
        "/api/v1/network/fiber?search=CABLE-LIST-2", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(c["cable_code"] == "CABLE-LIST-2" for c in resp.json()["items"])


def test_duplicate_cable_code(seeded_client, auth_headers):
    seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "DUP-CABLE",
            "name": "Cable A",
            "core_count": 4,
        },
        headers=auth_headers,
    )
    resp = seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "DUP-CABLE",
            "name": "Cable B",
            "core_count": 4,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409


# ── Fiber Cores ────────────────────────────────────────────────────────
def test_update_fiber_core_status(seeded_client, auth_headers):
    # create a 4-core cable
    resp = seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "CABLE-CORE-UPD",
            "name": "Core Update Test Cable",
            "core_count": 4,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    cable_id = resp.json()["id"]

    # fetch core 1
    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_id}&page_size=100",
        headers=auth_headers,
    )
    core = next(c for c in resp.json()["items"] if c["core_number"] == 1)
    assert core["status"] == "available"

    # update status to in_use
    resp = seeded_client.put(
        f"/api/v1/network/fiber-cores/{core['id']}",
        json={"status": "in_use", "notes": "Assigned to customer"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_use"
    assert resp.json()["notes"] == "Assigned to customer"

    # filter cores by status
    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_id}&status=in_use",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["id"] == core["id"]

    # available cores should be 3
    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_id}&status=available",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 3


def test_get_fiber_core_not_found(seeded_client, auth_headers):
    resp = seeded_client.put(
        "/api/v1/network/fiber-cores/999999",
        json={"status": "in_use"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ── Splices ────────────────────────────────────────────────────────────
def test_create_splice(seeded_client, auth_headers):
    # create two cables
    resp = seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "SPLICE-A",
            "name": "Cable A",
            "core_count": 4,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    cable_a_id = resp.json()["id"]

    resp = seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "SPLICE-B",
            "name": "Cable B",
            "core_count": 4,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    cable_b_id = resp.json()["id"]

    # fetch core 1 of cable A and core 2 of cable B
    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_a_id}&page_size=100",
        headers=auth_headers,
    )
    core_a_1 = next(c for c in resp.json()["items"] if c["core_number"] == 1)

    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_b_id}&page_size=100",
        headers=auth_headers,
    )
    core_b_2 = next(c for c in resp.json()["items"] if c["core_number"] == 2)

    # create splice between core 1 of A and core 2 of B
    resp = seeded_client.post(
        "/api/v1/network/splices",
        json={
            "source_core_id": core_a_1["id"],
            "destination_core_id": core_b_2["id"],
            "splice_loss": 0.05,
            "notes": "Splice in enclosure",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    splice_id = resp.json()["id"]
    assert resp.json()["source_core_id"] == core_a_1["id"]
    assert resp.json()["destination_core_id"] == core_b_2["id"]
    assert float(resp.json()["splice_loss"]) == 0.05

    # list splices filtered by source_core_id
    resp = seeded_client.get(
        f"/api/v1/network/splices?source_core_id={core_a_1['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert any(s["id"] == splice_id for s in resp.json()["items"])

    # delete splice
    resp = seeded_client.delete(
        f"/api/v1/network/splices/{splice_id}", headers=auth_headers
    )
    assert resp.status_code == 204


def test_list_splices_by_enclosure(seeded_client, auth_headers):
    # create enclosure asset
    resp = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "ENC-001",
            "asset_type": "enclosure",
            "name": "Splice Enclosure 1",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    enclosure_id = resp.json()["id"]

    # create two cables with cores
    resp = seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "SPLICE-ENC-A",
            "name": "Enclosure Cable A",
            "core_count": 4,
        },
        headers=auth_headers,
    )
    cable_a_id = resp.json()["id"]

    resp = seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "SPLICE-ENC-B",
            "name": "Enclosure Cable B",
            "core_count": 4,
        },
        headers=auth_headers,
    )
    cable_b_id = resp.json()["id"]

    # fetch cores
    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_a_id}&page_size=100",
        headers=auth_headers,
    )
    cores_a = resp.json()["items"]
    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_b_id}&page_size=100",
        headers=auth_headers,
    )
    cores_b = resp.json()["items"]

    # create two splices in the enclosure
    s1 = seeded_client.post(
        "/api/v1/network/splices",
        json={
            "enclosure_asset_id": enclosure_id,
            "source_core_id": cores_a[0]["id"],
            "destination_core_id": cores_b[0]["id"],
        },
        headers=auth_headers,
    )
    assert s1.status_code == 201
    splice1_id = s1.json()["id"]

    s2 = seeded_client.post(
        "/api/v1/network/splices",
        json={
            "enclosure_asset_id": enclosure_id,
            "source_core_id": cores_a[1]["id"],
            "destination_core_id": cores_b[1]["id"],
        },
        headers=auth_headers,
    )
    assert s2.status_code == 201
    splice2_id = s2.json()["id"]

    # list splices filtered by enclosure
    resp = seeded_client.get(
        f"/api/v1/network/splices?enclosure_asset_id={enclosure_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert resp.json()["total"] == 2
    returned_ids = {s["id"] for s in items}
    assert splice1_id in returned_ids
    assert splice2_id in returned_ids
    # all returned splices must belong to this enclosure
    assert all(s["enclosure_asset_id"] == enclosure_id for s in items)


def test_delete_splice_not_found(seeded_client, auth_headers):
    resp = seeded_client.delete(
        "/api/v1/network/splices/999999", headers=auth_headers
    )
    assert resp.status_code == 404


# ── Splitter Ports ─────────────────────────────────────────────────────
def test_create_splitter_port(seeded_client, auth_headers):
    # create splitter asset
    resp = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "SPLTR-001",
            "asset_type": "splitter",
            "name": "Splitter 1x8",
            "capacity": 8,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    splitter_id = resp.json()["id"]

    # create input port
    resp = seeded_client.post(
        "/api/v1/network/splitter-ports",
        json={
            "splitter_asset_id": splitter_id,
            "port_kind": "input",
            "port_index": 0,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    input_port_id = resp.json()["id"]
    assert resp.json()["port_kind"] == "input"
    assert resp.json()["port_index"] == 0
    assert resp.json()["status"] == "available"

    # create 8 output ports
    output_ids = []
    for i in range(1, 9):
        resp = seeded_client.post(
            "/api/v1/network/splitter-ports",
            json={
                "splitter_asset_id": splitter_id,
                "port_kind": "output",
                "port_index": i,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        output_ids.append(resp.json()["id"])

    # list ports for splitter
    resp = seeded_client.get(
        f"/api/v1/network/splitter-ports?splitter_asset_id={splitter_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 9  # 1 input + 8 outputs
    assert any(p["id"] == input_port_id for p in resp.json()["items"])

    # update an output port — connect to a core and mark in_use
    # first create a cable+core to connect
    resp = seeded_client.post(
        "/api/v1/network/fiber",
        json={
            "organization_id": 1,
            "cable_code": "SPLTR-CORE-CABLE",
            "name": "Cable for splitter port",
            "core_count": 4,
        },
        headers=auth_headers,
    )
    cable_id = resp.json()["id"]
    resp = seeded_client.get(
        f"/api/v1/network/fiber-cores?cable_id={cable_id}&page_size=100",
        headers=auth_headers,
    )
    core_id = resp.json()["items"][0]["id"]

    resp = seeded_client.put(
        f"/api/v1/network/splitter-ports/{output_ids[0]}",
        json={"connected_core_id": core_id, "status": "in_use"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["connected_core_id"] == core_id
    assert resp.json()["status"] == "in_use"


def test_update_splitter_port_not_found(seeded_client, auth_headers):
    resp = seeded_client.put(
        "/api/v1/network/splitter-ports/999999",
        json={"status": "in_use"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ── Customer Network Links ─────────────────────────────────────────────
def test_customer_network_link(seeded_client, auth_headers):
    # create a customer
    resp = seeded_client.post(
        "/api/v1/customers",
        json={
            "organization_id": 1,
            "customer_code": "CUST-NET-LINK",
            "name": "Network Link Customer",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    customer_id = resp.json()["id"]

    # create a target asset (splitter)
    resp = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "CNL-ASSET",
            "asset_type": "splitter",
            "name": "Customer Link Asset",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    asset_id = resp.json()["id"]

    # create network link
    resp = seeded_client.post(
        "/api/v1/network/customer-links",
        json={
            "customer_id": customer_id,
            "link_kind": "splitter_port",
            "target_asset_id": asset_id,
            "target_port_index": 3,
            "notes": "Connected to port 3",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    link_id = resp.json()["id"]
    assert resp.json()["customer_id"] == customer_id
    assert resp.json()["link_kind"] == "splitter_port"
    assert resp.json()["target_asset_id"] == asset_id
    assert resp.json()["target_port_index"] == 3

    # list links for customer
    resp = seeded_client.get(
        f"/api/v1/network/customer-links?customer_id={customer_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["id"] == link_id

    # delete link
    resp = seeded_client.delete(
        f"/api/v1/network/customer-links/{link_id}", headers=auth_headers
    )
    assert resp.status_code == 204

    # subsequent list should be empty
    resp = seeded_client.get(
        f"/api/v1/network/customer-links?customer_id={customer_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_delete_customer_link_not_found(seeded_client, auth_headers):
    resp = seeded_client.delete(
        "/api/v1/network/customer-links/999999", headers=auth_headers
    )
    assert resp.status_code == 404


# ── Map / GIS ──────────────────────────────────────────────────────────
def test_map_bbox(seeded_client, auth_headers):
    # create assets inside and outside a bounding box
    # bbox: min_lon=90.0, min_lat=23.0, max_lon=91.0, max_lat=24.0
    inside_1 = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "MAP-IN-1",
            "asset_type": "olt",
            "name": "Inside bbox 1",
            "latitude": 23.8103,
            "longitude": 90.4125,
        },
        headers=auth_headers,
    )
    assert inside_1.status_code == 201
    in1_id = inside_1.json()["id"]

    inside_2 = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "MAP-IN-2",
            "asset_type": "pop",
            "name": "Inside bbox 2",
            "latitude": 23.5,
            "longitude": 90.7,
        },
        headers=auth_headers,
    )
    assert inside_2.status_code == 201
    in2_id = inside_2.json()["id"]

    outside = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "MAP-OUT-1",
            "asset_type": "olt",
            "name": "Outside bbox",
            "latitude": 22.0,
            "longitude": 89.0,
        },
        headers=auth_headers,
    )
    assert outside.status_code == 201
    out_id = outside.json()["id"]

    # query bbox
    resp = seeded_client.get(
        "/api/v1/network/map?min_lon=90.0&min_lat=23.0&max_lon=91.0&max_lat=24.0",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()
    ids = {item["id"] for item in items}
    assert in1_id in ids
    assert in2_id in ids
    assert out_id not in ids

    # query bbox with asset_type filter — only olt inside
    resp = seeded_client.get(
        "/api/v1/network/map?min_lon=90.0&min_lat=23.0&max_lon=91.0&max_lat=24.0"
        "&asset_type=olt",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()
    ids = {item["id"] for item in items}
    assert in1_id in ids
    assert in2_id not in ids  # pop, not olt
    # all returned items must be olt
    assert all(item["asset_type"] == "olt" for item in items)


def test_nearby_assets(seeded_client, auth_headers):
    # base point: 23.8103, 90.4125 (Dhaka)
    # near: ~25-30m away
    # far: ~20+ km away
    near = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "NEAR-1",
            "asset_type": "olt",
            "name": "Nearby asset",
            "latitude": 23.8105,
            "longitude": 90.4127,
        },
        headers=auth_headers,
    )
    assert near.status_code == 201
    near_id = near.json()["id"]

    base = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "NEAR-BASE",
            "asset_type": "pop",
            "name": "Base asset",
            "latitude": 23.8103,
            "longitude": 90.4125,
        },
        headers=auth_headers,
    )
    assert base.status_code == 201
    base_id = base.json()["id"]

    far = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "FAR-1",
            "asset_type": "olt",
            "name": "Far away asset",
            "latitude": 24.0,
            "longitude": 91.0,
        },
        headers=auth_headers,
    )
    assert far.status_code == 201
    far_id = far.json()["id"]

    # query nearby with 100m radius around base point
    resp = seeded_client.get(
        "/api/v1/network/map/nearby?lat=23.8103&lon=90.4125&radius_m=100",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()
    ids = {item["id"] for item in items}
    assert near_id in ids
    assert base_id in ids
    assert far_id not in ids

    # query nearby with very small radius — only base itself
    resp = seeded_client.get(
        "/api/v1/network/map/nearby?lat=23.8103&lon=90.4125&radius_m=5",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()
    ids = {item["id"] for item in items}
    assert base_id in ids
    assert near_id not in ids  # ~30m away, outside 5m radius


def test_nearby_with_asset_type_filter(seeded_client, auth_headers):
    # create two near assets of different types
    a1 = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "NTYPE-A",
            "asset_type": "olt",
            "name": "OLT near",
            "latitude": 23.8200,
            "longitude": 90.4200,
        },
        headers=auth_headers,
    )
    assert a1.status_code == 201

    a2 = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": "NTYPE-B",
            "asset_type": "pop",
            "name": "POP near",
            "latitude": 23.8201,
            "longitude": 90.4201,
        },
        headers=auth_headers,
    )
    assert a2.status_code == 201

    # query nearby filtered by asset_type=olt
    resp = seeded_client.get(
        "/api/v1/network/map/nearby?lat=23.8200&lon=90.4200&radius_m=500"
        "&asset_type=olt",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()
    assert all(item["asset_type"] == "olt" for item in items)
    assert any(item["asset_code"] == "NTYPE-A" for item in items)


# ── Unauthenticated blocked ───────────────────────────────────────────
def test_network_unauthenticated(client):
    for path in [
        "/api/v1/network/assets",
        "/api/v1/network/fiber",
        "/api/v1/network/fiber-cores",
        "/api/v1/network/splices",
        "/api/v1/network/splitter-ports",
        "/api/v1/network/customer-links",
        "/api/v1/network/map?min_lon=90&min_lat=23&max_lon=91&max_lat=24",
        "/api/v1/network/map/nearby?lat=23&lon=90",
    ]:
        resp = client.get(path)
        assert resp.status_code == 401, path
