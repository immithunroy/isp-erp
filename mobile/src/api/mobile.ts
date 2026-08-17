import { apiFetch } from "./client";
import type {
  MobileProfile,
  MobileSettings,
  MobileAttendanceCreate,
  MobileAttendanceOut,
  GpsRecordCreate,
  GpsRecord,
  SyncBatchRequest,
  SyncBatchResponse,
} from "../types";

export async function getProfile(): Promise<MobileProfile> {
  return apiFetch<MobileProfile>("/mobile/profile");
}

export async function getSettings(): Promise<MobileSettings> {
  return apiFetch<MobileSettings>("/mobile/settings");
}

export async function submitAttendance(
  payload: MobileAttendanceCreate
): Promise<MobileAttendanceOut> {
  return apiFetch<MobileAttendanceOut>("/mobile/attendance", {
    method: "POST",
    body: payload,
  });
}

export async function submitGps(
  payload: GpsRecordCreate
): Promise<GpsRecord> {
  return apiFetch<GpsRecord>("/mobile/gps", {
    method: "POST",
    body: payload,
  });
}

export async function syncBatch(
  items: SyncBatchRequest
): Promise<SyncBatchResponse> {
  return apiFetch<SyncBatchResponse>("/mobile/sync", {
    method: "POST",
    body: items,
  });
}