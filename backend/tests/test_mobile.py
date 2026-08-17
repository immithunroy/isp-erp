"""Phase 4 — Mobile endpoint tests: GPS, attendance, sync, profile, settings."""


def test_mobile_profile(seeded_client, auth_headers):
    resp = seeded_client.get("/api/v1/mobile/profile", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == 1
    assert data["employee_id"] is not None
    assert data["employee_code"] == "ADMIN-EMP"
    assert data["email"] is not None


def test_mobile_settings(seeded_client, auth_headers):
    resp = seeded_client.get("/api/v1/mobile/settings", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "gps_max_accuracy_meters" in data
    assert "face_verification_required" in data
    assert "sync_interval_seconds" in data
    assert data["tracking_enabled"] is False


def test_submit_gps_record(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/mobile/gps",
        json={
            "latitude": 23.8103,
            "longitude": 90.4125,
            "accuracy": 7.2,
            "recorded_at": "2025-01-10T09:00:00Z",
            "activity": "attendance",
            "device_id": "test-device-001",
            "notes": "Test GPS",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["latitude"] == 23.8103
    assert resp.json()["activity"] == "attendance"


def test_submit_gps_poor_accuracy_warning(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/mobile/gps",
        json={
            "latitude": 23.8103,
            "longitude": 90.4125,
            "accuracy": 120.0,
            "recorded_at": "2025-01-10T09:00:00Z",
            "activity": "customer_visit",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "WARNING" in (resp.json()["notes"] or "")


def test_submit_attendance_mobile(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/mobile/attendance",
        json={
            "employee_id": 1,
            "date": "2025-01-10",
            "attendance_type": "check_in",
            "local_ts": "2025-01-10T09:05:00Z",
            "latitude": 23.8103,
            "longitude": 90.4125,
            "gps_accuracy": 5.0,
            "face_verified": True,
            "face_score": 0.95,
            "device_id": "test-device-001",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["attendance_type"] == "check_in"
    assert data["face_verified"] is True
    assert data["source"] == "mobile"


def test_submit_invalid_attendance_type(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/mobile/attendance",
        json={
            "employee_id": 1,
            "date": "2025-01-10",
            "attendance_type": "invalid",
            "local_ts": "2025-01-10T09:00:00Z",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_sync_batch_attendance(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/mobile/sync",
        json={
            "items": [
                {
                    "idempotency_key": "test-att-001",
                    "entity_type": "attendance",
                    "payload": {
                        "employee_id": 1,
                        "date": "2025-01-11",
                        "attendance_type": "check_in",
                        "local_ts": "2025-01-11T08:30:00Z",
                        "latitude": 23.81,
                        "longitude": 90.41,
                        "gps_accuracy": 4.0,
                    },
                },
            ]
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["succeeded"] == 1
    assert data["results"][0]["status"] == "done"
    assert data["results"][0]["record_id"] is not None


def test_sync_batch_idempotency(seeded_client, auth_headers):
    payload = {
        "items": [
            {
                "idempotency_key": "test-idem-001",
                "entity_type": "attendance",
                "payload": {
                    "employee_id": 1,
                    "date": "2025-01-12",
                    "attendance_type": "check_in",
                    "local_ts": "2025-01-12T09:00:00Z",
                },
            }
        ]
    }
    # First submit
    resp1 = seeded_client.post("/api/v1/mobile/sync", json=payload, headers=auth_headers)
    assert resp1.status_code == 200
    record_id_1 = resp1.json()["results"][0]["record_id"]

    # Second submit with same idempotency key — must NOT create duplicate
    resp2 = seeded_client.post("/api/v1/mobile/sync", json=payload, headers=auth_headers)
    assert resp2.status_code == 200
    record_id_2 = resp2.json()["results"][0]["record_id"]

    assert record_id_1 == record_id_2
    assert resp2.json()["succeeded"] == 1


def test_sync_batch_gps(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/mobile/sync",
        json={
            "items": [
                {
                    "idempotency_key": "test-gps-001",
                    "entity_type": "gps",
                    "payload": {
                        "latitude": 23.8,
                        "longitude": 90.4,
                        "accuracy": 10.0,
                        "recorded_at": "2025-01-10T10:00:00Z",
                        "activity": "job",
                    },
                }
            ]
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["succeeded"] == 1


def test_sync_batch_mixed(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/mobile/sync",
        json={
            "items": [
                {
                    "idempotency_key": "test-mix-att",
                    "entity_type": "attendance",
                    "payload": {
                        "employee_id": 1,
                        "date": "2025-01-13",
                        "attendance_type": "check_out",
                        "local_ts": "2025-01-13T17:00:00Z",
                    },
                },
                {
                    "idempotency_key": "test-mix-gps",
                    "entity_type": "gps",
                    "payload": {
                        "latitude": 23.81,
                        "longitude": 90.41,
                        "accuracy": 8.0,
                        "recorded_at": "2025-01-13T17:00:00Z",
                        "activity": "attendance",
                    },
                },
            ]
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["succeeded"] == 2


def test_sync_unknown_entity_type(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/mobile/sync",
        json={
            "items": [
                {
                    "idempotency_key": "test-unknown",
                    "entity_type": "unknown_entity",
                    "payload": {},
                }
            ]
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["failed"] == 1
    assert data["results"][0]["status"] == "failed"


def test_mobile_unauthenticated(client):
    for path in ["/api/v1/mobile/profile", "/api/v1/mobile/settings"]:
        resp = client.get(path)
        assert resp.status_code == 401, path
