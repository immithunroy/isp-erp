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