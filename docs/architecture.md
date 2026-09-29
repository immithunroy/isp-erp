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

### Phase 3 — HRM (complete)
Employees, Designations, Shifts, Employee Shifts, Holidays, Leave Types,
Leave Balances, Leave Requests (with approve/reject workflow + auto balance
update), Attendance (GPS + face verification fields + corrections with audit
trail). 16 new permission codes. Frontend pages for all HRM entities.

### Phase 4 — Mobile (complete)
React Native + Expo app with 18 screens (5 functional, 13 placeholders for
later phases). Employee login with JWT in SecureStore. GPS capture via
expo-location with configurable accuracy threshold. Facial attendance
architecture with placeholder verification. Offline-first: SQLite local
queue with idempotency keys, automatic sync when online, retry with backoff,
sync status indicator. Backend mobile endpoints: /mobile/profile, /mobile/
settings, /mobile/attendance, /mobile/gps, /mobile/sync (batch with
idempotency). Models: GpsRecord, SyncQueue + migration 0003_mobile.
4 new permission codes, 12 new tests (47 total).

### Phase 5 — Customers + Field Service (complete)
Customers (CRUD, unique customer_code, operational records only — no PPPoE/
RADIUS/bandwidth). Customer Location History (append-only, is_current flag,
never overwrite). Customer Visits (field visit records with GPS + photos).
Work Orders with state machine (open→assigned→accepted→in_progress→
completed→approved or →cancelled), invalid transitions rejected. Work
Order Events auto-created on transitions. 5 new permission codes
(customers:read/write, field_service:read/write/approve). 9 new tests
(56 total). Frontend pages: Customers list+detail (with location history +
visits tabs), Field Service (work orders with create/edit/transition,
status badges, events). Mobile: Customer List, Customer Detail, Customer
Location Capture, Jobs, Job Completion, Photo Capture screens updated from
placeholders to functional with live API calls + offline queue.

### Phase 6 — Network GIS (complete)
Network Assets (unified table, asset_type discriminator: olt/pop/odf/
tj_box/enclosure/splitter/dist_box/pole/manhole/cabinet/dc_site). PostGIS
geometry(Point,4326) with GiST spatial indexes. Map API with bbox
queries (viewport-based, never loads all) + nearby radius search.
Fiber Cables with configurable core_count, auto-generates N FiberCore rows
on creation. Fiber Cores with status management. Splices (explicit
source_core→destination_core connectivity). Splitter Ports (individual
port representation). Customer Network Links (explicit customer-to-network
connections — physical proximity ≠ network connection). 7 new permission
codes. 19 new tests (75 total). Frontend: full-screen Leaflet map with
OpenStreetMap, viewport bbox queries, layer control, colored markers, fiber
polylines, search, add-asset-at-center. Asset management + Fiber management
(tabbed: Cables/Cores/Splices). Mobile: Network Asset, TJ Box, Enclosure,
Splitter, Fiber Survey screens functional with GPS + offline queue.

### Phase 7 — Network Trace (complete)
Customer → OLT trace: walks explicit DB relationships (Customer →
CustomerNetworkLink → SplitterPort → FiberCore → Splice → ... → OLT).
Never geographic proximity. OLT → Customer reverse trace (multiple paths).
Core trace (single core's cable + up/down splices). 1 new permission
code. 6 new tests (81 total). Frontend: Network Trace visualization page
with trace type selector, vertical node list with arrows, color-coded by kind.
Mobile: no trace screen needed (trace is a desktop engineering tool).

### Phase 8 - Inventory (complete)
Warehouses (org-scoped unique code, coordinates, manager, active flag;
deletion blocked while stock or POs reference it). Stock item catalog
(org-scoped unique SKU, unit, unit_cost, reorder_level, category, and
`asset_class` mapping to a network `asset_type`). Stock levels: one row
per (warehouse, item), created lazily by the first movement, exposing
on-hand / reserved / available / is_low; plus `/stock/low` (shortfall)
and `/stock/summary` (counts, total quantity, total value, low count).

Stock quantity is never edited directly. Every change goes through
`stock_movements`, an append-only trail that records `signed_delta` and
the resulting `balance_after`, so on-hand is always reproducible by
replaying history. Movement types: `receipt` (+), `issue` (-),
`adjustment` (signed delta), and `transfer_in`/`transfer_out` written as
a paired set when stock moves between warehouses. Issuing more than is on
hand is rejected (409 Insufficient Stock).

Inventory links to the network model via `stock_movements.network_asset_id`:
a field issue records which network asset the spare was fitted into, and
`GET /inventory/movements?network_asset_id=` answers "what was installed
into this asset?".

Purchase orders: `draft -> pending_approval -> approved ->
partially_received -> received`, or `cancelled` from
draft/pending_approval/approved. Lines carry quantity / unit_cost /
line_total; subtotal, tax and total are recalculated on every header or
line change. Once a PO leaves draft it is immutable (including deletion).
Receiving validates each line against its outstanding amount, writes
`receipt` movements linked back via `reference_type=purchase_order`, and
only sets `received` when every line is complete. 10 new permission codes.
16 new tests (97 total). `/mobile/sync` accepts a `stock_movement` entity
type so offline-queued field issues land server-side, idempotency-keyed;
transfers are rejected offline because both warehouses must exist at
queue time.

Frontend: Inventory Stock (summary cards, level table, movement history,
receipt/issue/adjust and transfer modals), Warehouses, Stock Items, and
Purchase Orders (status-gated actions, dynamic line editor, receive
modal). Mobile: Consume Stock screen with available-quantity guard,
asset typeahead filtered by `asset_class`, and offline queueing.

### Phase 9 - Procurement (complete)
Suppliers: org-scoped unique code, contact details, category, payment
terms, lead time, tax ID, bank account, active flag. Deletion is blocked
while quotes exist (409) because quotes are the audit record of a sourcing
decision; deactivate instead.

RFQs: `draft -> issued -> closed`, or `cancelled` from draft/issued. The
`issued` split is the important one: a draft is freely editable, but
issuing an RFQ locks its lines, so the basis of the competition cannot be
changed after suppliers have seen it. Quotes are only accepted against an
issued RFQ.

Supplier quotes: each supplier may bid on a given RFQ once, against any
subset of its lines. `subtotal` / `tax_amount` / `total_amount` are derived
server-side from the bid lines rather than trusted from the client, and
each line carries an `over_target` flag when the bid exceeds the RFQ line's
target unit cost - that comparison is what the award decision rests on.
Quotes are listed cheapest-first.

Awarding is single-winner by construction: accepting a quote closes the RFQ
and rejects every competing quote in the same transaction, so the RFQ can
never end up with two winners. Rejecting a single quote leaves the RFQ open
for a decision on the remaining bids.

An accepted quote converts into a draft purchase order (`PO-<rfq_number>`)
against a chosen warehouse, inheriting supplier details and re-deriving its
own subtotal/total from the converted lines. The conversion is one-shot
(guarded by `supplier_quotes.purchase_order_id`), and the resulting PO still
has to clear the approval chain before stock can be received.

PO approval is a multi-level chain that replaces the Phase 8 single-step
approve endpoint. Submitting a draft PO takes an ordered list of approver
ids; the list position is the approval level. Invariants enforced
server-side:

- levels are decided in ascending order (a later level is refused while an
  earlier one is pending);
- only the assigned approver, or a superuser, may decide a level;
- a level cannot be decided twice;
- the last pending approval moves the PO to `approved` and stamps
  `approved_by` / `approved_at`;
- a rejection returns the PO to `draft` for revision while keeping the
  decision history (`purchase_order_approvals`) intact for audit, and the
  chain can then be rebuilt.

10 new permission codes. 14 new tests (111 total).

Frontend: Suppliers and RFQs pages (quote comparison with over-target
warnings, award, convert-to-PO), and the Purchase Orders page now builds
and drives the approval chain and renders `pending_approval`.

Subsequent phases (Accounting, Billing, Reports) will be built incrementally
with verification between phases.

## 10. Unknowns / out of scope for now

- Vector tile server (introduce only if performance demands it).
- Specific face-verification algorithm (Phase 4).
- Exact chart-of-accounts template (Phase 10).
- Rate limiting (planned for Phase 12 hardening).