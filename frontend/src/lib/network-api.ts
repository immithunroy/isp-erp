import { apiFetch } from "./api";
import { type ListParams, buildParams, type Page } from "./core-api";

// ---------- Network assets ----------
export type NetworkAssetType =
  | "olt"
  | "pop"
  | "odf"
  | "tj_box"
  | "enclosure"
  | "splitter"
  | "pole"
  | "manhole"
  | "customer_premise"
  | "other";

export type NetworkAssetStatus =
  | "planned"
  | "active"
  | "maintenance"
  | "faulty"
  | "decommissioned";

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
  capacity: string | null;
  photos: string[] | null;
  documents: string[] | null;
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
  capacity?: string;
  notes?: string;
}

export interface NetworkAssetUpdate {
  name?: string;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  owner?: string | null;
  department_id?: number | null;
  parent_asset_id?: number | null;
  capacity?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export function listNetworkAssets(params: ListParams = {}): Promise<Page<NetworkAsset>> {
  return apiFetch<Page<NetworkAsset>>(`/network/assets${buildParams(params)}`);
}

export function getNetworkAsset(id: number): Promise<NetworkAsset> {
  return apiFetch<NetworkAsset>(`/network/assets/${id}`);
}

export function createNetworkAsset(body: NetworkAssetCreate): Promise<NetworkAsset> {
  return apiFetch<NetworkAsset>("/network/assets", { method: "POST", body });
}

export function updateNetworkAsset(id: number, body: NetworkAssetUpdate): Promise<NetworkAsset> {
  return apiFetch<NetworkAsset>(`/network/assets/${id}`, { method: "PATCH", body });
}

export function deleteNetworkAsset(id: number): Promise<void> {
  return apiFetch<void>(`/network/assets/${id}`, { method: "DELETE" });
}

// ---------- Fiber cables ----------
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

export interface FiberCableUpdate {
  name?: string;
  cable_type?: string | null;
  status?: string;
  length_m?: number | null;
  notes?: string | null;
}

export function listFiberCables(params: ListParams = {}): Promise<Page<FiberCable>> {
  return apiFetch<Page<FiberCable>>(`/network/fiber-cables${buildParams(params)}`);
}

export function getFiberCable(id: number): Promise<FiberCable> {
  return apiFetch<FiberCable>(`/network/fiber-cables/${id}`);
}

export function createFiberCable(body: FiberCableCreate): Promise<FiberCable> {
  return apiFetch<FiberCable>("/network/fiber-cables", { method: "POST", body });
}

export function updateFiberCable(id: number, body: FiberCableUpdate): Promise<FiberCable> {
  return apiFetch<FiberCable>(`/network/fiber-cables/${id}`, { method: "PATCH", body });
}

export function deleteFiberCable(id: number): Promise<void> {
  return apiFetch<void>(`/network/fiber-cables/${id}`, { method: "DELETE" });
}

// ---------- Fiber cores ----------
export type FiberCoreStatus =
  | "available"
  | "reserved"
  | "in_use"
  | "faulty"
  | "dark"
  | "spliced"
  | "retired";

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

export interface FiberCoreUpdate {
  status?: string;
  source_asset_id?: number | null;
  destination_asset_id?: number | null;
  related_customer_id?: number | null;
  notes?: string | null;
}

export function listFiberCores(params: ListParams = {}): Promise<Page<FiberCore>> {
  return apiFetch<Page<FiberCore>>(`/network/fiber-cores${buildParams(params)}`);
}

export function updateFiberCore(id: number, body: FiberCoreUpdate): Promise<FiberCore> {
  return apiFetch<FiberCore>(`/network/fiber-cores/${id}`, { method: "PATCH", body });
}

export function deleteFiberCore(id: number): Promise<void> {
  return apiFetch<void>(`/network/fiber-cores/${id}`, { method: "DELETE" });
}

// ---------- Splices ----------
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

export function listSplices(params: ListParams = {}): Promise<Page<Splice>> {
  return apiFetch<Page<Splice>>(`/network/splices${buildParams(params)}`);
}

export function createSplice(body: SpliceCreate): Promise<Splice> {
  return apiFetch<Splice>("/network/splices", { method: "POST", body });
}

export function deleteSplice(id: number): Promise<void> {
  return apiFetch<void>(`/network/splices/${id}`, { method: "DELETE" });
}

// ---------- Splitter ports ----------
export interface SplitterPort {
  id: number;
  splitter_asset_id: number;
  port_kind: string;
  port_index: number;
  connected_core_id: number | null;
  status: string;
  notes: string | null;
}

export interface SplitterPortCreate {
  splitter_asset_id: number;
  port_kind: string;
  port_index: number;
  connected_core_id?: number;
  status?: string;
  notes?: string;
}

export interface SplitterPortUpdate {
  connected_core_id?: number | null;
  status?: string;
  notes?: string | null;
}

export function listSplitterPorts(params: ListParams = {}): Promise<Page<SplitterPort>> {
  return apiFetch<Page<SplitterPort>>(`/network/splitter-ports${buildParams(params)}`);
}

export function createSplitterPort(body: SplitterPortCreate): Promise<SplitterPort> {
  return apiFetch<SplitterPort>("/network/splitter-ports", { method: "POST", body });
}

export function updateSplitterPort(id: number, body: SplitterPortUpdate): Promise<SplitterPort> {
  return apiFetch<SplitterPort>(`/network/splitter-ports/${id}`, { method: "PATCH", body });
}

// ---------- Customer network links ----------
export interface CustomerNetworkLink {
  id: number;
  customer_id: number;
  link_kind: string;
  target_asset_id: number | null;
  target_core_id: number | null;
  target_port_index: number | null;
  notes: string | null;
}

export interface CustomerNetworkLinkCreate {
  customer_id: number;
  link_kind: string;
  target_asset_id?: number;
  target_core_id?: number;
  target_port_index?: number;
  notes?: string;
}

export function listCustomerNetworkLinks(
  params: ListParams = {},
): Promise<Page<CustomerNetworkLink>> {
  return apiFetch<Page<CustomerNetworkLink>>(
    `/network/customer-network-links${buildParams(params)}`,
  );
}

export function createCustomerNetworkLink(
  body: CustomerNetworkLinkCreate,
): Promise<CustomerNetworkLink> {
  return apiFetch<CustomerNetworkLink>("/network/customer-network-links", {
    method: "POST",
    body,
  });
}

export function deleteCustomerNetworkLink(id: number): Promise<void> {
  return apiFetch<void>(`/network/customer-network-links/${id}`, { method: "DELETE" });
}

// ---------- Map ----------
export interface MapItem {
  id: number;
  asset_code: string;
  asset_type: string;
  name: string;
  status: string;
  latitude: number;
  longitude: number;
}

export interface BboxParams {
  min_lon: number;
  min_lat: number;
  max_lon: number;
  max_lat: number;
  asset_type?: string;
}

export function getMapBbox(params: BboxParams): Promise<MapItem[]> {
  const usp = new URLSearchParams();
  usp.set("min_lon", String(params.min_lon));
  usp.set("min_lat", String(params.min_lat));
  usp.set("max_lon", String(params.max_lon));
  usp.set("max_lat", String(params.max_lat));
  if (params.asset_type) usp.set("asset_type", params.asset_type);
  return apiFetch<MapItem[]>(`/network/map/bbox?${usp.toString()}`);
}

export function getNearby(
  lat: number,
  lon: number,
  radius_m?: number,
): Promise<MapItem[]> {
  const usp = new URLSearchParams();
  usp.set("lat", String(lat));
  usp.set("lon", String(lon));
  if (radius_m !== undefined) usp.set("radius_m", String(radius_m));
  return apiFetch<MapItem[]>(`/network/map/nearby?${usp.toString()}`);
}
