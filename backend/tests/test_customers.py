"""Phase 5 — Customers + Field Service tests."""


# ── Customers ─────────────────────────────────────────────────────────
def test_create_and_list_customers(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/customers",
        json={
            "organization_id": 1,
            "customer_code": "CUST-001",
            "name": "John Smith",
            "phone": "+8801712345678",
            "email": "john@example.com",
            "address": "123 Main St",
            "installation_date": "2025-01-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    cid = resp.json()["id"]
    assert resp.json()["customer_code"] == "CUST-001"
    assert resp.json()["status"] == "active"

    # list
    resp = seeded_client.get("/api/v1/customers", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # search by name
    resp = seeded_client.get(
        "/api/v1/customers?search=John", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(c["id"] == cid for c in resp.json()["items"])

    # search by code
    resp = seeded_client.get(
        "/api/v1/customers?search=CUST-001", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(c["id"] == cid for c in resp.json()["items"])

    # update
    resp = seeded_client.put(
        f"/api/v1/customers/{cid}",
        json={"name": "John Smith Updated", "status": "suspended"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "John Smith Updated"
    assert resp.json()["status"] == "suspended"

    # delete
    resp = seeded_client.delete(f"/api/v1/customers/{cid}", headers=auth_headers)
    assert resp.status_code == 204


def test_duplicate_customer_code(seeded_client, auth_headers):
    seeded_client.post(
        "/api/v1/customers",
        json={
            "organization_id": 1,
            "customer_code": "DUP-CUST",
            "name": "Customer A",
        },
        headers=auth_headers,
    )
    resp = seeded_client.post(
        "/api/v1/customers",
        json={
            "organization_id": 1,
            "customer_code": "DUP-CUST",
            "name": "Customer B",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409


# ── Customer Locations ────────────────────────────────────────────────
def test_customer_location_history(seeded_client, auth_headers):
    # create customer
    resp = seeded_client.post(
        "/api/v1/customers",
        json={
            "organization_id": 1,
            "customer_code": "CUST-LOC",
            "name": "Location Test Customer",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    cid = resp.json()["id"]

    # add location 1
    resp = seeded_client.post(
        "/api/v1/customer-locations",
        json={
            "customer_id": cid,
            "latitude": 23.8103,
            "longitude": 90.4125,
            "accuracy": 5.0,
            "address": "Old Address",
            "source": "mobile",
            "collected_by": 1,
            "collection_method": "gps",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    loc1_id = resp.json()["id"]
    assert resp.json()["is_current"] is True

    # add location 2
    resp = seeded_client.post(
        "/api/v1/customer-locations",
        json={
            "customer_id": cid,
            "latitude": 24.3636,
            "longitude": 88.6241,
            "accuracy": 3.0,
            "address": "New Address",
            "source": "mobile",
            "collected_by": 1,
            "collection_method": "gps",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    loc2_id = resp.json()["id"]
    assert resp.json()["is_current"] is True

    # list all locations for customer — verify history preserved
    resp = seeded_client.get(
        f"/api/v1/customer-locations?customer_id={cid}", headers=auth_headers
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert resp.json()["total"] == 2

    loc1 = next(loc for loc in items if loc["id"] == loc1_id)
    loc2 = next(loc for loc in items if loc["id"] == loc2_id)
    assert loc1["is_current"] is False
    assert loc2["is_current"] is True
    assert loc1["address"] == "Old Address"
    assert loc2["address"] == "New Address"

    # filter only current
    resp = seeded_client.get(
        f"/api/v1/customer-locations?customer_id={cid}&is_current=true",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["id"] == loc2_id


# ── Customer Visits ───────────────────────────────────────────────────
def test_customer_visit(seeded_client, auth_headers):
    # create customer
    resp = seeded_client.post(
        "/api/v1/customers",
        json={
            "organization_id": 1,
            "customer_code": "CUST-VISIT",
            "name": "Visit Test Customer",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    cid = resp.json()["id"]

    # create visit
    resp = seeded_client.post(
        "/api/v1/customer-visits",
        json={
            "customer_id": cid,
            "employee_id": 1,
            "purpose": "Installation follow-up",
            "visited_at": "2025-01-10T10:00:00Z",
            "latitude": 23.8103,
            "longitude": 90.4125,
            "gps_accuracy": 7.5,
            "notes": "Customer satisfied with installation",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    vid = resp.json()["id"]
    assert resp.json()["purpose"] == "Installation follow-up"

    # list visits
    resp = seeded_client.get(
        f"/api/v1/customer-visits?customer_id={cid}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    assert any(v["id"] == vid for v in resp.json()["items"])


# ── Work Orders ───────────────────────────────────────────────────────
def test_create_work_order(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/work-orders",
        json={
            "organization_id": 1,
            "work_order_code": "WO-001",
            "job_type": "installation",
            "priority": "high",
            "assigned_employee_id": 1,
            "scheduled_date": "2025-01-15",
            "notes": "New installation at customer site",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    woid = resp.json()["id"]
    assert resp.json()["work_order_code"] == "WO-001"
    assert resp.json()["status"] == "open"
    assert resp.json()["priority"] == "high"

    # list
    resp = seeded_client.get("/api/v1/work-orders", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # get by id
    resp = seeded_client.get(
        f"/api/v1/work-orders/{woid}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == woid

    # update
    resp = seeded_client.put(
        f"/api/v1/work-orders/{woid}",
        json={"priority": "low", "notes": "Updated notes"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["priority"] == "low"
    assert resp.json()["notes"] == "Updated notes"


def test_work_order_transition(seeded_client, auth_headers):
    # create work order
    resp = seeded_client.post(
        "/api/v1/work-orders",
        json={
            "organization_id": 1,
            "work_order_code": "WO-TRANS-001",
            "job_type": "repair",
            "priority": "medium",
            "assigned_employee_id": 1,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    woid = resp.json()["id"]
    assert resp.json()["status"] == "open"

    # open → assigned
    resp = seeded_client.post(
        f"/api/v1/work-orders/{woid}/transition",
        json={"status": "assigned", "notes": "Assigned to technician"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "assigned"

    # assigned → accepted
    resp = seeded_client.post(
        f"/api/v1/work-orders/{woid}/transition",
        json={"status": "accepted"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"

    # accepted → in_progress
    resp = seeded_client.post(
        f"/api/v1/work-orders/{woid}/transition",
        json={"status": "in_progress"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"

    # in_progress → completed
    resp = seeded_client.post(
        f"/api/v1/work-orders/{woid}/transition",
        json={"status": "completed", "notes": "Job done"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"

    # completed → approved
    resp = seeded_client.post(
        f"/api/v1/work-orders/{woid}/transition",
        json={"status": "approved", "notes": "Quality check passed"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    assert resp.json()["approved_by"] is not None
    assert resp.json()["approved_at"] is not None

    # verify events were created for each transition
    resp = seeded_client.get(
        f"/api/v1/work-order-events?work_order_id={woid}", headers=auth_headers
    )
    assert resp.status_code == 200
    events = resp.json()["items"]
    assert resp.json()["total"] == 5
    event_types = [e["event_type"] for e in events]
    assert "assigned" in event_types
    assert "accepted" in event_types
    assert "in_progress" in event_types
    assert "completed" in event_types
    assert "approved" in event_types


def test_invalid_work_order_transition(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/work-orders",
        json={
            "organization_id": 1,
            "work_order_code": "WO-BAD-001",
            "job_type": "maintenance",
            "priority": "low",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    woid = resp.json()["id"]
    assert resp.json()["status"] == "open"

    # try to go from open directly to completed — should fail
    resp = seeded_client.post(
        f"/api/v1/work-orders/{woid}/transition",
        json={"status": "completed"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_work_order_search(seeded_client, auth_headers):
    seeded_client.post(
        "/api/v1/work-orders",
        json={
            "organization_id": 1,
            "work_order_code": "WO-SEARCH-001",
            "job_type": "installation",
            "priority": "medium",
        },
        headers=auth_headers,
    )

    resp = seeded_client.get(
        "/api/v1/work-orders?search=WO-SEARCH", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    assert any(
        wo["work_order_code"] == "WO-SEARCH-001"
        for wo in resp.json()["items"]
    )


# ── Unauthenticated blocked ───────────────────────────────────────────
def test_customers_unauthenticated(client):
    for path in [
        "/api/v1/customers",
        "/api/v1/customer-locations",
        "/api/v1/customer-visits",
        "/api/v1/work-orders",
        "/api/v1/work-order-events",
    ]:
        resp = client.get(path)
        assert resp.status_code == 401, path
