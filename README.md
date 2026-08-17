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

## Current status: **Phase 4 — Mobile**

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

### Phase 3 — HRM (complete)
- **Employees** — full CRUD with employee_code (unique), department, designation,
  supervisor (self-ref), branch, linked user, employment status, emergency
  contact, joining date, notes. Audit-tracked.
- **Designations** — full CRUD with department link, grade, org-scoped unique code.
- **Shifts** — full CRUD with start/end time, grace minutes, org-scoped.
- **Employee Shift Assignment** — assign shifts to employees with effective date range.
- **Holidays** — full CRUD with date, scope (org/branch), recurring flag, year filter.
- **Leave Types** — full CRUD with default days, paid/unpaid, org-scoped.
- **Leave Balances** — create/update balances per employee per leave type per year.
- **Leave Requests** — create with date range, approve/reject workflow
  (auto-updates leave balance used_days on approval), cannot re-approve,
  from_date ≤ to_date validation.
- **Attendance** — create with GPS (lat/lon/accuracy), face verification fields,
  device tracking, valid attendance types (check_in/check_out/break_resume/
  break_end/field). Attendance correction with audit trail (previous/new values,
  reason, approver).
- **RBAC**: 16 new permission codes (`hrm:employees:*`, `hrm:designations:*`,
  `hrm:shifts:*`, `hrm:holidays:*`, `hrm:leave:*`, `hrm:attendance:*`).
- **Frontend**: Full pages for Employees, Designations, Shifts, Holidays,
  Leave (tabbed: Leave Types + Leave Requests + Leave Balances), Attendance.
  All using TanStack Query + React Hook Form. HRM section in navigation sidebar.

### Phase 4 — Mobile (complete)
- **React Native + Expo app** (`mobile/` directory) with TypeScript (strict)
- **18 screens**: Login, Dashboard, Attendance, GPS, Jobs, Customer List/Detail/Location,
  Network Asset, TJ Box, Enclosure, Splitter, Fiber Survey, Photo Capture, Equipment
  Scan, Job Completion, Notifications, Profile (13 as placeholders for later phases)
- **Employee login** with JWT stored in `expo-secure-store`
- **GPS capture** via `expo-location` with accuracy display + configurable threshold
  warning (from `/mobile/settings`)
- **Facial attendance architecture**: Camera-based face capture with placeholder
  verification (returns `face_verified: true, face_score: 0.0`; actual face recognition
  to be integrated later). Full 4-step attendance flow: type → GPS → face → submit
- **Offline-first architecture**: SQLite local queue (`expo-sqlite`) with idempotency
  keys (UUID), automatic sync when online (`expo-network`), retry with backoff,
  sync status indicator, batch sync via `POST /mobile/sync`
- **Backend mobile endpoints**: `/mobile/profile`, `/mobile/settings`,
  `/mobile/attendance`, `/mobile/gps`, `/mobile/sync` (batch with idempotency)
- **Backend models**: `GpsRecord`, `SyncQueue` + migration `0003_mobile`
- **4 new permission codes** (`mobile:*`), **12 new backend tests** (47 total)
- GPS accuracy validation with configurable threshold (accept with warning if exceeded)
- Sync idempotency: duplicate requests with same key return same record_id (no duplicates)

## Live deployment

| | |
|---|---|
| URL | http://103.177.54.6:8040 |
| Swagger docs | http://103.177.54.6:8040/docs |
| Admin email | `mithun@qbinternet.com` |
| Admin password | stored in `/opt/isp-erp/.env` on the server |

## Repository layout

```
isp-erp/
  docs/                     # architecture + database design
  backend/                  # FastAPI + SQLAlchemy + Alembic
  frontend/                 # React + TS + Vite + Tailwind (web)
  mobile/                   # React Native + Expo (field workforce app)
    src/
      api/                 # client, auth, mobile API functions
      store/               # auth + sync context providers
      db/                  # SQLite offline queue
      components/          # Button, Input, Card, GPSCapture, FaceCapture, etc.
      screens/             # 18 screens (Login, Dashboard, Attendance, GPS, etc.)
      navigation/          # stack + tab navigators
      types/               # shared TypeScript types
      utils/               # idempotency + datetime helpers
    App.tsx
    package.json
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
# backend (47 tests)
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
| 3 | ✅ Complete | HRM (employees, designations, shifts, holidays, leave, attendance) |
| 4 | ✅ Complete | Mobile (React Native + Expo + GPS + facial + offline sync) |
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