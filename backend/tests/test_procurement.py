"""Phase 9 — Procurement tests: suppliers, requests for quotation (RFQ),
supplier quotes, accepted-quote-to-purchase-order conversion, and the ordered
multi-level purchase order approval chain.

As with the other phases, all test records are committed into a shared
in-memory SQLite engine, so helpers are idempotent and data is namespaced
with PRC-* / SU-* / RFQ-* prefixes.
"""

from __future__ import annotations

import pytest

# ── Helpers ────────────────────────────────────────────────────────────


def _make_warehouse(seeded_client, auth_headers, code="WH-PRC-1", name="Procurement Depot"):
    existing = seeded_client.get(
        f"/api/v1/inventory/warehouses?search={code}", headers=auth_headers
    ).json()["items"]
    if existing:
        return existing[0]
    resp = seeded_client.post(
        "/api/v1/inventory/warehouses",
        json={"organization_id": 1, "code": code, "name": name},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _make_item(seeded_client, auth_headers, sku="SKU-PRC-1", name="Procurement Splice"):
    existing = seeded_client.get(
        f"/api/v1/inventory/items?search={sku}", headers=auth_headers
    ).json()["items"]
    if existing:
        return existing[0]
    resp = seeded_client.post(
        "/api/v1/inventory/items",
        json={
            "organization_id": 1,
            "sku": sku,
            "name": name,
            "unit": "pcs",
            "unit_cost": 12.0,
            "reorder_level": 0,
            "category": "fiber",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _make_supplier(
    seeded_client,
    auth_headers,
    code="SU-PRC-1",
    name="Acme Fiber Supply",
    is_active=True,
):
    existing = seeded_client.get(
        f"/api/v1/procurement/suppliers?search={code}", headers=auth_headers
    ).json()["items"]
    if existing:
        return existing[0]
    resp = seeded_client.post(
        "/api/v1/procurement/suppliers",
        json={
            "organization_id": 1,
            "code": code,
            "name": name,
            "contact_name": "Dana Buyer",
            "email": "dana@acme.example.com",
            "phone": "+1-555-0100",
            "category": "fiber",
            "payment_terms": "net30",
            "lead_time_days": 14,
            "is_active": is_active,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _make_rfq(seeded_client, auth_headers, rfq_number, item_id, target=10.0, quantity=100):
    """Create a draft RFQ, reusing an existing one so reruns stay idempotent."""
    existing = seeded_client.get(
        f"/api/v1/procurement/rfqs?search={rfq_number}", headers=auth_headers
    ).json()["items"]
    if existing:
        return existing[0]
    resp = seeded_client.post(
        "/api/v1/procurement/rfqs",
        json={
            "organization_id": 1,
            "rfq_number": rfq_number,
            "title": f"Quarterly buy {rfq_number}",
            "currency": "USD",
            "lines": [
                {
                    "stock_item_id": item_id,
                    "quantity": quantity,
                    "target_unit_cost": target,
                }
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _issue(seeded_client, auth_headers, rfq_id):
    return seeded_client.post(
        f"/api/v1/procurement/rfqs/{rfq_id}/issue", headers=auth_headers
    )


def _quote(
    seeded_client,
    auth_headers,
    rfq_id,
    supplier_id,
    unit_cost,
    rfq_line_id,
    tax_amount=0,
):
    return seeded_client.post(
        "/api/v1/procurement/quotes",
        json={
            "organization_id": 1,
            "rfq_id": rfq_id,
            "supplier_id": supplier_id,
            "tax_amount": tax_amount,
            "lines": [{"rfq_line_id": rfq_line_id, "quantity": 100, "unit_cost": unit_cost}],
        },
        headers=auth_headers,
    )


def _permission_id(seeded_client, auth_headers, code):
    module = code.split(":")[0]
    resp = seeded_client.get(
        f"/api/v1/permissions?module={module}&limit=100", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    matches = [p for p in resp.json()["items"] if p["code"] == code]
    assert matches, f"permission {code} not seeded"
    return matches[0]["id"]


def _approver_user(seeded_client, auth_headers, email, permission_code):
    """Create (or reuse) a non-superuser holding a single permission and return
    auth headers for it. Used to prove approver identity is enforced."""
    existing = seeded_client.get(
        f"/api/v1/users?search={email}", headers=auth_headers
    ).json()["items"]
    if not existing:
        perm_id = _permission_id(seeded_client, auth_headers, permission_code)
        resp = seeded_client.post(
            "/api/v1/users",
            json={
                "email": email,
                "full_name": email.split("@")[0].replace(".", " ").title(),
                "password": "Password123!",
                "organization_id": 1,
                "is_superuser": False,
                "permission_ids": [perm_id],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
    token = seeded_client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123!"}
    )
    assert token.status_code == 200, token.text
    return {"Authorization": f"Bearer {token.json()['access_token']}"}


# ── Suppliers ──────────────────────────────────────────────────────────
def test_supplier_crud_and_code_conflict(seeded_client, auth_headers):
    sup = _make_supplier(seeded_client, auth_headers, code="SU-PRC-CRUD", name="Crud Supply")
    assert sup["code"] == "SU-PRC-CRUD"
    assert sup["is_active"] is True

    # duplicate code for the same organization is rejected
    resp = seeded_client.post(
        "/api/v1/procurement/suppliers",
        json={"organization_id": 1, "code": "SU-PRC-CRUD", "name": "Impostor Ltd"},
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text

    # search + list
    resp = seeded_client.get(
        "/api/v1/procurement/suppliers?search=SU-PRC-CRUD", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] >= 1

    # inactive filter
    resp = seeded_client.get(
        "/api/v1/procurement/suppliers?is_active=false", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert all(s["is_active"] is False for s in resp.json()["items"])

    # update
    resp = seeded_client.put(
        f"/api/v1/procurement/suppliers/{sup['id']}",
        json={"name": "Crud Supply Renamed", "is_active": False},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Crud Supply Renamed"
    assert resp.json()["is_active"] is False

    # delete an unused supplier
    created = seeded_client.post(
        "/api/v1/procurement/suppliers",
        json={"organization_id": 1, "code": "SU-PRC-DEL", "name": "Disposable Supply"},
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    resp = seeded_client.delete(
        f"/api/v1/procurement/suppliers/{created.json()['id']}", headers=auth_headers
    )
    assert resp.status_code == 204, resp.text

    # missing supplier
    resp = seeded_client.get("/api/v1/procurement/suppliers/999999", headers=auth_headers)
    assert resp.status_code == 404


def test_supplier_delete_blocked_when_quotes_exist(seeded_client, auth_headers):
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-DELQ")
    rfq = _make_rfq(seeded_client, auth_headers, "RFQ-DELQ-1", item["id"])
    sup = _make_supplier(
        seeded_client, auth_headers, code="SU-PRC-DELQ", name="Quoted Then Deletable"
    )

    quote_exists = seeded_client.get(
        f"/api/v1/procurement/quotes?rfq_id={rfq['id']}&supplier_id={sup['id']}",
        headers=auth_headers,
    ).json()["items"]
    if not quote_exists:
        if rfq["status"] == "draft":
            assert _issue(seeded_client, auth_headers, rfq["id"]).status_code == 200
        resp = _quote(
            seeded_client,
            auth_headers,
            rfq["id"],
            sup["id"],
            9.5,
            rfq["lines"][0]["id"],
        )
        assert resp.status_code == 201, resp.text

    resp = seeded_client.delete(
        f"/api/v1/procurement/suppliers/{sup['id']}", headers=auth_headers
    )
    assert resp.status_code == 409, resp.text


# ── RFQ ────────────────────────────────────────────────────────────────
def test_rfq_issue_lifecycle_and_edit_lock(seeded_client, auth_headers):
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-RFQ")
    rfq = _make_rfq(seeded_client, auth_headers, "RFQ-LIFE-1", item["id"], target=10.0)
    assert rfq["status"] == "draft"
    assert rfq["quote_count"] == 0
    assert len(rfq["lines"]) == 1

    # a draft RFQ cannot be quoted
    sup = _make_supplier(seeded_client, auth_headers, code="SU-PRC-LIFE", name="Life Supply")
    resp = _quote(
        seeded_client, auth_headers, rfq["id"], sup["id"], 9.0, rfq["lines"][0]["id"]
    )
    assert resp.status_code == 409, resp.text

    # issue
    resp = _issue(seeded_client, auth_headers, rfq["id"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "issued"
    assert resp.json()["issued_at"] is not None

    # cannot issue twice
    assert _issue(seeded_client, auth_headers, rfq["id"]).status_code == 409

    # issued RFQs are locked for editing
    resp = seeded_client.put(
        f"/api/v1/procurement/rfqs/{rfq['id']}",
        json={"title": "Should not apply"},
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text

    resp = seeded_client.post(
        f"/api/v1/procurement/rfqs/{rfq['id']}/lines",
        json={"stock_item_id": item["id"], "quantity": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text

    # status filter
    resp = seeded_client.get(
        "/api/v1/procurement/rfqs?status=issued", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert all(r["status"] == "issued" for r in resp.json()["items"])


def test_rfq_draft_line_editing_and_cancel(seeded_client, auth_headers):
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-EDIT")
    rfq = _make_rfq(seeded_client, auth_headers, "RFQ-EDIT-1", item["id"])
    if rfq["status"] != "draft":
        pytest.skip("RFQ-EDIT-1 already advanced beyond draft on a previous run")

    # add a line while still draft
    resp = seeded_client.post(
        f"/api/v1/procurement/rfqs/{rfq['id']}/lines",
        json={"stock_item_id": item["id"], "quantity": 7, "target_unit_cost": 11.0},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    added_line_id = resp.json()["id"]

    resp = seeded_client.get(f"/api/v1/procurement/rfqs/{rfq['id']}", headers=auth_headers)
    assert len(resp.json()["lines"]) == 2

    # remove it again
    resp = seeded_client.delete(
        f"/api/v1/procurement/rfqs/{rfq['id']}/lines/{added_line_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204, resp.text

    resp = seeded_client.get(f"/api/v1/procurement/rfqs/{rfq['id']}", headers=auth_headers)
    assert len(resp.json()["lines"]) == 1

    # cancel it, then confirm it is no longer quotable
    resp = seeded_client.post(
        f"/api/v1/procurement/rfqs/{rfq['id']}/cancel", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["cancelled_at"] is not None

    sup = _make_supplier(seeded_client, auth_headers, code="SU-PRC-CANCEL", name="Cancel Supply")
    resp = _quote(
        seeded_client, auth_headers, rfq["id"], sup["id"], 9.0, rfq["lines"][0]["id"]
    )
    assert resp.status_code == 409, resp.text

    # a cancelled RFQ cannot be cancelled again
    resp = seeded_client.post(
        f"/api/v1/procurement/rfqs/{rfq['id']}/cancel", headers=auth_headers
    )
    assert resp.status_code == 409


def test_rfq_validation_rules(seeded_client, auth_headers):
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-VAL")

    # an RFQ needs at least one line
    resp = seeded_client.post(
        "/api/v1/procurement/rfqs",
        json={"organization_id": 1, "rfq_number": "RFQ-VAL-EMPTY", "title": "No lines"},
        headers=auth_headers,
    )
    assert resp.status_code == 400, resp.text

    # unknown stock item
    resp = seeded_client.post(
        "/api/v1/procurement/rfqs",
        json={
            "organization_id": 1,
            "rfq_number": "RFQ-VAL-ITEM",
            "title": "Bad item",
            "lines": [{"stock_item_id": 999999, "quantity": 1}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404, resp.text

    # non-positive quantity
    resp = seeded_client.post(
        "/api/v1/procurement/rfqs",
        json={
            "organization_id": 1,
            "rfq_number": "RFQ-VAL-QTY",
            "title": "Zero qty",
            "lines": [{"stock_item_id": item["id"], "quantity": 0}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400, resp.text

    # duplicate RFQ number
    created = seeded_client.post(
        "/api/v1/procurement/rfqs",
        json={
            "organization_id": 1,
            "rfq_number": "RFQ-VAL-DUP",
            "title": "First",
            "lines": [{"stock_item_id": item["id"], "quantity": 2}],
        },
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    resp = seeded_client.post(
        "/api/v1/procurement/rfqs",
        json={
            "organization_id": 1,
            "rfq_number": "RFQ-VAL-DUP",
            "title": "Second",
            "lines": [{"stock_item_id": item["id"], "quantity": 2}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text

    # clean up so reruns are clean
    seeded_client.post(
        f"/api/v1/procurement/rfqs/{created.json()['id']}/cancel", headers=auth_headers
    )


# ── Quotes ─────────────────────────────────────────────────────────────
def test_quote_totals_targets_and_validation(seeded_client, auth_headers):
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-QT")
    rfq = _make_rfq(seeded_client, auth_headers, "RFQ-QT-1", item["id"], target=10.0)
    if rfq["status"] == "draft":
        assert _issue(seeded_client, auth_headers, rfq["id"]).status_code == 200
    rfq = seeded_client.get(
        f"/api/v1/procurement/rfqs/{rfq['id']}", headers=auth_headers
    ).json()
    line_id = rfq["lines"][0]["id"]

    sup = _make_supplier(seeded_client, auth_headers, code="SU-PRC-QT", name="Quote Supply")
    existing = seeded_client.get(
        f"/api/v1/procurement/quotes?rfq_id={rfq['id']}&supplier_id={sup['id']}",
        headers=auth_headers,
    ).json()["items"]
    if existing:
        quote = existing[0]
    else:
        # 100 units above the 10.00 target, plus 20.00 tax
        resp = _quote(
            seeded_client, auth_headers, rfq["id"], sup["id"], 10.5, line_id, tax_amount=20
        )
        assert resp.status_code == 201, resp.text
        quote = resp.json()

    assert quote["status"] == "received"
    assert quote["subtotal"] == 1050.0
    assert quote["tax_amount"] == 20.0
    assert quote["total_amount"] == 1070.0
    assert quote["supplier_name"] == "Quote Supply"
    assert len(quote["lines"]) == 1
    assert quote["lines"][0]["line_total"] == 1050.0
    # 10.50 exceeds the 10.00 RFQ target
    assert quote["lines"][0]["over_target"] is True

    # the same supplier may not quote the same RFQ twice
    resp = _quote(seeded_client, auth_headers, rfq["id"], sup["id"], 8.0, line_id)
    assert resp.status_code == 409, resp.text

    # a line that is not on this RFQ is rejected
    resp = _quote(seeded_client, auth_headers, rfq["id"], sup["id"], 8.0, 999999)
    assert resp.status_code in {409, 400}, resp.text

    # inactive suppliers cannot quote
    inactive = _make_supplier(
        seeded_client,
        auth_headers,
        code="SU-PRC-INACT",
        name="Dormant Supply",
        is_active=False,
    )
    resp = _quote(
        seeded_client, auth_headers, rfq["id"], inactive["id"], 8.0, line_id
    )
    assert resp.status_code == 409, resp.text

    # missing quote
    resp = seeded_client.get("/api/v1/procurement/quotes/999999", headers=auth_headers)
    assert resp.status_code == 404


def test_quote_acceptance_closes_rfq_and_rejects_rivals(seeded_client, auth_headers):
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-ACC")
    rfq = _make_rfq(seeded_client, auth_headers, "RFQ-ACC-1", item["id"], target=10.0)
    if rfq["status"] == "draft":
        assert _issue(seeded_client, auth_headers, rfq["id"]).status_code == 200
    rfq = seeded_client.get(
        f"/api/v1/procurement/rfqs/{rfq['id']}", headers=auth_headers
    ).json()
    line_id = rfq["lines"][0]["id"]

    winner = _make_supplier(
        seeded_client, auth_headers, code="SU-PRC-ACC-W", name="Accurate Winner"
    )
    rival = _make_supplier(
        seeded_client, auth_headers, code="SU-PRC-ACC-L", name="Accurate Loser"
    )
    for supplier, cost in ((winner, 9.0), (rival, 11.0)):
        has = seeded_client.get(
            f"/api/v1/procurement/quotes?rfq_id={rfq['id']}&supplier_id={supplier['id']}",
            headers=auth_headers,
        ).json()["items"]
        if not has:
            resp = _quote(
                seeded_client, auth_headers, rfq["id"], supplier["id"], cost, line_id
            )
            assert resp.status_code == 201, resp.text

    quotes = seeded_client.get(
        f"/api/v1/procurement/quotes?rfq_id={rfq['id']}", headers=auth_headers
    ).json()["items"]
    wq = next(q for q in quotes if q["supplier_id"] == winner["id"])
    lq = next(q for q in quotes if q["supplier_id"] == rival["id"])

    if wq["status"] == "received":
        resp = seeded_client.post(
            f"/api/v1/procurement/quotes/{wq['id']}/accept", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "accepted"
        assert resp.json()["decided_at"] is not None

    # exactly one supplier wins: the rival is rejected
    resp = seeded_client.get(
        f"/api/v1/procurement/quotes/{lq['id']}", headers=auth_headers
    )
    assert resp.json()["status"] == "rejected", resp.json()["status"]
    assert resp.json()["decided_at"] is not None

    # the RFQ is closed
    resp = seeded_client.get(f"/api/v1/procurement/rfqs/{rfq['id']}", headers=auth_headers)
    assert resp.json()["status"] == "closed"
    assert resp.json()["closed_at"] is not None

    # a closed RFQ takes no further quotes
    late = _make_supplier(
        seeded_client, auth_headers, code="SU-PRC-ACC-LATE", name="Late Arrival"
    )
    resp = _quote(
        seeded_client, auth_headers, rfq["id"], late["id"], 8.0, line_id
    )
    assert resp.status_code == 409, resp.text

    # accepting twice is rejected
    resp = seeded_client.post(
        f"/api/v1/procurement/quotes/{wq['id']}/accept", headers=auth_headers
    )
    assert resp.status_code == 409, resp.text


def test_quote_can_be_rejected_without_closing_rfq(seeded_client, auth_headers):
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-REJ")
    rfq = _make_rfq(seeded_client, auth_headers, "RFQ-REJ-1", item["id"], target=10.0)
    if rfq["status"] == "draft":
        assert _issue(seeded_client, auth_headers, rfq["id"]).status_code == 200
    rfq = seeded_client.get(
        f"/api/v1/procurement/rfqs/{rfq['id']}", headers=auth_headers
    ).json()
    sup = _make_supplier(seeded_client, auth_headers, code="SU-PRC-REJ", name="Rejected Bidder")
    has = seeded_client.get(
        f"/api/v1/procurement/quotes?rfq_id={rfq['id']}&supplier_id={sup['id']}",
        headers=auth_headers,
    ).json()["items"]
    if not has:
        assert (
            _quote(
                seeded_client, auth_headers, rfq["id"], sup["id"], 30.0, rfq["lines"][0]["id"]
            ).status_code
            == 201
        )
    quote_id = seeded_client.get(
        f"/api/v1/procurement/quotes?rfq_id={rfq['id']}&supplier_id={sup['id']}",
        headers=auth_headers,
    ).json()["items"][0]["id"]

    if seeded_client.get(
        f"/api/v1/procurement/quotes/{quote_id}", headers=auth_headers
    ).json()["status"] == "received":
        resp = seeded_client.post(
            f"/api/v1/procurement/quotes/{quote_id}/reject", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "rejected"

    # rejecting one bid leaves the RFQ open for a decision
    rfq_now = seeded_client.get(
        f"/api/v1/procurement/rfqs/{rfq['id']}", headers=auth_headers
    ).json()
    assert rfq_now["status"] == "issued"


# ── Quote -> PO conversion ─────────────────────────────────────────────
def test_accepted_quote_converts_to_purchase_order(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-CONV")
    rfq = _make_rfq(seeded_client, auth_headers, "RFQ-CONV-1", item["id"], target=10.0)
    if rfq["status"] == "draft":
        assert _issue(seeded_client, auth_headers, rfq["id"]).status_code == 200
    rfq = seeded_client.get(
        f"/api/v1/procurement/rfqs/{rfq['id']}", headers=auth_headers
    ).json()
    sup = _make_supplier(seeded_client, auth_headers, code="SU-PRC-CONV", name="Converted Supply")
    rival = _make_supplier(
        seeded_client, auth_headers, code="SU-PRC-CONV-X", name="Not Accepted"
    )
    # both suppliers quote while the RFQ is still open
    if rfq["status"] == "issued":
        for supplier, cost in ((sup, 9.0), (rival, 9.5)):
            already = seeded_client.get(
                f"/api/v1/procurement/quotes?rfq_id={rfq['id']}"
                f"&supplier_id={supplier['id']}",
                headers=auth_headers,
            ).json()["items"]
            if not already:
                assert (
                    _quote(
                        seeded_client,
                        auth_headers,
                        rfq["id"],
                        supplier["id"],
                        cost,
                        rfq["lines"][0]["id"],
                        tax_amount=5 if supplier["id"] == sup["id"] else 0,
                    ).status_code
                    == 201
                )

    quote = seeded_client.get(
        f"/api/v1/procurement/quotes?rfq_id={rfq['id']}&supplier_id={sup['id']}",
        headers=auth_headers,
    ).json()["items"][0]

    if quote["status"] == "received":
        assert (
            seeded_client.post(
                f"/api/v1/procurement/quotes/{quote['id']}/accept", headers=auth_headers
            ).status_code
            == 200
        )

    # only an accepted quote converts: the rival lost and was auto-rejected
    rival_quote = seeded_client.get(
        f"/api/v1/procurement/quotes?rfq_id={rfq['id']}&supplier_id={rival['id']}",
        headers=auth_headers,
    ).json()["items"]
    if rival_quote:
        assert rival_quote[0]["status"] == "rejected"
        resp = seeded_client.post(
            f"/api/v1/procurement/quotes/{rival_quote[0]['id']}/convert-to-po"
            f"?warehouse_id={wh['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 409, resp.text

    # unknown warehouse
    resp = seeded_client.post(
        f"/api/v1/procurement/quotes/{quote['id']}/convert-to-po?warehouse_id=999999",
        headers=auth_headers,
    )
    assert resp.status_code == 404, resp.text

    quote = seeded_client.get(
        f"/api/v1/procurement/quotes/{quote['id']}", headers=auth_headers
    ).json()

    if not quote["purchase_order_id"]:
        resp = seeded_client.post(
            f"/api/v1/procurement/quotes/{quote['id']}/convert-to-po"
            f"?warehouse_id={wh['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        po = resp.json()
    else:
        po = seeded_client.get(
            f"/api/v1/inventory/purchase-orders/{quote['purchase_order_id']}",
            headers=auth_headers,
        ).json()

    assert po["po_number"] == f"PO-{rfq['rfq_number']}"
    assert po["status"] == "draft"
    assert po["supplier_name"] == "Converted Supply"
    assert po["warehouse_id"] == wh["id"]
    assert len(po["lines"]) == 1
    assert po["lines"][0]["quantity"] == 100
    assert po["lines"][0]["unit_cost"] == 9.0
    assert po["subtotal"] == 900.0
    assert po["total_amount"] == 905.0

    # the quote now points at the PO
    quote = seeded_client.get(
        f"/api/v1/procurement/quotes/{quote['id']}", headers=auth_headers
    ).json()
    assert quote["purchase_order_id"] == po["id"]

    # converting twice is rejected
    resp = seeded_client.post(
        f"/api/v1/procurement/quotes/{quote['id']}/convert-to-po?warehouse_id={wh['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text


# ── Purchase order approval chain ──────────────────────────────────────
def _draft_po(seeded_client, auth_headers, item_id, warehouse_id, po_number):
    existing = seeded_client.get(
        f"/api/v1/inventory/purchase-orders?search={po_number}", headers=auth_headers
    ).json()["items"]
    if existing:
        return existing[0]
    resp = seeded_client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "organization_id": 1,
            "po_number": po_number,
            "supplier_name": "Approval Test Supply",
            "warehouse_id": warehouse_id,
            "lines": [{"item_id": item_id, "quantity": 10, "unit_cost": 4.0}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_approval_chain_is_ordered_and_identity_enforced(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-APP")
    po = _draft_po(seeded_client, auth_headers, item["id"], wh["id"], "PO-PRC-APP-1")

    # a second, non-superuser approver for identity checks
    second = _approver_user(
        seeded_client, auth_headers, "prc.approver@isp-erp.example.com",
        "procurement:purchase_orders:approve",
    )
    second_id = seeded_client.get(
        "/api/v1/users?search=prc.approver@isp-erp.example.com", headers=auth_headers
    ).json()["items"][0]["id"]

    if po["status"] == "draft":
        resp = seeded_client.post(
            f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
            json={"approver_ids": [1, second_id]},
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        chain = resp.json()
        assert [c["sequence"] for c in chain] == [1, 2]
        assert all(c["status"] == "pending" for c in chain)

    # submitting put the PO into pending_approval
    po = seeded_client.get(
        f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
    ).json()
    assert po["status"] == "pending_approval", po["status"]

    # levels cannot be skipped
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals/2/approve",
        json={},
        headers=second,
    )
    assert resp.status_code == 409, resp.text

    # the wrong approver is refused even with the right permission
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals/1/approve",
        json={},
        headers=second,
    )
    assert resp.status_code == 403, resp.text

    # a nonexistent level is a 404
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals/9/approve",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 404, resp.text

    # level 1 approves: the PO is still pending
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals/1/approve",
        json={"comments": "budget ok"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()[0]["status"] == "approved"
    assert resp.json()[0]["comments"] == "budget ok"
    assert resp.json()[0]["decided_at"] is not None

    po = seeded_client.get(
        f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
    ).json()
    assert po["status"] == "pending_approval"

    # deciding the same level twice is rejected
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals/1/approve",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text

    # level 2 approves: the PO is now approved
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals/2/approve",
        json={"comments": "final sign off"},
        headers=second,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()[1]["status"] == "approved"

    po = seeded_client.get(
        f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
    ).json()
    assert po["status"] == "approved", po["status"]
    assert po["approved_at"] is not None

    # the chain cannot be rebuilt after the fact
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
        json={"approver_ids": [1]},
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text


def test_approval_rejection_returns_po_to_draft(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-REJPO")
    po = _draft_po(seeded_client, auth_headers, item["id"], wh["id"], "PO-PRC-REJ-1")

    if po["status"] == "draft":
        resp = seeded_client.post(
            f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
            json={"approver_ids": [1]},
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text

    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals/1/reject",
        json={"comments": "too expensive, renegotiate"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()[0]["status"] == "rejected"
    assert resp.json()[0]["comments"] == "too expensive, renegotiate"

    po = seeded_client.get(
        f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
    ).json()
    assert po["status"] == "draft", po["status"]
    assert po["approved_at"] is None

    # rejection history is preserved and visible
    resp = seeded_client.get(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 1
    assert resp.json()[0]["status"] == "rejected"
    assert resp.json()[0]["approver_name"]

    # the draft PO is editable again
    resp = seeded_client.put(
        f"/api/v1/inventory/purchase-orders/{po['id']}",
        json={"supplier_name": "Cheaper Supplier"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text


def test_approval_chain_validation(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-APPVAL")
    po = _draft_po(seeded_client, auth_headers, item["id"], wh["id"], "PO-PRC-APPVAL-1")

    # empty chain
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
        json={"approver_ids": []},
        headers=auth_headers,
    )
    assert resp.status_code == 400, resp.text

    # repeated approver
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
        json={"approver_ids": [1, 1]},
        headers=auth_headers,
    )
    assert resp.status_code == 400, resp.text

    # unknown approver
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
        json={"approver_ids": [999999]},
        headers=auth_headers,
    )
    assert resp.status_code == 404, resp.text

    # a missing PO is a 404
    resp = seeded_client.post(
        "/api/v1/procurement/purchase-orders/999999/approvals",
        json={"approver_ids": [1]},
        headers=auth_headers,
    )
    assert resp.status_code == 404, resp.text


def test_pending_approval_po_cannot_be_edited_or_deleted(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-PRC-LOCK")
    po = _draft_po(seeded_client, auth_headers, item["id"], wh["id"], "PO-PRC-LOCK-1")

    if po["status"] == "draft":
        assert (
            seeded_client.post(
                f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
                json={"approver_ids": [1]},
                headers=auth_headers,
            ).status_code
            == 201
        )

    resp = seeded_client.put(
        f"/api/v1/inventory/purchase-orders/{po['id']}",
        json={"supplier_name": "Sneaky Edit"},
        headers=auth_headers,
    )
    assert resp.status_code == 409, resp.text

    resp = seeded_client.delete(
        f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
    )
    assert resp.status_code == 409, resp.text

    # and it can still be cancelled out of the approval queue
    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/cancel", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"


# ── Auth ───────────────────────────────────────────────────────────────
def test_procurement_endpoints_require_auth(client):
    for path in [
        "/api/v1/procurement/suppliers",
        "/api/v1/procurement/rfqs",
        "/api/v1/procurement/quotes",
    ]:
        resp = client.get(path)
        assert resp.status_code == 401, path
