# ISP Operations ERP — Architecture

> Status: Phase 1 — Foundation. This document describes the target architecture and
> the foundation currently implemented.

## 1. Purpose

ISP Operations ERP is a **modular monolith** for managing the internal operations
of an Internet Service Provider. It is **NOT** an ISP AAA / billing / PPPoE /
hotspot / RADIUS / bandwidth-enforcement platform.

It focuses on HRM, Mobile Workforce, Customers (operational records only),
Accounting, Operational Billing (non-AAA), Inventory, Procurement, Field Service,
Network Infrastructure, **GIS-based physical network management**, Network
Topology, Reports, Notifications and Audit Logs.

The single most important differentiator is:

> A GIS-based ISP physical network management system capable of managing
> thousands of customers and thousands of physical network assets.

## 2. High-Level Architecture

```
                Web (browser)
                     |
                     v
         React + TypeScript + Vite
                     |
                     v
                  REST API
                     |
                     v
                  FastAPI
                     |
        +------------+------------+
        |                         |
  Business Services          GIS Services
        |                         |
        +------------+------------+
                     |
                     v
               SQLAlchemy 2.x
                     |
                     v
         PostgreSQL + PostGIS
                     |
                     v
                   Redis
```

Mobile:

```
React Native + Expo  ->  FastAPI (/api/v1)  ->  PostgreSQL/PostGIS
```

### 2.1 Architectural style

- **Modular monolith** — one deployable backend, organised by module
  (`core`, `hrm`, `customers`, `network`, `accounting`, `inventory`,
  `procurement`, `field_service`, `gis`, ...).
- No microservices unless explicitly requested.
- Modules share the same database but expose each other only through
  well-defined service boundaries (no cross-module direct ORM reach where
  avoidable).

## 3. Technology Stack

| Layer            | Choice                                                    |
| ---------------- | -------------------------------------------------------- |
| Web frontend     | React, TypeScript (strict), Vite, Tailwind CSS, shadcn/ui |
| Web routing/data | React Router, TanStack Query, React Hook Form, Zod, Zustand (rare), Recharts |
| Backend          | Python, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic   |
| Database         | PostgreSQL + PostGIS (SRID 4326)                         |
| Cache / jobs     | Redis, Celery (when required)                            |
| Mobile           | React Native, Expo, TypeScript                           |
| Mapping          | Leaflet + OpenStreetMap; pluggable provider abstraction  |
| Deployment       | Docker, Docker Compose, Caddy/Nginx, Ubuntu LTS         |
| CI/CD            | GitHub Actions                                           |
| Tests            | Vitest + RTL (frontend), Pytest (backend)                |

## 4. Backend module layout

The backend follows a **module-per-domain** structure. Each module owns its
models, schemas, services, routers, and tests. Shared infrastructure lives in
`app/core` and `app/db`.

```
backend/app/
  main.py                  # FastAPI app factory, middleware, router wiring
  config.py                # pydantic-settings based config
  core/
    security.py            # password hashing, JWT issue/verify
    rbac.py                # permission enforcement dependencies
    audit.py               # audit log writer
    logging.py
  db/
    base.py                # DeclarativeBase + common mixins (id, timestamps)
    session.py             # engine, SessionLocal, get_db dependency
    mixins.py
  modules/
    core/                  # users, roles, permissions, organization, audit, settings
    hrm/
    mobile/
    customers/
    field_service/
    network/               # OLT, POP, ODF, fiber, cores, tj_box, enclosure, splitter, splice
    gis/                   # bbox queries, spatial search, map endpoints
    inventory/
    procurement/
    accounting/
    billing/               # operational billing only
    reports/
    notifications/
  api/
    v1/
      router.py            # aggregates all module routers under /api/v1
      health.py
      auth.py
  ...
```

Business logic MUST live in `services/`, not in routers, and not in the frontend.

## 5. API conventions

- All endpoints under `/api/v1/`.
- Pagination, filtering, sorting on list endpoints via query params.
- Structured error responses (`type`, `title`, `detail`, `status`, `instance`).
- Authorization enforced on every protected endpoint (never trust the client).
- GIS list endpoints accept a `bbox` and perform **server-side** spatial
  filtering + clustering; the client never loads the whole network.

## 6. GIS / Topology separation

Two distinct but connected concepts:

- **GIS** answers *"Where is it?"* — PostGIS geometry + spatial indexes.
- **Topology** answers *"What is it connected to?"* — explicit relationships
  (fiber core <-> splice <-> fiber core, splitter ports, customer links).

> Physical proximity ≠ network connection. All real connections are explicit
> rows in the database (splices, port links, customer-to-asset links).

## 7. Authentication & Security

- Password hashing (argon2/bcrypt via passlib).
- JWT access tokens (short-lived) + refresh tokens (rotating, stored hashed).
- RBAC: users have roles; roles have permissions; permissions enforced via
  dependency injectors.
- Rate limiting, input validation (Pydantic), secure file upload, audit logging
  for important mutations, secret management via env/config — never hard-coded.

## 8. Scale considerations

Designed for 10k+ customers, 10k+ network assets, 100k+ fiber cores, thousands
of TJ boxes / enclosures / splitters, 1k+ field users, large GPS histories:

- Proper PK indexes, FKs, GiST spatial indexes, B-tree on filter columns.
- Pagination + server-side filtering everywhere.
- Map uses bounding-box queries + clustering + lazy loading + vector tiles.
- Redis caching where appropriate.

## 9. Phasing

### Phase 1 — Foundation (complete)
Repository, Docker, PostgreSQL+PostGIS, Redis, FastAPI skeleton, React+TS
skeleton, Tailwind, auth foundation (users/roles/permissions/RBAC login +
token issuance), Alembic, health checks, CI skeleton, initial tests.

### Phase 2 — Core ERP (complete)
Organizations (CRUD), Branches (CRUD, org-scoped), Departments (CRUD,
hierarchical, branch-scoped), Roles (CRUD with permission assignment,
system-role protection), Permissions (CRUD), Users (CRUD with role/permission
assignment, superuser protection, password change), Audit Logs (read with
filtering by user/action/entity_type/entity_id), System Settings (CRUD with
JSON values). All CRUD operations are audit-logged with previous/new values.
RBAC enforced on every endpoint. Frontend pages for all entities with
TanStack Query + React Hook Form + Zod.

Subsequent phases (HRM, Mobile, Customers+Field Service, Network GIS, Trace,
Inventory, Procurement, Accounting, Billing, Reports) will be built
incrementally with verification between phases.

## 10. Unknowns / out of scope for now

- Vector tile server (introduce only if performance demands it).
- Specific face-verification algorithm (Phase 4).
- Exact chart-of-accounts template (Phase 10).
- Rate limiting (planned for Phase 12 hardening).