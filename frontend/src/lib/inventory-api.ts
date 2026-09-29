import { apiFetch } from "./api";
import { type ListParams, buildParams, type Page } from "./core-api";

export type { Page };

// ---------- Warehouses ----------
export interface Warehouse {
  id: number;
  organization_id: number;
  code: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  manager_id: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseCreate {
  organization_id: number;
  code: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  manager_id?: number | null;
  is_active?: boolean;
  notes?: string | null;
}

export interface WarehouseUpdate {
  code?: string;
  name?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  manager_id?: number | null;
  is_active?: boolean;
  notes?: string | null;
}

export function listWarehouses(params: ListParams = {}): Promise<Page<Warehouse>> {
  return apiFetch<Page<Warehouse>>(`/inventory/warehouses${buildParams(params)}`);
}

export function getWarehouse(id: number): Promise<Warehouse> {
  return apiFetch<Warehouse>(`/inventory/warehouses/${id}`);
}

export function createWarehouse(body: WarehouseCreate): Promise<Warehouse> {
  return apiFetch<Warehouse>("/inventory/warehouses", { method: "POST", body });
}

export function updateWarehouse(id: number, body: WarehouseUpdate): Promise<Warehouse> {
  return apiFetch<Warehouse>(`/inventory/warehouses/${id}`, { method: "PUT", body });
}

export function deleteWarehouse(id: number): Promise<void> {
  return apiFetch<void>(`/inventory/warehouses/${id}`, { method: "DELETE" });
}

// ---------- Stock items ----------
export interface StockItem {
  id: number;
  organization_id: number;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  unit_cost: number | null;
  reorder_level: number;
  asset_class: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockItemCreate {
  organization_id: number;
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unit?: string;
  unit_cost?: number | null;
  reorder_level?: number;
  asset_class?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export interface StockItemUpdate {
  sku?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  unit?: string;
  unit_cost?: number | null;
  reorder_level?: number;
  asset_class?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function listStockItems(params: ListParams = {}): Promise<Page<StockItem>> {
  return apiFetch<Page<StockItem>>(`/inventory/items${buildParams(params)}`);
}

export function getStockItem(id: number): Promise<StockItem> {
  return apiFetch<StockItem>(`/inventory/items/${id}`);
}

export function createStockItem(body: StockItemCreate): Promise<StockItem> {
  return apiFetch<StockItem>("/inventory/items", { method: "POST", body });
}

export function updateStockItem(id: number, body: StockItemUpdate): Promise<StockItem> {
  return apiFetch<StockItem>(`/inventory/items/${id}`, { method: "PUT", body });
}

export function deleteStockItem(id: number): Promise<void> {
  return apiFetch<void>(`/inventory/items/${id}`, { method: "DELETE" });
}

// ---------- Stock levels ----------
export interface StockLevel {
  id: number;
  warehouse_id: number;
  item_id: number;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  reorder_level: number;
  is_low: boolean;
  updated_at: string;
}

export interface LowStockItem {
  warehouse_id: number;
  item_id: number;
  sku: string;
  item_name: string;
  unit: string;
  quantity: number;
  reorder_level: number;
  shortfall: number;
}

export interface InventorySummary {
  item_count: number;
  warehouse_count: number;
  active_warehouse_count: number;
  level_count: number;
  total_quantity: number;
  total_value: number;
  low_stock_count: number;
}

export function listStockLevels(params: ListParams = {}): Promise<Page<StockLevel>> {
  return apiFetch<Page<StockLevel>>(`/inventory/stock${buildParams(params)}`);
}

export function listLowStock(params: ListParams = {}): Promise<LowStockItem[]> {
  return apiFetch<LowStockItem[]>(`/inventory/stock/low${buildParams(params)}`);
}

export function getStockSummary(params: ListParams = {}): Promise<InventorySummary> {
  return apiFetch<InventorySummary>(`/inventory/stock/summary${buildParams(params)}`);
}

export function getStockLevel(id: number): Promise<StockLevel> {
  return apiFetch<StockLevel>(`/inventory/stock/${id}`);
}

// ---------- Stock movements ----------
export type MovementType =
  | "receipt"
  | "issue"
  | "adjustment"
  | "transfer_in"
  | "transfer_out";

/** Movement types a client may post directly to a single warehouse. */
export type ManualMovementType = "receipt" | "issue" | "adjustment";

export interface StockMovement {
  id: number;
  organization_id: number;
  movement_type: MovementType;
  item_id: number;
  warehouse_id: number;
  to_warehouse_id: number | null;
  quantity: number;
  signed_delta: number;
  balance_after: number | null;
  network_asset_id: number | null;
  work_order_id: number | null;
  reference_type: string | null;
  reference_id: number | null;
  reason: string | null;
  moved_at: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovementCreate {
  organization_id: number;
  movement_type: ManualMovementType;
  item_id: number;
  warehouse_id: number;
  /** Signed delta for adjustments, positive amount for receipt / issue. */
  quantity: number;
  network_asset_id?: number | null;
  work_order_id?: number | null;
  reason?: string | null;
}

export interface StockTransferCreate {
  organization_id: number;
  item_id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  quantity: number;
  reason?: string | null;
}

export function listStockMovements(params: ListParams = {}): Promise<Page<StockMovement>> {
  return apiFetch<Page<StockMovement>>(`/inventory/movements${buildParams(params)}`);
}

export function getStockMovement(id: number): Promise<StockMovement> {
  return apiFetch<StockMovement>(`/inventory/movements/${id}`);
}

export function createStockMovement(body: StockMovementCreate): Promise<StockMovement> {
  return apiFetch<StockMovement>("/inventory/movements", { method: "POST", body });
}

export function transferStock(body: StockTransferCreate): Promise<StockMovement[]> {
  return apiFetch<StockMovement[]>("/inventory/movements/transfer", { method: "POST", body });
}

// ---------- Purchase orders ----------
export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "partially_received"
  | "received"
  | "cancelled";

export interface PurchaseOrderLine {
  id: number;
  purchase_order_id: number;
  item_id: number;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  line_total: number;
  notes: string | null;
}

export interface PurchaseOrderLineCreate {
  item_id: number;
  quantity: number;
  unit_cost: number;
  notes?: string | null;
}

export interface PurchaseOrder {
  id: number;
  organization_id: number;
  po_number: string;
  supplier_name: string;
  supplier_contact: string | null;
  supplier_email: string | null;
  status: PurchaseOrderStatus;
  warehouse_id: number;
  order_date: string;
  expected_date: string | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  created_by: number | null;
  approved_by: number | null;
  approved_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  lines: PurchaseOrderLine[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderCreate {
  organization_id: number;
  po_number: string;
  supplier_name: string;
  warehouse_id: number;
  supplier_contact?: string | null;
  supplier_email?: string | null;
  expected_date?: string | null;
  currency?: string;
  tax_amount?: number;
  notes?: string | null;
  lines: PurchaseOrderLineCreate[];
}

export interface PurchaseOrderUpdate {
  supplier_name?: string;
  supplier_contact?: string | null;
  supplier_email?: string | null;
  warehouse_id?: number;
  expected_date?: string | null;
  currency?: string;
  tax_amount?: number;
  notes?: string | null;
}

export interface PurchaseOrderReceiveLine {
  line_id: number;
  quantity: number;
}

export interface PurchaseOrderReceive {
  lines: PurchaseOrderReceiveLine[];
  notes?: string | null;
}

export function listPurchaseOrders(params: ListParams = {}): Promise<Page<PurchaseOrder>> {
  return apiFetch<Page<PurchaseOrder>>(`/inventory/purchase-orders${buildParams(params)}`);
}

export function getPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}`);
}

export function createPurchaseOrder(body: PurchaseOrderCreate): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>("/inventory/purchase-orders", { method: "POST", body });
}

export function updatePurchaseOrder(
  id: number,
  body: PurchaseOrderUpdate,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}`, { method: "PUT", body });
}

export function deletePurchaseOrder(id: number): Promise<void> {
  return apiFetch<void>(`/inventory/purchase-orders/${id}`, { method: "DELETE" });
}

export function addPurchaseOrderLine(
  id: number,
  body: PurchaseOrderLineCreate,
): Promise<PurchaseOrderLine> {
  return apiFetch<PurchaseOrderLine>(`/inventory/purchase-orders/${id}/lines`, {
    method: "POST",
    body,
  });
}

export function deletePurchaseOrderLine(id: number, lineId: number): Promise<void> {
  return apiFetch<void>(`/inventory/purchase-orders/${id}/lines/${lineId}`, {
    method: "DELETE",
  });
}

export function cancelPurchaseOrder(id: number): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}/cancel`, {
    method: "POST",
  });
}

export function receivePurchaseOrder(
  id: number,
  body: PurchaseOrderReceive,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`, {
    method: "POST",
    body,
  });
}
