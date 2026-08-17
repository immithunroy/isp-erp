export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Permission {
  id: number;
  code: string;
  module: string;
}

export interface Role {
  id: number;
  name: string;
  code: string;
  is_system: boolean;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_superuser: boolean;
  last_login_at: string | null;
  roles: Role[];
  permissions: Permission[];
}

export interface MobileProfile {
  user_id: number;
  employee_id: number | null;
  email: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  designation: string | null;
  phone: string | null;
}

export interface MobileSettings {
  gps_max_accuracy_meters: number;
  gps_accuracy_mode: string;
  tracking_enabled: boolean;
  face_verification_required: boolean;
  sync_interval_seconds: number;
}

export interface GpsRecord {
  id: number;
  employee_id: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  received_at: string;
  source: string;
  activity: string;
  related_type: string | null;
  related_id: string | null;
  device_id: string | null;
  notes: string | null;
}

export interface GpsRecordCreate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  recorded_at: string;
  source?: string;
  activity: string;
  related_type?: string;
  related_id?: string;
  device_id?: string;
  notes?: string;
}

export interface MobileAttendanceCreate {
  employee_id: number;
  date: string;
  attendance_type: string;
  local_ts: string;
  latitude?: number;
  longitude?: number;
  gps_accuracy?: number;
  face_verified?: boolean;
  face_score?: number;
  device_id?: string;
  notes?: string;
}

export interface MobileAttendanceOut {
  id: number;
  employee_id: number;
  date: string;
  attendance_type: string;
  local_ts: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  face_verified: boolean | null;
  face_score: number | null;
  device_id: string | null;
  source: string;
  notes: string | null;
  is_corrected: boolean;
  created_at: string;
}

export interface SyncItemCreate {
  idempotency_key: string;
  entity_type: string;
  payload: Record<string, unknown>;
}

export interface SyncItemResult {
  idempotency_key: string;
  status: string;
  record_id: number | null;
  error: string | null;
}

export interface SyncBatchResponse {
  results: SyncItemResult[];
  total: number;
  succeeded: number;
  failed: number;
}

export type AttendanceType = "check_in" | "check_out" | "break_resume" | "break_end" | "field";

export type GpsActivity =
  | "attendance"
  | "job"
  | "asset_install"
  | "asset_inspect"
  | "customer_visit"
  | "tracking";

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface QueueItem {
  id: number;
  idempotency_key: string;
  entity_type: string;
  payload: string;
  status: SyncStatus;
  retries: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueCounts {
  pending: number;
  synced: number;
  failed: number;
}

// ── Phase 5: Customers + Field Service ─────────────────────────────────
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Customer {
  id: number;
  organization_id: number;
  branch_id: number | null;
  customer_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  installation_date: string | null;
  status: string;
  assigned_technician_id: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  organization_id: number;
  customer_code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  installation_date?: string;
  status?: string;
  assigned_technician_id?: number;
  notes?: string;
}

export interface CustomerLocation {
  id: number;
  customer_id: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
  source: string;
  collected_by: number | null;
  collection_method: string | null;
  recorded_at: string;
  is_current: boolean;
  notes: string | null;
}

export interface CustomerLocationCreate {
  customer_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  source?: string;
  collected_by?: number;
  collection_method?: string;
  notes?: string;
}

export interface CustomerVisit {
  id: number;
  customer_id: number;
  employee_id: number;
  purpose: string | null;
  visited_at: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  photos: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerVisitCreate {
  customer_id: number;
  employee_id: number;
  purpose?: string;
  visited_at: string;
  latitude?: number;
  longitude?: number;
  gps_accuracy?: number;
  photos?: Record<string, unknown>;
  notes?: string;
}

export interface WorkOrder {
  id: number;
  organization_id: number;
  customer_id: number | null;
  work_order_code: string;
  job_type: string;
  priority: string;
  assigned_employee_id: number | null;
  scheduled_date: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  photos: Record<string, unknown> | null;
  equipment_used: Record<string, unknown> | null;
  notes: string | null;
  completion_report: string | null;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderCreate {
  organization_id: number;
  customer_id?: number;
  work_order_code: string;
  job_type: string;
  priority?: string;
  assigned_employee_id?: number;
  scheduled_date?: string;
  notes?: string;
}

export interface WorkOrderAction {
  status: string;
  notes?: string;
}

export interface WorkOrderEvent {
  id: number;
  work_order_id: number;
  event_type: string;
  actor_id: number | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  created_at: string;
}

// ── Phase 6: Network GIS ───────────────────────────────────────────────
export interface NetworkAsset {
  id: number;
  organization_id: number;
  asset_code: string;
  asset_type: string;
  name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  installed_at: string | null;
  owner: string | null;
  department_id: number | null;
  parent_asset_id: number | null;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NetworkAssetCreate {
  organization_id: number;
  asset_code: string;
  asset_type: string;
  name: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
  installed_at?: string;
  owner?: string;
  department_id?: number;
  parent_asset_id?: number;
  capacity?: number;
  notes?: string;
}

export interface FiberCable {
  id: number;
  organization_id: number;
  cable_code: string;
  name: string;
  cable_type: string | null;
  core_count: number;
  start_asset_id: number | null;
  end_asset_id: number | null;
  route_geojson: Record<string, unknown> | null;
  length_m: number | null;
  installed_at: string | null;
  status: string;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiberCableCreate {
  organization_id: number;
  cable_code: string;
  name: string;
  cable_type?: string;
  core_count: number;
  start_asset_id?: number;
  end_asset_id?: number;
  installed_at?: string;
  status?: string;
  owner?: string;
  notes?: string;
}

export interface FiberCore {
  id: number;
  cable_id: number;
  core_number: number;
  color: string | null;
  status: string;
  source_asset_id: number | null;
  destination_asset_id: number | null;
  related_customer_id: number | null;
  notes: string | null;
}

export interface Splice {
  id: number;
  enclosure_asset_id: number | null;
  source_core_id: number;
  destination_core_id: number;
  splice_loss: number | null;
  technician_id: number | null;
  spliced_at: string;
  notes: string | null;
}

export interface SpliceCreate {
  enclosure_asset_id?: number;
  source_core_id: number;
  destination_core_id: number;
  splice_loss?: number;
  technician_id?: number;
  notes?: string;
}

export interface MapItem {
  id: number;
  asset_code: string;
  asset_type: string;
  name: string;
  status: string;
  latitude: number;
  longitude: number;
}