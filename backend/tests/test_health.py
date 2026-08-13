def test_live():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        resp = c.get("/api/v1/health/live")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


def test_ready_with_overridden_db(client):
    # readiness handler will report redis 'down' in CI without redis,
    # but database component should be 'ok' (overridden in-memory session).
    resp = client.get("/api/v1/health/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert "checks" in body
    db_check = next((c for c in body["checks"] if c["name"] == "database"), None)
    assert db_check and db_check["status"] == "ok"


def test_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert "name" in resp.json()
