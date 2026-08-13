# ISP Operations ERP

A production-grade **ISP Operations ERP** focused on the internal operations of
an Internet Service Provider — HRM, mobile workforce, customer operations,
accounting, operational billing (**not** AAA/PPPoE), inventory, procurement,
field service, and especially a **GIS-based physical fiber network management
system** capable of handling thousands of customers and tens of thousands of
network assets.

> This repository is **NOT** an ISP AAA / billing / PPPoE / hotspot / RADIUS /
> bandwidth-enforcement platform. Those concerns are explicitly out of scope.

See [`isp-erp-prompt.txt`](./isp-erp-prompt.txt) for the full specification and
[`docs/architecture.md`](./docs/architecture.md) /
[`docs/database-design.md`](./docs/database-design.md) for the design.

## Current status: **Phase 1 — Foundation**

Implemented:

- Repository scaffold (mono-repo): `backend/`, `frontend/`.
- Docker Compose: `postgres` (+ PostGIS), `redis`, `backend`, `frontend`.
- FastAPI backend skeleton with config, DB session, health checks, structured
  errors, pagination utilities.
- Auth foundation: users / roles / permissions / RBAC dependencies, password
  hashing (argon2 via passlib), short-lived access JWT + rotating refresh
  tokens (stored hashed), login / refresh / logout / me endpoints.
- SQLAlchemy 2.x declarative models for Core/Auth schema + Alembic migrations
  (PostGIS extension enabled in initial migration).
- React + TypeScript (strict) + Vite + Tailwind + shadcn-style components.
- Frontend auth: TanStack Query client, login page, token storage, protected
  route skeleton, health status indicator.
- Initial tests: backend pytest (health + auth), frontend vitest.
- CI skeleton via GitHub Actions.

## Repository layout

```
isp-erp/
  docs/                     # architecture + database design
  backend/                  # FastAPI backend
    app/
    alembic/
    tests/
    pyproject.toml
    Dockerfile
  frontend/                 # React + TS + Vite
    src/
    package.json
    Dockerfile
  docker-compose.yml
  .env.example
  README.md
```

## Quick start (Docker)

```bash
cp .env.example .env          # then edit secrets
docker compose build
docker compose up -d db redis
docker compose up -d backend frontend
docker compose exec backend alembic upgrade head
# visit http://localhost:5173 (web) and http://localhost:8000/docs (API)
```

## Quick start (local dev)

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Tests

```bash
# backend
cd backend && pytest -q
# frontend
cd frontend && npm test -- --run
```

## Phasing

Phase 1 (this commit) → Foundation.
Phases 2–12 (Core ERP, HRM, Mobile, Customers+Field Service, Network GIS,
Network Trace, Inventory, Procurement, Accounting, Operational Billing,
Reporting + hardening) will be built incrementally, with checks between phases
per the spec's "Definition of Done".

## Security notes

- Never hard-code secrets; copy `.env.example` to `.env` and fill in real values.
- Never expose database directly to the frontend.
- All protected endpoints enforce RBAC server-side.
- Financial transactions are immutable after posting; corrections use reversals.