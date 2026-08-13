def test_login_invalid_credentials(seeded_client):
    resp = seeded_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@isp-erp.example.com", "password": "wrong-password"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["title"] == "Unauthorized"


def test_login_success(seeded_client):
    resp = seeded_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@isp-erp.example.com", "password": "Password123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["token_type"] == "Bearer"
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["expires_in"] > 0


def test_me_requires_auth(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_with_token(seeded_client, auth_headers):
    resp = seeded_client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "admin@isp-erp.example.com"
    assert data["is_superuser"] is True
    assert any(r["code"] == "admin" for r in data["roles"])


def test_refresh_flow(seeded_client):
    resp = seeded_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@isp-erp.example.com", "password": "Password123!"},
    )
    refresh_token = resp.json()["refresh_token"]

    r2 = seeded_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r2.status_code == 200
    assert r2.json()["access_token"]

    # old refresh token must be revoked / not reusable
    r3 = seeded_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r3.status_code == 401


def test_logout_revokes_refresh(seeded_client):
    resp = seeded_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@isp-erp.example.com", "password": "Password123!"},
    )
    refresh_token = resp.json()["refresh_token"]

    out = seeded_client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert out.status_code == 204

    r3 = seeded_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r3.status_code == 401


def test_users_list_requires_auth(client):
    # Without token, /users must 401.
    resp = client.get("/api/v1/users")
    assert resp.status_code == 401


def test_users_list_as_admin(seeded_client, auth_headers):
    resp = seeded_client.get("/api/v1/users", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data and "total" in data
    assert any(u["email"] == "admin@isp-erp.example.com" for u in data["items"])
