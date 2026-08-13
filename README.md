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

## Current status: **Phase 2 — Core ERP**

### Phase 1 — Foundation (complete)
- Repository scaffold (mono-repo): `backend/`, `frontend/`.
- Docker Compose: PostgreSQL 18 + PostGIS, Redis, FastAPI backend, nginx frontend.
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

### Phase 2 — Core ERP (complete)
- **Organizations** — full CRUD, search, pagination, audit-tracked.
- **Branches** — full CRUD, scoped to organization, audit-tracked.
- **Departments** — full CRUD, parent-child hierarchy, branch assignment,
  audit-tracked.
- **Roles** — full CRUD with permission assignment (`permission_ids` on
  create/update), system-role protection (cannot delete system roles or change
  their code), audit-tracked.
- **Permissions** — full CRUD, filterable by module, audit-tracked.
- **Users** — full CRUD with role + permission assignment, superuser protection
  (cannot delete superusers), password change (`/users/me/change-password`),
  duplicate-email validation, audit-tracked.
- **Audit Logs** — read-only listing with powerful filtering (user, action,
  entity_type, entity_id), pagination, newest-first ordering.
- **System Settings** — full CRUD (JSON values, categories), audit-tracked.
- **RBAC**: Every endpoint enforces permission codes
  (`core:organizations:read/write`, `core:branches:*`, `core:departments:*`,
  `core:roles:*`, `core:users:*`, `core:audit:read`, `core:settings:*`).
  Superuser bypasses all permission checks.
- **Frontend**: Full pages for Users, Roles (with permission checkboxes),
  Organizations (with Branches + Departments tabs), Audit Logs (with filters),
  Settings. All using TanStack Query + React Hook Form + Zod validation.
  Navigation sidebar with permission-gated links. Shared components: Modal,
  Table, Pagination, Spinner.

## Live deployment

| | |
|---|---|
| URL | http://103.177.54.6:8040 |
| Swagger docs | http://103.177.54.6:8040/docs |
| Admin email | `admin@isp-erp.example.com` |
| Admin password | stored in `/opt/isp-erp/.env` on the server |

## Repository layout

```
isp-erp/
  docs/                     # architecture + database design
  backend/                  # FastAPI + SQLAlchemy + Alembic
    app/
      api/v1/               # routers: auth, users, organizations, roles,
                            #   audit, settings, health
      core/                 # security, rbac, audit, logging
      db/                   # base, session
      models/               # core models (org, branch, dept, role, perm,
                            #   user, refresh_token, audit_log, settings)
      schemas/              # Pydantic schemas (auth, org, users, audit)
      services/             # business logic (auth, org, dept, role, user,
                            #   audit services)
    alembic/                # migrations
    tests/                  # pytest (25 tests)
    pyproject.toml
    Dockerfile
  frontend/                 # React + TS + Vite + Tailwind
    src/
      components/            # Button, Input, Card, Badge, Modal, Table,
                            #   Spinner, AppShell, ui helpers
      lib/                   # api, auth, auth-api, core-api, utils
      pages/                # Login, Dashboard, Users, Roles, Organizations,
                            #   AuditLogs, Settings
    tests/                  # vitest (6 tests)
    package.json
    Dockerfile
  docker-compose.yml
  .env.example
  README.md
  docs/
    architecture.md
    database-design.md
```

## API endpoints (Phase 2)

```
POST   /api/v1/auth/login               # email + password → access + refresh JWT
POST   /api/v1/auth/refresh             # rotate refresh token
POST   /api/v1/auth/logout              # revoke refresh token
GET    /api/v1/auth/me                  # current user with roles + permissions

GET    /api/v1/users                    # paginated, searchable, filterable
POST   /api/v1/users                    # create user with role/perm assignment
GET    /api/v1/users/{id}               # get single user
PUT    /api/v1/users/{id}               # update user (including roles/perms)
DELETE /api/v1/users/{id}               # delete (blocks superuser delete)
POST   /api/v1/users/me/change-password # change own password

GET    /api/v1/organizations            # paginated, searchable
POST   /api/v1/organizations            # create
GET    /api/v1/organizations/{id}       # get
PUT    /api/v1/organizations/{id}       # update
DELETE /api/v1/organizations/{id}       # delete

GET    /api/v1/branches                # filter by organization_id
POST   /api/v1/branches                # create
GET    /api/v1/branches/{id}           # get
PUT    /api/v1/branches/{id}           # update
DELETE /api/v1/branches/{id}           # delete

GET    /api/v1/departments             # filter by org, branch
POST   /api/v1/departments             # create
GET    /api/v1/departments/{id}        # get
PUT    /api/v1/departments/{id}        # update
DELETE /api/v1/departments/{id}        # delete

GET    /api/v1/roles                   # with embedded permissions
POST   /api/v1/roles                   # create with permission_ids
GET    /api/v1/roles/{id}              # get with permissions
PUT    /api/v1/roles/{id}              # update (including permission_ids)
DELETE /api/v1/roles/{id}             # delete (blocks system roles)

GET    /api/v1/permissions             # filterable by module
POST   /api/v1/permissions             # create
PUT    /api/v1/permissions/{id}        # update
DELETE /api/v1/permissions/{id}       # delete

GET    /api/v1/audit-logs              # filter by user, action, entity
GET    /api/v1/audit-logs/{id}         # get single log entry

GET    /api/v1/settings                # filterable by category
POST   /api/v1/settings                # create
GET    /api/v1/settings/{id}           # get
PUT    /api/v1/settings/{id}           # update
DELETE /api/v1/settings/{id}          # delete

GET    /api/v1/health/live             # liveness probe
GET    /api/v1/health/ready            # readiness (db + redis + postgis)
```

## Permission codes (Phase 2)

```
core:users:read        core:users:write
core:roles:read        core:roles:write
core:organizations:read  core:organizations:write
core:branches:read       core:branches:write
core:departments:read    core:departments:write
core:settings:read       core:settings:write
core:audit:read
```

## Quick start (Docker)

```bash
cp .env.example .env          # then edit secrets
docker compose build
docker compose up -d db redis
docker compose up -d backend frontend
docker compose exec backend alembic upgrade head
docker compose exec backend python -c "from app.db.session import SessionLocal; from app.bootstrap import seed_initial_data; s=SessionLocal(); print(seed_initial_data(s)); s.close()"
# visit http://localhost:8040
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
# backend (25 tests)
cd backend && pytest -q
# frontend (6 tests)
cd frontend && npm test -- --run
```

## CI

GitHub Actions (`.github/workflows/ci.yml`):
- **frontend job**: typecheck → lint → test → build
- **backend job**: ruff → alembic upgrade head (against postgis container) → pytest

## Phasing

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Complete | Foundation (auth, Docker, DB, CI) |
| 2 | ✅ Complete | Core ERP (org, branches, departments, roles, permissions, users, audit, settings) |
| 3 | Pending | HRM (employees, attendance, leave, shifts, payroll structure) |
| 4 | Pending | Mobile (React Native + GPS + facial + offline sync) |
| 5 | Pending | Customers + Field Service |
| 6 | Pending | Network GIS (map, OLT, fiber, TJ boxes, enclosures, splitters) |
| 7 | Pending | Network Trace |
| 8 | Pending | Inventory |
| 9 | Pending | Procurement |
| 10 | Pending | Accounting |
| 11 | Pending | Operational Billing |
| 12 | Pending | Reporting + hardening |

## Security notes

- Never hard-code secrets; copy `.env.example` to `.env` and fill in real values.
- Never expose database directly to the frontend.
- All protected endpoints enforce RBAC server-side.
- Financial transactions will be immutable after posting; corrections use reversals.
- All CRUD operations on core entities are audit-logged with previous/new values.