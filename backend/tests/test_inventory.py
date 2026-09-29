"""Phase 8 — Inventory tests: warehouses, stock item catalog, stock levels,
movements (receipt/issue/adjustment/transfer with network-asset attribution),
low-stock reporting, and purchase orders with receive-to-stock.
"""

from __future__ import annotations

from sqlalchemy import select

from app.models.inventory import StockLevel

# ── Helpers ────────────────────────────────────────────────────────────
# Test data is committed by the API services into the shared in-memory SQLite,
# so every record here is namespaced with INV-* / WH-* / SKU-* prefixes and the
# helpers are idempotent to stay safe under a session-scoped engine.


def _make_warehouse(seeded_client, auth_headers, code="WH-INV-1", name="Main Depot"):
    existing = seeded_client.get(
        f"/api/v1/inventory/warehouses?search={code}", headers=auth_headers
    ).json()["items"]
    if existing:
        return existing[0]
    resp = seeded_client.post(
        "/api/v1/inventory/warehouses",
        json={"organization_id": 1, "code": code, "name": name, "address": "1 Depot Road"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _make_item(
    seeded_client,
    auth_headers,
    sku="SKU-INV-1",
    name="Splice Closure",
    unit_cost=10.5,
    reorder_level=5,
    asset_class="enclosure",
):
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
            "unit_cost": unit_cost,
            "reorder_level": reorder_level,
            "asset_class": asset_class,
            "category": "fiber",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _zero_level(seeded_client, auth_headers, warehouse_id, item_id):
    """Force a known starting quantity so assertions are deterministic.

    Stock levels are created lazily by the first movement, so a fresh
    item/warehouse pair has no level row yet — in that case there is nothing
    to zero and we simply leave the pair untouched.
    """
    levels = seeded_client.get(
        f"/api/v1/inventory/stock?warehouse_id={warehouse_id}&item_id={item_id}",
        headers=auth_headers,
    ).json()["items"]
    if not levels:
        return None
    current = levels[0]["quantity"]
    if current != 0:
        resp = seeded_client.post(
            "/api/v1/inventory/movements",
            json={
                "organization_id": 1,
                "movement_type": "adjustment",
                "item_id": item_id,
                "warehouse_id": warehouse_id,
                "quantity": -current,
                "reason": "test reset",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
    return levels[0]


def _receipt(seeded_client, auth_headers, warehouse_id, item_id, qty, reason="seed"):
    resp = seeded_client.post(
        "/api/v1/inventory/movements",
        json={
            "organization_id": 1,
            "movement_type": "receipt",
            "item_id": item_id,
            "warehouse_id": warehouse_id,
            "quantity": qty,
            "reason": reason,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _approve_po(seeded_client, auth_headers, po_id, approver_ids=(1,)):
    """Drive a draft PO to `approved` through the Phase 9 approval chain.

    Phase 9 replaced the single-step approve endpoint with an ordered,
    multi-level chain, so Phase 8 tests approve via that chain instead.
    """
    resp = seeded_client.post(
        f"/api/v1/procurement/purchase-orders/{po_id}/approvals",
        json={"approver_ids": list(approver_ids)},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    for sequence in range(1, len(approver_ids) + 1):
        resp = seeded_client.post(
            f"/api/v1/procurement/purchase-orders/{po_id}/approvals/{sequence}/approve",
            json={"comments": "auto-approved by test"},
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
    po = seeded_client.get(
        f"/api/v1/inventory/purchase-orders/{po_id}", headers=auth_headers
    ).json()
    assert po["status"] == "approved", po["status"]
    return po


def _level_qty(seeded_client, auth_headers, warehouse_id, item_id):
    resp = seeded_client.get(
        f"/api/v1/inventory/stock?warehouse_id={warehouse_id}&item_id={item_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    return items[0]["quantity"] if items else 0.0


def _make_asset(seeded_client, auth_headers, code="INV-OLT-1", name="Spare OLT"):
    existing = seeded_client.get(
        f"/api/v1/network/assets?search={code}", headers=auth_headers
    ).json()["items"]
    if existing:
        return existing[0]
    resp = seeded_client.post(
        "/api/v1/network/assets",
        json={
            "organization_id": 1,
            "asset_code": code,
            "asset_type": "olt",
            "name": name,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Warehouses ─────────────────────────────────────────────────────────
def test_create_and_list_warehouses(seeded_client, auth_headers):
    w = _make_warehouse(seeded_client, auth_headers)
    assert w["code"] == "WH-INV-1"
    assert w["name"] == "Main Depot"
    assert w["is_active"] is True

    resp = seeded_client.get("/api/v1/inventory/warehouses", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    assert any(x["id"] == w["id"] for x in resp.json()["items"])

    resp = seeded_client.get(
        f"/api/v1/inventory/warehouses/{w['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == w["id"]

    # duplicate code is rejected
    resp = seeded_client.post(
        "/api/v1/inventory/warehouses",
        json={"organization_id": 1, "code": "WH-INV-1", "name": "Dupe"},
        headers=auth_headers,
    )
    assert resp.status_code == 409

    resp = seeded_client.put(
        f"/api/v1/inventory/warehouses/{w['id']}",
        json={"name": "Main Depot Renamed"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Main Depot Renamed"

    resp = seeded_client.get(
        "/api/v1/inventory/warehouses/99999999", headers=auth_headers
    )
    assert resp.status_code == 404


# ── Stock Items ────────────────────────────────────────────────────────
def test_create_and_list_items(seeded_client, auth_headers):
    item = _make_item(seeded_client, auth_headers)
    assert item["sku"] == "SKU-INV-1"
    assert item["unit"] == "pcs"
    assert item["reorder_level"] == 5
    assert item["asset_class"] == "enclosure"
    assert item["unit_cost"] == 10.5

    resp = seeded_client.get(
        "/api/v1/inventory/items?category=fiber", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(x["id"] == item["id"] for x in resp.json()["items"])

    resp = seeded_client.get(
        "/api/v1/inventory/items?asset_class=enclosure", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(x["id"] == item["id"] for x in resp.json()["items"])

    # duplicate sku rejected
    resp = seeded_client.post(
        "/api/v1/inventory/items",
        json={"organization_id": 1, "sku": "SKU-INV-1", "name": "Dupe"},
        headers=auth_headers,
    )
    assert resp.status_code == 409

    resp = seeded_client.put(
        f"/api/v1/inventory/items/{item['id']}",
        json={"reorder_level": 12},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["reorder_level"] == 12


# ── Stock levels and movements ─────────────────────────────────────────
def test_receipt_issue_and_levels(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-INV-MOV", reorder_level=0)
    _zero_level(seeded_client, auth_headers, wh["id"], item["id"])

    mv = _receipt(seeded_client, auth_headers, wh["id"], item["id"], 100)
    assert mv["movement_type"] == "receipt"
    assert mv["quantity"] == 100
    assert mv["signed_delta"] == 100
    assert mv["balance_after"] == 100
    assert _level_qty(seeded_client, auth_headers, wh["id"], item["id"]) == 100

    resp = seeded_client.post(
        "/api/v1/inventory/movements",
        json={
            "organization_id": 1,
            "movement_type": "issue",
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "quantity": 30,
            "reason": "field install",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["signed_delta"] == -30
    assert resp.json()["balance_after"] == 70
    assert _level_qty(seeded_client, auth_headers, wh["id"], item["id"]) == 70


def test_issue_cannot_drive_stock_negative(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-INV-NEG", reorder_level=0)
    _zero_level(seeded_client, auth_headers, wh["id"], item["id"])

    resp = seeded_client.post(
        "/api/v1/inventory/movements",
        json={
            "organization_id": 1,
            "movement_type": "issue",
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "quantity": 5,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["title"] == "Insufficient Stock"


def test_adjustment_and_zero_quantity_rejected(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-INV-ADJ", reorder_level=0)
    _zero_level(seeded_client, auth_headers, wh["id"], item["id"])

    _receipt(seeded_client, auth_headers, wh["id"], item["id"], 10)
    resp = seeded_client.post(
        "/api/v1/inventory/movements",
        json={
            "organization_id": 1,
            "movement_type": "adjustment",
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "quantity": -3,
            "reason": "damaged in store",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["signed_delta"] == -3
    assert resp.json()["balance_after"] == 7

    # zero adjustment rejected
    resp = seeded_client.post(
        "/api/v1/inventory/movements",
        json={
            "organization_id": 1,
            "movement_type": "adjustment",
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "quantity": 0,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400

    # unknown movement type rejected
    resp = seeded_client.post(
        "/api/v1/inventory/movements",
        json={
            "organization_id": 1,
            "movement_type": "teleport",
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "quantity": 1,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_movement_attributed_to_network_asset(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers)
    item = _make_item(seeded_client, auth_headers, sku="SKU-INV-ASSET", reorder_level=0)
    asset = _make_asset(seeded_client, auth_headers)
    _zero_level(seeded_client, auth_headers, wh["id"], item["id"])
    _receipt(seeded_client, auth_headers, wh["id"], item["id"], 20)

    resp = seeded_client.post(
        "/api/v1/inventory/movements",
        json={
            "organization_id": 1,
            "movement_type": "issue",
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "quantity": 2,
            "network_asset_id": asset["id"],
            "reason": "installed into spare OLT",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["network_asset_id"] == asset["id"]

    # trace the consumption back from the asset side
    resp = seeded_client.get(
        f"/api/v1/inventory/movements?network_asset_id={asset['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(m["network_asset_id"] == asset["id"] for m in items)

    # unknown asset is rejected
    resp = seeded_client.post(
        "/api/v1/inventory/movements",
        json={
            "organization_id": 1,
            "movement_type": "receipt",
            "item_id": item["id"],
            "warehouse_id": wh["id"],
            "quantity": 1,
            "network_asset_id": 99999999,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_transfer_between_warehouses(seeded_client, auth_headers):
    src = _make_warehouse(seeded_client, auth_headers, code="WH-INV-SRC", name="SRC Depot")
    dst = _make_warehouse(seeded_client, auth_headers, code="WH-INV-DST", name="DST Depot")
    item = _make_item(seeded_client, auth_headers, sku="SKU-INV-XFER", reorder_level=0)
    _zero_level(seeded_client, auth_headers, src["id"], item["id"])
    _zero_level(seeded_client, auth_headers, dst["id"], item["id"])
    _receipt(seeded_client, auth_headers, src["id"], item["id"], 40)

    resp = seeded_client.post(
        "/api/v1/inventory/movements/transfer",
        json={
            "organization_id": 1,
            "item_id": item["id"],
            "from_warehouse_id": src["id"],
            "to_warehouse_id": dst["id"],
            "quantity": 15,
            "reason": "rebalance",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert len(body) == 2
    types = {m["movement_type"] for m in body}
    assert types == {"transfer_in", "transfer_out"}
    assert _level_qty(seeded_client, auth_headers, src["id"], item["id"]) == 25
    assert _level_qty(seeded_client, auth_headers, dst["id"], item["id"]) == 15

    # same-warehouse transfer rejected
    resp = seeded_client.post(
        "/api/v1/inventory/movements/transfer",
        json={
            "organization_id": 1,
            "item_id": item["id"],
            "from_warehouse_id": src["id"],
            "to_warehouse_id": src["id"],
            "quantity": 1,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400

    # over-transfer rejected
    resp = seeded_client.post(
        "/api/v1/inventory/movements/transfer",
        json={
            "organization_id": 1,
            "item_id": item["id"],
            "from_warehouse_id": src["id"],
            "to_warehouse_id": dst["id"],
            "quantity": 99999,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 409


# ── Low stock and summary ──────────────────────────────────────────────
def test_low_stock_and_summary(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers, code="WH-INV-LOW", name="Low Depot")
    item = _make_item(
        seeded_client, auth_headers, sku="SKU-INV-LOW", name="Low Item", reorder_level=10
    )
    _zero_level(seeded_client, auth_headers, wh["id"], item["id"])
    _receipt(seeded_client, auth_headers, wh["id"], item["id"], 3)

    resp = seeded_client.get(
        f"/api/v1/inventory/stock?warehouse_id={wh['id']}&item_id={item['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    level = resp.json()["items"][0]
    assert level["quantity"] == 3
    assert level["reorder_level"] == 10
    assert level["available_quantity"] == 3
    assert level["is_low"] is True

    resp = seeded_client.get(
        "/api/v1/inventory/stock/low?organization_id=1", headers=auth_headers
    )
    assert resp.status_code == 200
    lows = resp.json()
    assert any(
        row["item_id"] == item["id"] and row["warehouse_id"] == wh["id"] for row in lows
    )
    row = next(r for r in lows if r["item_id"] == item["id"])
    assert row["shortfall"] == 7

    resp = seeded_client.get(
        "/api/v1/inventory/stock/low_only=false", headers=auth_headers
    )
    assert resp.status_code == 422  # not a stock route param

    resp = seeded_client.get(
        f"/api/v1/inventory/stock?low_only=true&warehouse_id={wh['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert all(x["is_low"] for x in resp.json()["items"])

    resp = seeded_client.get("/api/v1/inventory/stock/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["item_count"] >= 1
    assert body["warehouse_count"] >= 1
    assert body["low_stock_count"] >= 1
    assert "total_value" in body


# ── Purchase orders ────────────────────────────────────────────────────
def test_purchase_order_lifecycle(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers, code="WH-INV-PO", name="PO Depot")
    item = _make_item(
        seeded_client, auth_headers, sku="SKU-INV-PO", name="PO Item", unit_cost=7.25
    )
    _zero_level(seeded_client, auth_headers, wh["id"], item["id"])

    po_number = f"PO-INV-{item['id']}"
    existing = seeded_client.get(
        f"/api/v1/inventory/purchase-orders?search={po_number}", headers=auth_headers
    ).json()["items"]
    if existing and existing[0]["status"] != "received":
        po = existing[0]
    else:
        resp = seeded_client.post(
            "/api/v1/inventory/purchase-orders",
            json={
                "organization_id": 1,
                "po_number": po_number,
                "supplier_name": "FiberWorld Supplies",
                "warehouse_id": wh["id"],
                "tax_amount": 5,
                "lines": [{"item_id": item["id"], "quantity": 20, "unit_cost": 7.25}],
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        po = resp.json()

    assert po["status"] in {"draft", "approved", "partially_received"}
    assert len(po["lines"]) == 1
    line = po["lines"][0]
    assert line["quantity"] == 20
    assert line["line_total"] == 145
    assert po["subtotal"] == 145
    assert po["total_amount"] == 150

    # cannot receive before approval
    if po["status"] == "draft":
        resp = seeded_client.post(
            f"/api/v1/inventory/purchase-orders/{po['id']}/receive",
            json={"lines": [{"line_id": line["id"], "quantity": 5}]},
            headers=auth_headers,
        )
        assert resp.status_code == 409

    if po["status"] == "draft":
        _approve_po(seeded_client, auth_headers, po["id"])
        po = seeded_client.get(
            f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
        ).json()

        # a second approval chain cannot be built once one exists
        resp = seeded_client.post(
            f"/api/v1/procurement/purchase-orders/{po['id']}/approvals",
            json={"approver_ids": [1]},
            headers=auth_headers,
        )
        assert resp.status_code == 409

    # partial receipt
    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/receive",
        json={"lines": [{"line_id": line["id"], "quantity": 8}]},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "partially_received"
    assert body["lines"][0]["received_quantity"] == 8
    assert _level_qty(seeded_client, auth_headers, wh["id"], item["id"]) >= 8

    # over-receipt rejected
    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/receive",
        json={"lines": [{"line_id": line["id"], "quantity": 999}]},
        headers=auth_headers,
    )
    assert resp.status_code == 400

    # final receipt
    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/receive",
        json={"lines": [{"line_id": line["id"], "quantity": 12}]},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "received"
    assert resp.json()["received_at"] is not None

    # receiving again is rejected once fully received
    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/receive",
        json={"lines": [{"line_id": line["id"], "quantity": 1}]},
        headers=auth_headers,
    )
    assert resp.status_code == 409

    # stock movements are traceable back to the PO
    resp = seeded_client.get(
        "/api/v1/inventory/movements?reference_type=purchase_order"
        f"&reference_id={po['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    moves = resp.json()["items"]
    assert len(moves) >= 2
    assert all(m["movement_type"] == "receipt" for m in moves)


def test_purchase_order_validation_and_edit_lock(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers, code="WH-INV-PO2", name="PO2 Depot")
    item = _make_item(seeded_client, auth_headers, sku="SKU-INV-PO2", name="PO2 Item")

    # no lines is rejected
    resp = seeded_client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "organization_id": 1,
            "po_number": "PO-INV-EMPTY",
            "supplier_name": "No Lines Ltd",
            "warehouse_id": wh["id"],
            "lines": [],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400

    # unknown item rejected
    resp = seeded_client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "organization_id": 1,
            "po_number": "PO-INV-BADITEM",
            "supplier_name": "Bad Item Ltd",
            "warehouse_id": wh["id"],
            "lines": [{"item_id": 99999999, "quantity": 1}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404

    # Unique per run is not possible on a shared DB, so always work on a
    # throwaway PO that this test fully controls.
    po_number = f"PO-INV-EDIT-{item['id']}-{item['id'] + 1}"
    resp = seeded_client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "organization_id": 1,
            "po_number": po_number,
            "supplier_name": "Editable Ltd",
            "warehouse_id": wh["id"],
            "lines": [{"item_id": item["id"], "quantity": 5, "unit_cost": 2}],
        },
        headers=auth_headers,
    )
    if resp.status_code == 409:
        # a PO with this number already exists from an earlier test in this
        # session; reuse it and normalise it back to a single 5 x 2 line.
        po = seeded_client.get(
            f"/api/v1/inventory/purchase-orders?search={po_number}", headers=auth_headers
        ).json()["items"][0]
        if po["status"] != "draft":
            return
        for line in po["lines"][1:]:
            seeded_client.delete(
                f"/api/v1/inventory/purchase-orders/{po['id']}/lines/{line['id']}",
                headers=auth_headers,
            )
        seeded_client.delete(
            f"/api/v1/inventory/purchase-orders/{po['id']}/lines/{po['lines'][0]['id']}",
            headers=auth_headers,
        )
        resp = seeded_client.post(
            f"/api/v1/inventory/purchase-orders/{po['id']}/lines",
            json={"item_id": item["id"], "quantity": 5, "unit_cost": 2},
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        po = seeded_client.get(
            f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
        ).json()
    else:
        assert resp.status_code == 201, resp.text
        po = resp.json()

    assert po["subtotal"] == 10

    # add a line and totals recalculate
    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/lines",
        json={"item_id": item["id"], "quantity": 3, "unit_cost": 4},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    resp = seeded_client.get(
        f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
    )
    assert resp.json()["subtotal"] == 22
    assert len(resp.json()["lines"]) == 2

    # delete a line and totals recalculate
    second_line = resp.json()["lines"][1]
    resp = seeded_client.delete(
        f"/api/v1/inventory/purchase-orders/{po['id']}/lines/{second_line['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 204, resp.text
    resp = seeded_client.get(
        f"/api/v1/inventory/purchase-orders/{po['id']}", headers=auth_headers
    )
    assert resp.json()["subtotal"] == 10

    # update header
    resp = seeded_client.put(
        f"/api/v1/inventory/purchase-orders/{po['id']}",
        json={"supplier_name": "Renamed Ltd", "tax_amount": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["supplier_name"] == "Renamed Ltd"
    assert resp.json()["total_amount"] == 11

    # approve then confirm edits are locked
    _approve_po(seeded_client, auth_headers, po["id"])

    resp = seeded_client.put(
        f"/api/v1/inventory/purchase-orders/{po['id']}",
        json={"supplier_name": "Too Late Ltd"},
        headers=auth_headers,
    )
    assert resp.status_code == 409

    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/lines",
        json={"item_id": item["id"], "quantity": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 409


def test_purchase_order_cancel_and_filters(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers, code="WH-INV-CXL", name="CXL Depot")
    item = _make_item(seeded_client, auth_headers, sku="SKU-INV-CXL", name="CXL Item")

    resp = seeded_client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "organization_id": 1,
            "po_number": "PO-INV-CANCEL",
            "supplier_name": "Cancel Ltd",
            "warehouse_id": wh["id"],
            "lines": [{"item_id": item["id"], "quantity": 1, "unit_cost": 1}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    po = resp.json()

    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/cancel", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["cancelled_at"] is not None

    # cannot cancel twice
    resp = seeded_client.post(
        f"/api/v1/inventory/purchase-orders/{po['id']}/cancel", headers=auth_headers
    )
    assert resp.status_code == 409

    # filters
    resp = seeded_client.get(
        "/api/v1/inventory/purchase-orders?status=cancelled", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(x["id"] == po["id"] for x in resp.json()["items"])

    resp = seeded_client.get(
        "/api/v1/inventory/purchase-orders?supplier_name=Cancel", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(x["id"] == po["id"] for x in resp.json()["items"])

    resp = seeded_client.get(
        f"/api/v1/inventory/purchase-orders?warehouse_id={wh['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert any(x["id"] == po["id"] for x in resp.json()["items"])


# ── Referential integrity ──────────────────────────────────────────────
def test_warehouse_with_stock_cannot_be_deleted(seeded_client, auth_headers, db_session):
    wh = _make_warehouse(seeded_client, auth_headers, code="WH-INV-BUSY", name="Busy Depot")
    item = _make_item(seeded_client, auth_headers, sku="SKU-INV-BUSY", name="Busy Item")
    _zero_level(seeded_client, auth_headers, wh["id"], item["id"])
    _receipt(seeded_client, auth_headers, wh["id"], item["id"], 4)

    level = db_session.scalar(
        select(StockLevel).where(
            StockLevel.warehouse_id == wh["id"], StockLevel.item_id == item["id"]
        )
    )
    assert level is not None

    resp = seeded_client.delete(
        f"/api/v1/inventory/warehouses/{wh['id']}", headers=auth_headers
    )
    assert resp.status_code == 409
    assert resp.json()["title"] == "Conflict"

    # item on a PO line cannot be deleted either
    resp = seeded_client.post(
        "/api/v1/inventory/purchase-orders",
        json={
            "organization_id": 1,
            "po_number": "PO-INV-BUSY",
            "supplier_name": "Busy Ltd",
            "warehouse_id": wh["id"],
            "lines": [{"item_id": item["id"], "quantity": 1, "unit_cost": 1}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    resp = seeded_client.delete(
        f"/api/v1/inventory/items/{item['id']}", headers=auth_headers
    )
    assert resp.status_code == 409


def test_movement_history_is_append_only_and_filterable(seeded_client, auth_headers):
    wh = _make_warehouse(seeded_client, auth_headers, code="WH-INV-HIST", name="Hist Depot")
    item = _make_item(
        seeded_client, auth_headers, sku="SKU-INV-HIST", name="Hist Item", reorder_level=0
    )
    _zero_level(seeded_client, auth_headers, wh["id"], item["id"])
    _receipt(seeded_client, auth_headers, wh["id"], item["id"], 15)

    resp = seeded_client.get(
        f"/api/v1/inventory/movements?item_id={item['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    moves = resp.json()["items"]
    assert moves
    assert all(m["item_id"] == item["id"] for m in moves)
    # newest first
    assert moves[0]["moved_at"] >= moves[-1]["moved_at"]

    resp = seeded_client.get(
        f"/api/v1/inventory/movements?item_id={item['id']}&movement_type=receipt",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert all(m["movement_type"] == "receipt" for m in resp.json()["items"])

    resp = seeded_client.get(
        f"/api/v1/inventory/movements?item_id={item['id']}&movement_type=issue",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert all(m["movement_type"] == "issue" for m in resp.json()["items"])

    mv_id = moves[0]["id"]
    resp = seeded_client.get(
        f"/api/v1/inventory/movements/{mv_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == mv_id

    resp = seeded_client.get("/api/v1/inventory/movements/99999999", headers=auth_headers)
    assert resp.status_code == 404
