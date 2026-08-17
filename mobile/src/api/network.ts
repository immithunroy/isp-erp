import { apiFetch } from "./client";
import type {
  Page,
  NetworkAsset,
  NetworkAssetCreate,
  FiberCable,
  FiberCableCreate,
  FiberCore,
  Splice,
  SpliceCreate,
  MapItem,
} from "../types";

// ── Network Assets ─────────────────────────────────────────────────
export async function listNetworkAssets(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  asset_type?: string;
  status?: string;
}): Promise<Page<NetworkAsset>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.search) q.set("search", params.search);
  if (params?.asset_type) q.set("asset_type", params.asset_type);
  if (params?.status) q.set("status", params.status);
  return apiFetch<Page<NetworkAsset>>(`/network/assets?${q.toString()}`);
}

export async function getNetworkAsset(id: number): Promise<NetworkAsset> {
  return apiFetch<NetworkAsset>(`/network/assets/${id}`);
}

export async function createNetworkAsset(
  payload: NetworkAssetCreate
): Promise<NetworkAsset> {
  return apiFetch<NetworkAsset>("/network/assets", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  });
}

// ── Map ────────────────────────────────────────────────────────────────
export async function getMapBbox(params: {
  min_lon: number;
  min_lat: number;
  max_lon: number;
  max_lat: number;
  asset_type?: string;
}): Promise<MapItem[]> {
  const q = new URLSearchParams();
  q.set("min_lon", String(params.min_lon));
  q.set("min_lat", String(params.min_lat));
  q.set("max_lon", String(params.max_lon));
  q.set("max_lat", String(params.max_lat));
  if (params.asset_type) q.set("asset_type", params.asset_type);
  return apiFetch<MapItem[]>(`/network/map?${q.toString()}`);
}

export async function getNearby(params: {
  lat: number;
  lon: number;
  radius_m?: number;
}): Promise<MapItem[]> {
  const q = new URLSearchParams();
  q.set("lat", String(params.lat));
  q.set("lon", String(params.lon));
  if (params.radius_m) q.set("radius_m", String(params.radius_m));
  return apiFetch<MapItem[]>(`/network/map/nearby?${q.toString()}`);
}

// ── Fiber Cables ──────────────────────────────────────────────────────
export async function listFiberCables(params?: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<Page<FiberCable>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.search) q.set("search", params.search);
  return apiFetch<Page<FiberCable>>(`/network/fiber?${q.toString()}`);
}

export async function getFiberCable(id: number): Promise<FiberCable> {
  return apiFetch<FiberCable>(`/network/fiber/${id}`);
}

export async function createFiberCable(
  payload: FiberCableCreate
): Promise<FiberCable> {
  return apiFetch<FiberCable>("/network/fiber", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  });
}

// ── Fiber Cores ────────────────────────────────────────────────────────
export async function listFiberCores(cableId: number): Promise<Page<FiberCore>> {
  return apiFetch<Page<FiberCore>>(`/network/fiber-cores?cable_id=${cableId}`);
}

// ── Splices ────────────────────────────────────────────────────────────
export async function listSplices(enclosureId?: number): Promise<Page<Splice>> {
  const q = new URLSearchParams();
  if (enclosureId) q.set("enclosure_asset_id", String(enclosureId));
  return apiFetch<Page<Splice>>(`/network/splices?${q.toString()}`);
}

export async function createSplice(
  payload: SpliceCreate
): Promise<Splice> {
  return apiFetch<Splice>("/network/splices", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  });
}