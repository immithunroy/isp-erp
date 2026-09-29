import { apiFetch } from "./api";
import { type ListParams, buildParams, type Page } from "./core-api";
import type { PurchaseOrder } from "./inventory-api";

export type { Page };

// ---------- Suppliers ----------
export interface Supplier {
  id: number;
  organization_id: number;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  payment_terms: string | null;
  lead_time_days: number | null;
  tax_id: string | null;
  bank_account: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreate {
  organization_id: number;
  code: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  category?: string | null;
  payment_terms?: string | null;
  lead_time_days?: number | null;
  tax_id?: string | null;
  bank_account?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export type SupplierUpdate = Partial<Omit<SupplierCreate, "organization_id">>;

export function listSuppliers(params: ListParams = {}): Promise<Page<Supplier>> {
  return apiFetch<Page<Supplier>>(`/procurement/suppliers${buildParams(params)}`);
}

export function getSupplier(id: number): Promise<Supplier> {
  return apiFetch<Supplier>(`/procurement/suppliers/${id}`);
}

export function createSupplier(body: SupplierCreate): Promise<Supplier> {
  return apiFetch<Supplier>("/procurement/suppliers", { method: "POST", body });
}

export function updateSupplier(id: number, body: SupplierUpdate): Promise<Supplier> {
  return apiFetch<Supplier>(`/procurement/suppliers/${id}`, { method: "PUT", body });
}

export function deleteSupplier(id: number): Promise<void> {
  return apiFetch<void>(`/procurement/suppliers/${id}`, { method: "DELETE" });
}

// ---------- RFQs ----------
export type RfqStatus = "draft" | "issued" | "closed" | "cancelled";

export interface RfqLine {
  id: number;
  rfq_id: number;
  stock_item_id: number;
  quantity: number;
  target_unit_cost: number | null;
  notes: string | null;
}

export interface RfqLineCreate {
  stock_item_id: number;
  quantity: number;
  target_unit_cost?: number | null;
  notes?: string | null;
}

export interface Rfq {
  id: number;
  organization_id: number;
  rfq_number: string;
  title: string;
  status: RfqStatus;
  due_date: string | null;
  currency: string;
  notes: string | null;
  created_by: number | null;
  issued_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  lines: RfqLine[];
  quote_count: number;
  created_at: string;
  updated_at: string;
}

export interface RfqCreate {
  organization_id: number;
  rfq_number: string;
  title: string;
  due_date?: string | null;
  currency?: string;
  notes?: string | null;
  lines: RfqLineCreate[];
}

export type RfqUpdate = Partial<
  Pick<RfqCreate, "title" | "due_date" | "currency" | "notes">
>;

export function listRfqs(params: ListParams = {}): Promise<Page<Rfq>> {
  return apiFetch<Page<Rfq>>(`/procurement/rfqs${buildParams(params)}`);
}

export function getRfq(id: number): Promise<Rfq> {
  return apiFetch<Rfq>(`/procurement/rfqs/${id}`);
}

export function createRfq(body: RfqCreate): Promise<Rfq> {
  return apiFetch<Rfq>("/procurement/rfqs", { method: "POST", body });
}

export function updateRfq(id: number, body: RfqUpdate): Promise<Rfq> {
  return apiFetch<Rfq>(`/procurement/rfqs/${id}`, { method: "PUT", body });
}

export function addRfqLine(id: number, body: RfqLineCreate): Promise<RfqLine> {
  return apiFetch<RfqLine>(`/procurement/rfqs/${id}/lines`, { method: "POST", body });
}

export function deleteRfqLine(id: number, lineId: number): Promise<void> {
  return apiFetch<void>(`/procurement/rfqs/${id}/lines/${lineId}`, { method: "DELETE" });
}

export function issueRfq(id: number): Promise<Rfq> {
  return apiFetch<Rfq>(`/procurement/rfqs/${id}/issue`, { method: "POST" });
}

export function cancelRfq(id: number): Promise<Rfq> {
  return apiFetch<Rfq>(`/procurement/rfqs/${id}/cancel`, { method: "POST" });
}

// ---------- Supplier quotes ----------
export type QuoteStatus = "received" | "accepted" | "rejected";

export interface SupplierQuoteLine {
  id: number;
  quote_id: number;
  rfq_line_id: number;
  quantity: number;
  unit_cost: number;
  line_total: number;
  notes: string | null;
  /** True when the bid is above the RFQ line's target unit cost. */
  over_target: boolean;
}

export interface SupplierQuoteLineCreate {
  rfq_line_id: number;
  quantity: number;
  unit_cost: number;
  notes?: string | null;
}

export interface SupplierQuote {
  id: number;
  organization_id: number;
  rfq_id: number;
  supplier_id: number;
  supplier_name: string | null;
  status: QuoteStatus;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  lead_time_days: number | null;
  valid_until: string | null;
  notes: string | null;
  received_at: string;
  purchase_order_id: number | null;
  decided_at: string | null;
  lines: SupplierQuoteLine[];
  created_at: string;
  updated_at: string;
}

export interface SupplierQuoteCreate {
  organization_id: number;
  rfq_id: number;
  supplier_id: number;
  tax_amount?: number;
  lead_time_days?: number | null;
  valid_until?: string | null;
  notes?: string | null;
  lines: SupplierQuoteLineCreate[];
}

export function listSupplierQuotes(params: ListParams = {}): Promise<Page<SupplierQuote>> {
  return apiFetch<Page<SupplierQuote>>(`/procurement/quotes${buildParams(params)}`);
}

export function getSupplierQuote(id: number): Promise<SupplierQuote> {
  return apiFetch<SupplierQuote>(`/procurement/quotes/${id}`);
}

export function createSupplierQuote(body: SupplierQuoteCreate): Promise<SupplierQuote> {
  return apiFetch<SupplierQuote>("/procurement/quotes", { method: "POST", body });
}

export function acceptSupplierQuote(id: number): Promise<SupplierQuote> {
  return apiFetch<SupplierQuote>(`/procurement/quotes/${id}/accept`, { method: "POST" });
}

export function rejectSupplierQuote(id: number): Promise<SupplierQuote> {
  return apiFetch<SupplierQuote>(`/procurement/quotes/${id}/reject`, { method: "POST" });
}

/** Turn an accepted quote into a draft purchase order for `warehouseId`. */
export function convertQuoteToPurchaseOrder(
  id: number,
  warehouseId: number,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(
    `/procurement/quotes/${id}/convert-to-po?warehouse_id=${warehouseId}`,
    { method: "POST" },
  );
}

// ---------- Purchase order approvals ----------
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface PurchaseOrderApproval {
  id: number;
  purchase_order_id: number;
  sequence: number;
  approver_id: number;
  approver_name: string | null;
  status: ApprovalStatus;
  decided_at: string | null;
  comments: string | null;
  created_at: string;
}

export function listPurchaseOrderApprovals(poId: number): Promise<PurchaseOrderApproval[]> {
  return apiFetch<PurchaseOrderApproval[]>(
    `/procurement/purchase-orders/${poId}/approvals`,
  );
}

/**
 * Submit a draft purchase order for approval. The list position of each
 * approver is their approval level, so levels are decided in order.
 */
export function submitPurchaseOrderForApproval(
  poId: number,
  approverIds: number[],
): Promise<PurchaseOrderApproval[]> {
  return apiFetch<PurchaseOrderApproval[]>(
    `/procurement/purchase-orders/${poId}/approvals`,
    { method: "POST", body: { approver_ids: approverIds } },
  );
}

export function approvePurchaseOrderLevel(
  poId: number,
  sequence: number,
  comments?: string | null,
): Promise<PurchaseOrderApproval[]> {
  return apiFetch<PurchaseOrderApproval[]>(
    `/procurement/purchase-orders/${poId}/approvals/${sequence}/approve`,
    { method: "POST", body: { comments: comments ?? null } },
  );
}

export function rejectPurchaseOrderLevel(
  poId: number,
  sequence: number,
  comments?: string | null,
): Promise<PurchaseOrderApproval[]> {
  return apiFetch<PurchaseOrderApproval[]>(
    `/procurement/purchase-orders/${poId}/approvals/${sequence}/reject`,
    { method: "POST", body: { comments: comments ?? null } },
  );
}
