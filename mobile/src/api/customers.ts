import { apiFetch } from "./client";
import type {
  Page,
  Customer,
  CustomerCreate,
  CustomerLocation,
  CustomerLocationCreate,
  CustomerVisit,
  CustomerVisitCreate,
  WorkOrder,
  WorkOrderCreate,
  WorkOrderAction,
  WorkOrderEvent,
} from "../types";

// ── Customers ─────────────────────────────────────────────────────────
export async function listCustomers(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  organization_id?: number;
  status?: string;
}): Promise<Page<Customer>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.search) q.set("search", params.search);
  if (params?.organization_id) q.set("organization_id", String(params.organization_id));
  if (params?.status) q.set("status", params.status);
  return apiFetch<Page<Customer>>(`/customers?${q.toString()}`);
}

export async function getCustomer(id: number): Promise<Customer> {
  return apiFetch<Customer>(`/customers/${id}`);
}

// ── Customer Locations ────────────────────────────────────────────────
export async function listCustomerLocations(customerId: number): Promise<Page<CustomerLocation>> {
  return apiFetch<Page<CustomerLocation>>(`/customer-locations?customer_id=${customerId}`);
}

export async function addCustomerLocation(
  payload: CustomerLocationCreate
): Promise<CustomerLocation> {
  return apiFetch<CustomerLocation>("/customer-locations", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  });
}

// ── Customer Visits ──────────────────────────────────────────────────
export async function listCustomerVisits(customerId: number): Promise<Page<CustomerVisit>> {
  return apiFetch<Page<CustomerVisit>>(`/customer-visits?customer_id=${customerId}`);
}

export async function createCustomerVisit(
  payload: CustomerVisitCreate
): Promise<CustomerVisit> {
  return apiFetch<CustomerVisit>("/customer-visits", {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  });
}

// ── Work Orders ──────────────────────────────────────────────────────
export async function listWorkOrders(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  assigned_employee_id?: number;
}): Promise<Page<WorkOrder>> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.page_size) q.set("page_size", String(params.page_size));
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.assigned_employee_id)
    q.set("assigned_employee_id", String(params.assigned_employee_id));
  return apiFetch<Page<WorkOrder>>(`/work-orders?${q.toString()}`);
}

export async function getWorkOrder(id: number): Promise<WorkOrder> {
  return apiFetch<WorkOrder>(`/work-orders/${id}`);
}

export async function transitionWorkOrder(
  id: number,
  action: WorkOrderAction
): Promise<WorkOrder> {
  return apiFetch<WorkOrder>(`/work-orders/${id}/transition`, {
    method: "POST",
    body: action as unknown as Record<string, unknown>,
  });
}

export async function listWorkOrderEvents(workOrderId: number): Promise<Page<WorkOrderEvent>> {
  return apiFetch<Page<WorkOrderEvent>>(`/work-order-events?work_order_id=${workOrderId}`);
}