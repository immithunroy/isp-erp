# ISP Operations ERP — Database / Entity Relationship Design

> Status: Phase 1 — Foundation. Only the foundation tables (core/auth/Organization/
> Branch/Department/Role/Permission/User/UserRole/UserPermission/AuditLog/
> SystemSetting + PostGIS metadata) are migrated now. The remaining tables below
> are the **target design** for later phases; they are documented here so that
> later migrations stay consistent and FK-friendly. Each future phase will create
> the migrations for its own tables.

Conventions:
- All tables `id BIGSERIAL PRIMARY KEY` is NOT used; we use `identity` integer or
  UUID where labelled. Foundation uses `id BIGINT GENERATED ALWAYS AS IDENTITY`.
- `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` on mutation-heavy
  tables (from a shared mixin).
- Soft-delete only where explicitly noted (financial records are NEVER deleted).
- All spatial columns use SRID 4326. Use `geography(Point,4326)` for point assets
  and `geography(LineString,4326)` for fiber routes; keep a GiST index on each.
- Reserved SQL keywords avoided in identifiers.

---

## A. Core / Auth (Phase 1)

### organizations
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| name | text not null | |
| legal_name | text | |
| code | text unique | short code |
| address | text | |
| contact_email | text | |
| contact_phone | text | |
| is_active | boolean default true | |
| created_at / updated_at | timestamptz | |

### branches
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| organization_id | bigint fk -> organizations(id) | |
| name | text not null | |
| code | text | |
| address | text | |
| geog | geography(Point,4326) | optional head office point |
| is_active | boolean default true | |
| unique(organization_id, code) | | |

### departments
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| organization_id | bigint fk -> organizations(id) | |
| branch_id | bigint fk -> branches(id) nullable | |
| parent_id | bigint fk -> departments(id) nullable | self-ref |
| name | text not null | |
| code | text | |
| is_active | boolean default true | |
| unique(organization_id, code) | | |

### roles
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| organization_id | bigint fk -> organizations(id) nullable | null = system role |
| name | text not null | |
| code | text not null | |
| description | text | |
| is_system | boolean default false | system roles cannot be deleted |
| unique(organization_id, code) | | |

### permissions
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| code | text unique not null | e.g. `customers:read` |
| module | text not null | e.g. `customers` |
| description | text | |

### role_permissions
| column | type | notes |
|---|---|---|
| role_id | bigint fk -> roles(id) | |
| permission_id | bigint fk -> permissions(id) | |
| pk(role_id, permission_id) | | |

### users
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| organization_id | bigint fk -> organizations(id) nullable | |
| branch_id | bigint fk -> branches(id) nullable | |
| email | text unique not null | login |
| phone | text | |
| full_name | text not null | |
| password_hash | text not null | argon2/bcrypt |
| is_active | boolean default true | |
| is_superuser | boolean default false | |
| last_login_at | timestamptz | |
| failed_login_count | int default 0 | |
| created_at / updated_at | timestamptz | |

### user_roles
| column | type | notes |
|---|---|---|
| user_id | bigint fk -> users(id) on delete cascade | |
| role_id | bigint fk -> roles(id) | |
| pk(user_id, role_id) | | |

### user_permissions  (direct grants, in addition to roles)
| column | type | notes |
|---|---|---|
| user_id | bigint fk -> users(id) on delete cascade | |
| permission_id | bigint fk -> permissions(id) | |
| granted | boolean default true | false = deny override |
| pk(user_id, permission_id) | | |

### refresh_tokens
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| user_id | bigint fk -> users(id) on delete cascade | |
| token_hash | text not null | SHA-256 hash of token |
| expires_at | timestamptz not null | |
| revoked_at | timestamptz nullable | |
| replaced_by_id | bigint fk -> refresh_tokens(id) nullable | rotation |
| user_agent | text | |
| ip | inet | |
| created_at | timestamptz default now() | |
| index on (user_id), unique(token_hash) | | |

### audit_logs
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| user_id | bigint fk -> users(id) nullable | nullable for system actions |
| action | text not null | e.g. `customer.update` |
| entity_type | text | |
| entity_id | text | string to allow polymorphic ids |
| previous_value | jsonb | |
| new_value | jsonb | |
| ip | inet | |
| user_agent | text | |
| device_id | text | |
| created_at | timestamptz default now() not null | |
| index on (entity_type, entity_id), (user_id), (created_at) | | |

### system_settings
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| key | text unique not null | |
| value | jsonb | |
| category | text | |
| description | text | |
| updated_at | timestamptz | |
| updated_by | bigint fk -> users(id) | |

### PostGIS metadata
- Extension `postgis` enabled via Alembic / entrypoint.
- `geometry_columns` / `geography_columns` maintained automatically.

---

## B. HRM (Phase 3 — design only now)

### employees
- id pk, organization_id fk, branch_id fk, department_id fk, designation_id fk,
  supervisor_id fk(self), employee_code unique, full_name, photo_url, phone,
  email, address, emergency_contact_name, emergency_contact_phone,
  joining_date date, employment_status enum(active/suspended/terminated/resigned),
  is_active, created_at/updated_at.
- geog geography(Point,4326) nullable (home base).

### designations
- id pk, organization_id fk, department_id fk nullable, name, code,
  grade, is_active.

### shifts
- id pk, organization_id fk, name, start_time time, end_time time,
  grace_minutes int, is_active.

### employee_shifts
- employee_id fk, shift_id fk, effective_from date, effective_to date nullable.

### holidays
- id pk, organization_id fk, name, date, is_recurring, scope enum(org/branch/department).

### leave_types, leave_balances, leave_requests
- leave_requests: id pk, employee_id fk, leave_type_id fk, from_date, to_date,
  reason, status enum(pending/approved/rejected/cancelled), approver_id fk,
  approved_at.

### attendance
- id pk, employee_id fk, date, type enum(check_in/check_out/break_resume/break_end/field),
  local_ts timestamptz, lat, lon, gps_accuracy numeric, face_verified bool,
  face_score numeric, device_id, ip inet, source enum(mobile/web/manual),
  notes, corrected bool, correction_reason, approved_by fk nullable, audit fk.

### attendance_corrections
- audit-tracked changes to attendance rows.

---

## C. Mobile workforce (Phase 4 — design only now)

### gps_records
- id pk, employee_id fk, lat, lon, accuracy numeric, recorded_at timestamptz,
  received_at timestamptz, source, activity enum(attendance/job/asset_install/
  asset_inspect/customer_visit/tracking), related_type, related_id,
  device_id, notes.
- geog geography(Point,4326), GiST index.
- Partition by month once scale demands.

### sync_queue (mobile offline sync)
- id pk, device_id, employee_id fk, payload jsonb, idempotency_key text unique,
  status enum(pending/processing/failed/done), retries int, error text,
  created_at, updated_at.

### face_verification (architecture placeholders)
- Embeddings stored separately; payload schema only at this stage.

---

## D. Customers (Phase 5 — design only now)

### customers
- id pk, organization_id fk, customer_code unique, name, phone, email,
  address, installation_date date, status enum(active/inactive/suspended),
  assigned_technician_id fk -> employees(id) nullable, branch_id fk nullable,
  notes, created_at/updated_at.
- geog geography(Point,4326), GiST index.
- (NO pppoe/radius/hotspot/bandwidth fields.)

### customer_locations (history; never overwrite)
- id pk, customer_id fk, lat, lon, accuracy numeric, source, collected_by
  fk -> employees(id), collection_method, recorded_at timestamptz,
  is_current bool, address text, notes.
- geog geography(Point,4326), GiST index.
- A trigger/ app logic flips previous is_current=false on insert.

### customer_visits
- id pk, customer_id fk, employee_id fk, purpose, visited_at timestamptz,
  lat, lon, accuracy, notes, photos jsonb.

---

## E. Field service (Phase 5)

### work_orders
- id pk, organization_id fk, customer_id fk nullable, job_type, priority
  enum(low/medium/high/urgent), assigned_employee_id fk -> employees(id),
  scheduled_date, status enum(open/assigned/accepted/in_progress/completed/
  cancelled/approved), geog point, photos jsonb, equipment_used jsonb,
  notes, completion_report, created_by fk, approved_by fk nullable.

### work_order_events
- id pk, work_order_id fk, event_type, actor_id fk, lat, lon, ts, notes.

---

## F. Network infrastructure (Phase 6 — design only now)

Common columns for physical assets: `asset_id` (human-readable unique),
`asset_type`, `name`, `status`, `geog geography(Point,4326)`, `accuracy`
numeric, `installed_at` date, `owner` text, `department_id` fk,
`photos` jsonb, `documents` jsonb, `notes`, `created_at/updated_at`.

### network_assets (union of point assets: olt, pop, odf, tj_box, enclosure,
### distribution_box, pole, manhole, cabinet, dc/site) — single table with
### discriminator `asset_type` + type-specific extension tables when needed:

| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| organization_id | bigint fk | |
| asset_code | text unique | human-readable ID |
| asset_type | text not null | `olt`/`pop`/`odf`/`tj_box`/`enclosure`/`splitter`/`dist_box`/`pole`/`manhole`/`cabinet`/`dc_site` |
| name | text | |
| status | text | configurable statuses |
| geog | geography(Point,4326) | |
| accuracy_m | numeric | |
| installed_at | date | |
| owner | text | |
| department_id | bigint fk | |
| parent_asset_id | bigint fk -> network_assets(id) nullable | containment |
| capacity | int nullable | |
| photos / documents / notes | jsonb | |
| created_at / updated_at | timestamptz | |
| GiST on geog; btree on (organization_id, asset_type, status) | | |

Type-specific tables: `olts` (asset_id fk, model, ports, olt_type),
`tj_boxes` (asset_id fk, tj_type, capacity), `enclosures` (asset_id fk, type,
capacity), `splitters` (asset_id fk, ratio text e.g. `1:8`, input_port_id).

### splitters + splitter_ports
- splitter_ports: id pk, splitter_id fk, port_kind enum(input/output),
  port_index int, connected_core_id fk nullable, status.

### fiber_cables
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| organization_id | bigint fk | |
| cable_code | text unique | |
| name | text | |
| cable_type | text | |
| core_count | int not null | 2/4/6/12/24/48/72/96/144 or configurable |
| start_asset_id | bigint fk -> network_assets(id) | |
| end_asset_id | bigint fk -> network_assets(id) | |
| route | geography(LineString,4326) | |
| length_m | numeric | computed/stored |
| installed_at | date | |
| status | text | |
| owner | text | |
| notes | text | |
| GiST on route | | |

### fiber_cores
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| cable_id | bigint fk -> fiber_cables(id) on delete cascade | |
| core_number | int | |
| color | text | |
| status | text | available/reserved/in_use/faulty/dark/spliced/retired |
| source_asset_id | bigint fk nullable | |
| destination_asset_id | bigint fk nullable | |
| related_customer_id | bigint fk -> customers(id) nullable | |
| notes | text | |
| unique(cable_id, core_number) | | |

### splices
| column | type | notes |
|---|---|---|
| id | bigint identity pk | |
| enclosure_asset_id | bigint fk -> network_assets(id) | |
| source_core_id | bigint fk -> fiber_cores(id) | |
| destination_core_id | bigint fk -> fiber_cores(id) | |
| splice_loss | numeric nullable | |
| technician_id | bigint fk -> employees(id) nullable | |
| spliced_at | timestamptz | |
| notes | text | |

> Splices create the **explicit** connectivity that network trace walks.

### customer_network_links  (explicit customer-to-network)
- id pk, customer_id fk, link_kind enum(splitter_port/core/joint),
  target_id bigint, target_port int nullable, notes.
- A customer is connected to a specific splitter output port or a specific
  fiber core, explicitly — never inferred from geography.

---

## G. Inventory (Phase 8 — design only now)

### products, categories, units
- products: id pk, sku unique, name, type, has_serial bool, has_mac bool,
  is_network_equipment bool, unit, default_cost numeric, default_price numeric.

### warehouses
- id pk, organization_id fk, branch_id fk nullable, name, code, geog point.

### stock_items  (current on-hand per warehouse/product)
- warehouse_id fk, product_id fk, quantity numeric, unique(warehouse_id, product_id).

### stock_transactions
- id pk, warehouse_id fk, product_id fk, tx_type enum(receive/transfer_in/
  transfer_out/issue/return/adjust), quantity, serial_numbers jsonb,
  mac_addresses jsonb, reference_type, reference_id, performed_by fk,
  created_at. Immutable after posting.

### equipment  (serialized/network items)
- id pk, product_id fk, serial_number, mac_address, status
  enum(in_stock/issued/installed/faulty/returned/retired), warehouse_id fk
  nullable, assigned_employee_id fk nullable, installed_at_customer_id fk
  nullable, installed_network_asset_id fk nullable, purchase_cost numeric,
  supplier_id fk nullable, location_geog point nullable.

### suppliers (shared with procurement)
- id pk, organization_id fk, name, code, contact, email, phone, address,
  payment_terms, is_active.

---

## H. Procurement (Phase 9 — design only now)

### purchase_requests, purchase_orders, purchase_order_lines,
### goods_receipts, purchase_invoices, supplier_payments
- Approvals via generic `approvals` table: id pk, entity_type, entity_id,
  approver_id fk, status, decision_at, comment.

---

## I. Accounting (Phase 10 — design only now)

### fiscal_years, chart_of_accounts
- accounts: id pk, organization_id fk, code unique, name, type
  enum(asset/liability/equity/income/expense/cash/bank/receivable/payable),
  parent_id fk self, is_active, currency.

### journal_entries (header, posted = immutable)
- id pk, organization_id fk, entry_number, entry_date, period_id fk,
  description, status enum(draft/posted/reversed), source_type, source_id,
  posted_by fk, posted_at, created_at. Reversals link via reversal_of_id fk.

### journal_lines
- id pk, journal_entry_id fk, account_id fk, debit numeric(18,2) default 0,
  credit numeric(18,2) default 0, description.
- Constraint: per journal_entry, sum(debit) = sum(credit).

### bank_accounts, cash_accounts, expenses, invoices (operational),
### payments — Phase 10/11.

---

## J. Reports / Notifications (Phase 12)

Views/materialised views + a generic `notifications` table
(id pk, user_id fk, channel, type, payload jsonb, read_at, created_at).

---

## Indexes summary (foundation implemented now)

- PKs on all tables.
- unique: users.email, permissions.code, organizations.code, branches(org,code),
  departments(org,code), roles(org,code), refresh_tokens.token_hash.
- Indexes: audit_logs(entity_type, entity_id), audit_logs(user_id),
  audit_logs(created_at), refresh_tokens(user_id).

Spatial indexes (GiST) will be added in Phase 5/6 as `geog` columns appear.