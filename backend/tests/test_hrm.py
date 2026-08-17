"""Phase 3 — HRM tests: employees, designations, shifts, holidays, leave, attendance."""


# ── Designations ──────────────────────────────────────────────────────
def test_create_and_list_designations(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/designations",
        json={"organization_id": 1, "name": "Network Engineer", "code": "NE", "grade": "L3"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    did = resp.json()["id"]
    assert resp.json()["code"] == "NE"

    resp = seeded_client.get("/api/v1/designations", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    resp = seeded_client.put(
        f"/api/v1/designations/{did}",
        json={"grade": "L4"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["grade"] == "L4"

    resp = seeded_client.delete(f"/api/v1/designations/{did}", headers=auth_headers)
    assert resp.status_code == 204


# ── Employees ─────────────────────────────────────────────────────────
def test_create_and_list_employees(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/employees",
        json={
            "organization_id": 1,
            "employee_code": "EMP-001",
            "full_name": "John Doe",
            "phone": "+8801712345678",
            "email": "john@example.com",
            "joining_date": "2025-01-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    eid = resp.json()["id"]
    assert resp.json()["employee_code"] == "EMP-001"

    resp = seeded_client.get("/api/v1/employees", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    resp = seeded_client.put(
        f"/api/v1/employees/{eid}",
        json={"full_name": "John Doe Updated"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "John Doe Updated"


def test_duplicate_employee_code(seeded_client, auth_headers):
    seeded_client.post(
        "/api/v1/employees",
        json={"organization_id": 1, "employee_code": "DUP-001", "full_name": "A"},
        headers=auth_headers,
    )
    resp = seeded_client.post(
        "/api/v1/employees",
        json={"organization_id": 1, "employee_code": "DUP-001", "full_name": "B"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


# ── Shifts ─────────────────────────────────────────────────────────────
def test_create_shift_and_assign(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/shifts",
        json={
            "organization_id": 1,
            "name": "Morning Shift",
            "code": "MORN",
            "start_time": "09:00:00",
            "end_time": "17:00:00",
            "grace_minutes": 15,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    sid = resp.json()["id"]
    assert resp.json()["code"] == "MORN"

    resp = seeded_client.get("/api/v1/shifts", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # assign shift to employee created earlier
    resp = seeded_client.post(
        "/api/v1/employees",
        json={"organization_id": 1, "employee_code": "EMP-SHIFT", "full_name": "Shift Worker"},
        headers=auth_headers,
    )
    emp_id = resp.json()["id"]

    resp = seeded_client.post(
        "/api/v1/shifts/assign",
        json={"employee_id": emp_id, "shift_id": sid, "effective_from": "2025-01-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 201


# ── Holidays ──────────────────────────────────────────────────────────
def test_create_and_list_holidays(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/holidays",
        json={"organization_id": 1, "name": "New Year", "date": "2025-01-01", "is_recurring": True},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    hid = resp.json()["id"]
    assert resp.json()["name"] == "New Year"

    resp = seeded_client.get("/api/v1/holidays?year=2025", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    resp = seeded_client.put(f"/api/v1/holidays/{hid}", json={"description": "Happy New Year"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["description"] == "Happy New Year"


# ── Leave Types + Leave Requests + Balances ───────────────────────────
def test_leave_workflow(seeded_client, auth_headers):
    # create leave type
    resp = seeded_client.post(
        "/api/v1/leave-types",
        json={"organization_id": 1, "name": "Casual Leave", "code": "CL", "default_days": 12},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    ltid = resp.json()["id"]

    # create employee
    resp = seeded_client.post(
        "/api/v1/employees",
        json={"organization_id": 1, "employee_code": "EMP-LEAVE", "full_name": "Leave Tester"},
        headers=auth_headers,
    )
    emp_id = resp.json()["id"]

    # create leave balance
    resp = seeded_client.post(
        "/api/v1/leave-balances",
        json={"employee_id": emp_id, "leave_type_id": ltid, "year": 2025, "allocated_days": 12},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    lbid = resp.json()["id"]
    assert resp.json()["allocated_days"] == 12

    # create leave request
    resp = seeded_client.post(
        "/api/v1/leave-requests",
        json={"employee_id": emp_id, "leave_type_id": ltid, "from_date": "2025-01-10", "to_date": "2025-01-12", "reason": "Personal"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    lrid = resp.json()["id"]
    assert resp.json()["status"] == "pending"

    # approve leave request
    resp = seeded_client.post(
        f"/api/v1/leave-requests/{lrid}/action",
        json={"status": "approved", "approver_note": "OK"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    # verify balance updated (3 days used: 10,11,12)
    resp = seeded_client.get(f"/api/v1/leave-balances?employee_id={emp_id}&year=2025", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(item["used_days"] == 3.0 for item in items)

    # cannot re-approve
    resp = seeded_client.post(
        f"/api/v1/leave-requests/{lrid}/action",
        json={"status": "rejected"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_leave_request_invalid_dates(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/leave-types",
        json={"organization_id": 1, "name": "Sick", "code": "SL", "default_days": 10},
        headers=auth_headers,
    )
    ltid = resp.json()["id"]

    resp = seeded_client.post(
        "/api/v1/employees",
        json={"organization_id": 1, "employee_code": "EMP-BAD", "full_name": "Bad Dates"},
        headers=auth_headers,
    )
    emp_id = resp.json()["id"]

    resp = seeded_client.post(
        "/api/v1/leave-requests",
        json={"employee_id": emp_id, "leave_type_id": ltid, "from_date": "2025-01-20", "to_date": "2025-01-10"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


# ── Attendance ────────────────────────────────────────────────────────
def test_create_and_list_attendance(seeded_client, auth_headers):
    # create employee
    resp = seeded_client.post(
        "/api/v1/employees",
        json={"organization_id": 1, "employee_code": "EMP-ATT", "full_name": "Att Tester"},
        headers=auth_headers,
    )
    emp_id = resp.json()["id"]

    # check-in
    resp = seeded_client.post(
        "/api/v1/attendance",
        json={
            "employee_id": emp_id,
            "date": "2025-01-10",
            "attendance_type": "check_in",
            "local_ts": "2025-01-10T09:05:00Z",
            "latitude": 23.8103,
            "longitude": 90.4125,
            "gps_accuracy": 7.2,
            "source": "mobile",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    aid = resp.json()["id"]
    assert resp.json()["attendance_type"] == "check_in"

    # list
    resp = seeded_client.get(f"/api/v1/attendance?employee_id={emp_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    # correct
    resp = seeded_client.post(
        f"/api/v1/attendance/{aid}/correct",
        json={"attendance_id": aid, "previous_values": {"attendance_type": "check_in"}, "new_values": {"attendance_type": "check_in", "notes": "Late arrival"}, "reason": "GPS was inaccurate"},
        headers=auth_headers,
    )
    assert resp.status_code == 201


def test_invalid_attendance_type(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/employees",
        json={"organization_id": 1, "employee_code": "EMP-INV", "full_name": "Invalid"},
        headers=auth_headers,
    )
    emp_id = resp.json()["id"]

    resp = seeded_client.post(
        "/api/v1/attendance",
        json={"employee_id": emp_id, "date": "2025-01-10", "attendance_type": "invalid_type", "local_ts": "2025-01-10T09:00:00Z"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


# ── Unauthenticated blocked ───────────────────────────────────────────
def test_hrm_unauthenticated(client):
    for path in [
        "/api/v1/employees",
        "/api/v1/designations",
        "/api/v1/shifts",
        "/api/v1/holidays",
        "/api/v1/leave-types",
        "/api/v1/leave-requests",
        "/api/v1/attendance",
    ]:
        resp = client.get(path)
        assert resp.status_code == 401, path
