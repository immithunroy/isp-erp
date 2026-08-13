"""Phase 2 — Core ERP CRUD + permission tests."""
from app.models.core import User
from app.core.security import hash_password
from app.services import organization_service, role_service, user_service


def test_create_and_list_organizations(seeded_client, auth_headers, db_session):
    resp = seeded_client.post(
        "/api/v1/organizations",
        json={"name": "Test ISP", "code": "TISP"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Test ISP"

    resp = seeded_client.get("/api/v1/organizations", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2

    # find Test ISP
    org = db_session.query(
        __import__("app.models.core", fromlist=["Organization"]).Organization
    ).filter_by(code="TISP").first()
    assert org is not None

    # update
    resp = seeded_client.put(
        f"/api/v1/organizations/{org.id}",
        json={"legal_name": "Test ISP Ltd"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["legal_name"] == "Test ISP Ltd"

    # delete
    resp = seeded_client.delete(f"/api/v1/organizations/{org.id}", headers=auth_headers)
    assert resp.status_code == 204


def test_create_and_list_branches(seeded_client, auth_headers):
    # get org id
    orgs = seeded_client.get("/api/v1/organizations", headers=auth_headers).json()
    org_id = orgs["items"][0]["id"]

    resp = seeded_client.post(
        "/api/v1/branches",
        json={"organization_id": org_id, "name": "Main Branch", "code": "MAIN"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["code"] == "MAIN"

    resp = seeded_client.get("/api/v1/branches", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


def test_create_and_list_departments(seeded_client, auth_headers):
    orgs = seeded_client.get("/api/v1/organizations", headers=auth_headers).json()
    org_id = orgs["items"][0]["id"]

    resp = seeded_client.post(
        "/api/v1/departments",
        json={"organization_id": org_id, "name": "Network Ops", "code": "NETOPS"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    dept_id = resp.json()["id"]

    resp = seeded_client.get("/api/v1/departments", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    resp = seeded_client.put(
        f"/api/v1/departments/{dept_id}",
        json={"name": "Network Operations"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Network Operations"


def test_create_role_with_permissions(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/roles",
        json={
            "name": "Manager",
            "code": "manager",
            "description": "Department manager",
            "permission_ids": [1, 2],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    role_id = resp.json()["id"]
    perm_ids = [p["id"] for p in resp.json()["permissions"]]
    assert 1 in perm_ids and 2 in perm_ids

    # update role permissions
    resp = seeded_client.put(
        f"/api/v1/roles/{role_id}",
        json={"permission_ids": [3]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    perm_ids = [p["id"] for p in resp.json()["permissions"]]
    assert perm_ids == [3]

    # delete role (non-system)
    resp = seeded_client.delete(f"/api/v1/roles/{role_id}", headers=auth_headers)
    assert resp.status_code == 204


def test_cannot_delete_system_role(seeded_client, auth_headers):
    resp = seeded_client.get("/api/v1/roles", headers=auth_headers)
    admin_role = [r for r in resp.json()["items"] if r["code"] == "admin"][0]
    resp = seeded_client.delete(f"/api/v1/roles/{admin_role['id']}", headers=auth_headers)
    assert resp.status_code == 400


def test_create_and_list_permissions(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/permissions",
        json={"code": "customers:read", "module": "customers", "description": "Read customers"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    perm_id = resp.json()["id"]

    resp = seeded_client.get("/api/v1/permissions", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 14


def test_create_user_with_roles(seeded_client, auth_headers):
    roles = seeded_client.get("/api/v1/roles", headers=auth_headers).json()
    role_id = roles["items"][0]["id"]

    resp = seeded_client.post(
        "/api/v1/users",
        json={
            "email": "testuser@example.com",
            "full_name": "Test User",
            "password": "Password123!",
            "role_ids": [role_id],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    user_id = resp.json()["id"]
    assert resp.json()["email"] == "testuser@example.com"
    assert len(resp.json()["roles"]) == 1

    # update user
    resp = seeded_client.put(
        f"/api/v1/users/{user_id}",
        json={"full_name": "Test User Updated"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Test User Updated"

    # delete user
    resp = seeded_client.delete(f"/api/v1/users/{user_id}", headers=auth_headers)
    assert resp.status_code == 204


def test_cannot_create_duplicate_user(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/users",
        json={"email": "admin@isp-erp.example.com", "full_name": "Dup", "password": "Password123!"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


def test_cannot_delete_superuser(seeded_client, auth_headers):
    resp = seeded_client.get("/api/v1/users", headers=auth_headers)
    admin = [u for u in resp.json()["items"] if u["is_superuser"]][0]
    resp = seeded_client.delete(f"/api/v1/users/{admin['id']}", headers=auth_headers)
    assert resp.status_code == 400


def test_change_password(seeded_client, auth_headers):
    # Create a separate user for password change test to avoid breaking admin.
    if not seeded_client.get("/api/v1/users", headers=auth_headers).json()["items"]:
        pass
    seeded_client.post(
        "/api/v1/users",
        json={
            "email": "pwdtest@example.com",
            "full_name": "PWD Test",
            "password": "PwdTest123!",
        },
        headers=auth_headers,
    )
    # login as PWD Test user
    resp = seeded_client.post(
        "/api/v1/auth/login",
        json={"email": "pwdtest@example.com", "password": "PwdTest123!"},
    )
    assert resp.status_code == 200
    tok = resp.json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}

    # change password
    resp = seeded_client.post(
        "/api/v1/users/me/change-password",
        json={"current_password": "PwdTest123!", "new_password": "NewPassword456!"},
        headers=h,
    )
    assert resp.status_code == 204

    # login with new password
    resp = seeded_client.post(
        "/api/v1/auth/login",
        json={"email": "pwdtest@example.com", "password": "NewPassword456!"},
    )
    assert resp.status_code == 200

    # login with old must fail
    resp = seeded_client.post(
        "/api/v1/auth/login",
        json={"email": "pwdtest@example.com", "password": "PwdTest123!"},
    )
    assert resp.status_code == 401


def test_audit_logs_list(seeded_client, auth_headers):
    # Do something that produces audit
    seeded_client.post(
        "/api/v1/organizations",
        json={"name": "Audit Test Co", "code": "AUDIT"},
        headers=auth_headers,
    )
    resp = seeded_client.get("/api/v1/audit-logs", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(log["action"] == "organization.create" for log in data["items"])


def test_audit_log_filter_by_entity_type(seeded_client, auth_headers):
    resp = seeded_client.get(
        "/api/v1/audit-logs?entity_type=organization", headers=auth_headers
    )
    assert resp.status_code == 200
    for log in resp.json()["items"]:
        assert log["entity_type"] == "organization"


def test_create_and_list_settings(seeded_client, auth_headers):
    resp = seeded_client.post(
        "/api/v1/settings",
        json={"key": "gps.max_accuracy", "value": {"meters": 50}, "category": "gps",
              "description": "Max GPS accuracy threshold"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    setting_id = resp.json()["id"]

    resp = seeded_client.get("/api/v1/settings", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    resp = seeded_client.put(
        f"/api/v1/settings/{setting_id}",
        json={"value": {"meters": 25}},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["value"]["meters"] == 25

    resp = seeded_client.delete(f"/api/v1/settings/{setting_id}", headers=auth_headers)
    assert resp.status_code == 204


def test_unauthenticated_users_blocked(client):
    for path in [
        "/api/v1/organizations",
        "/api/v1/roles",
        "/api/v1/permissions",
        "/api/v1/audit-logs",
        "/api/v1/settings",
    ]:
        resp = client.get(path)
        assert resp.status_code == 401, path