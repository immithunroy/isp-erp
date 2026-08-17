"""Pytest fixtures.

Because the target environment runs PostgreSQL + PostGIS, tests use a real
database when DATABASE_URL points to a test DB (env var TEST_DATABASE_URL or
DATABASE_URL). When no DB is reachable, the FastAPI TestClient is still used
with monkeypatched DB dependencies backed by an in-memory SQLite fallback so
that pure-routing / validation / auth-logic tests can run anywhere.
"""
from __future__ import annotations

import os
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Make backend importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402, F401  # register all models with metadata
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402

# Try to detect a real test database
_test_db_url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
_has_pg = bool(_test_db_url and "postgresql" in _test_db_url)


@pytest.fixture(scope="session")
def db_engine():
    if _has_pg:
        engine = create_engine(_test_db_url, pool_pre_ping=True, future=True)
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
    else:
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
        # SQLite cannot enable postgis; just create non-spatial tables
        Base.metadata.create_all(engine, tables=[
            t for t in Base.metadata.sorted_tables
            if t.name in {
                "organizations", "branches", "departments", "roles", "permissions",
                "role_permissions", "user_roles", "user_permissions", "users",
                "refresh_tokens", "audit_logs", "system_settings",
                # HRM
                "designations", "employees", "shifts", "employee_shifts",
                "holidays", "leave_types", "leave_balances", "leave_requests",
                "attendance", "attendance_corrections",
                # Mobile
                "gps_records", "sync_queue",
            }
        ])
    yield engine
    if _has_pg:
        Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def db_session(db_engine) -> Generator:
    SessionLocal = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db_session) -> Generator[TestClient, None, None]:
    from app.main import app

    def _override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded_client(client, db_session):
    from app.bootstrap import seed_initial_data

    seed_initial_data(db_session, admin_password="Password123!")
    # Link employee to admin user for mobile endpoint tests
    from sqlalchemy import select

    from app.models.hrm import Employee

    emp = db_session.scalar(select(Employee).where(Employee.user_id == 1))
    if not emp:
        emp = Employee(
            organization_id=1,
            user_id=1,
            employee_code="ADMIN-EMP",
            full_name="System Administrator",
            email="admin@isp-erp.example.com",
            is_active=True,
        )
        db_session.add(emp)
        db_session.commit()
    return client


@pytest.fixture()
def auth_token(seeded_client) -> str:
    resp = seeded_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@isp-erp.example.com", "password": "Password123!"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture()
def auth_headers(auth_token) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}
