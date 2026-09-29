import { apiFetch } from "./client";
import type {
  Page,
  StockItem,
  StockLevel,
  StockMovement,
  StockMovementCreate,
  Warehouse,
} from "../types";

// ── Warehouses ─────────────────────────────────────────────────────────
export async function listWarehouses(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  organization_id?: number;
  is_active?: boolean;
}): Promise<Page<Warehouse>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.search) q.set("search", params.search);
  if (params?.organization_id) q.set("organization_id", String(params.organization_id));
  if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
  return apiFetch<Page<Warehouse>>(`/inventory/warehouses?${q.toString()}`);
}

// ── Stock Items ────────────────────────────────────────────────────────
export async function listStockItems(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  organization_id?: number;
  category?: string;
  asset_class?: string;
  is_active?: boolean;
}): Promise<Page<StockItem>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.search) q.set("search", params.search);
  if (params?.organization_id) q.set("organization_id", String(params.organization_id));
  if (params?.category) q.set("category", params.category);
  if (params?.asset_class) q.set("asset_class", params.asset_class);
  if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
  return apiFetch<Page<StockItem>>(`/inventory/items?${q.toString()}`);
}

// ── Stock Levels ───────────────────────────────────────────────────────
export async function listStockLevels(params: {
  warehouse_id: number;
  item_id: number;
}): Promise<Page<StockLevel>> {
  const q = new URLSearchParams();
  q.set("warehouse_id", String(params.warehouse_id));
  q.set("item_id", String(params.item_id));
  return apiFetch<Page<StockLevel>>(`/inventory/stock?${q.toString()}`);
}

// ── Stock Movements ────────────────────────────────────────────────────
export async function createStockMovement(
  payload: StockMovementCreate
): Promise<StockMovement> {
  return apiFetch<StockMovement>("/inventory/movements", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  });
}
