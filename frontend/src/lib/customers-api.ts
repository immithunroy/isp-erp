import { apiFetch } from "./api";
import { type ListParams, buildParams, type Page } from "./core-api";

// ---------- Customers ----------
export type CustomerStatus =
  | "active"
  | "pending_installation"
  | "suspended"
  | "disconnected"
  | "terminated";

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
  branch_id?: number;
  customer_code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  installation_date?: string;
  status?: string;
  assigned_technician_id?: number;
  notes?: string;
  is_active?: boolean;
}

export interface CustomerUpdate {
  branch_id?: number | null;
  customer_code?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  installation_date?: string | null;
  status?: string;
  assigned_technician_id?: number | null;
  notes?: string | null;
  is_active?: boolean;
}

export function listCustomers(params: ListParams = {}): Promise<Page<Customer>> {
  return apiFetch<Page<Customer>>(`/customers/customers${buildParams(params)}`);
}

export function getCustomer(id: number): Promise<Customer> {
  return apiFetch<Customer>(`/customers/customers/${id}`);
}

export function createCustomer(body: CustomerCreate): Promise<Customer> {
  return apiFetch<Customer>("/customers/customers", { method: "POST", body });
}

export function updateCustomer(id: number, body: CustomerUpdate): Promise<Customer> {
  return apiFetch<Customer>(`/customers/customers/${id}`, { method: "PATCH", body });
}

export function deleteCustomer(id: number): Promise<void> {
  return apiFetch<void>(`/customers/customers/${id}`, { method: "DELETE" });
}

// ---------- Customer Locations ----------
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

export function listCustomerLocations(params: ListParams = {}): Promise<Page<CustomerLocation>> {
  return apiFetch<Page<CustomerLocation>>(`/customers/customer-locations${buildParams(params)}`);
}

export function addCustomerLocation(body: CustomerLocationCreate): Promise<CustomerLocation> {
  return apiFetch<CustomerLocation>("/customers/customer-locations", { method: "POST", body });
}

// ---------- Customer Visits ----------
export interface CustomerVisit {
  id: number;
  customer_id: number;
  employee_id: number;
  purpose: string | null;
  visited_at: string;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  photos: string | null;
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
  photos?: string;
  notes?: string;
}

export function listCustomerVisits(params: ListParams = {}): Promise<Page<CustomerVisit>> {
  return apiFetch<Page<CustomerVisit>>(`/customers/customer-visits${buildParams(params)}`);
}

export function createCustomerVisit(body: CustomerVisitCreate): Promise<CustomerVisit> {
  return apiFetch<CustomerVisit>("/customers/customer-visits", { method: "POST", body });
}

// ---------- Work Orders ----------
export type WorkOrderStatus =
  | "assigned"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "approved";

export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";

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
  photos: string | null;
  equipment_used: string | null;
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

export interface WorkOrderUpdate {
  assigned_employee_id?: number | null;
  scheduled_date?: string | null;
  priority?: string;
  status?: string;
  notes?: string | null;
  completion_report?: string | null;
}

export interface WorkOrderAction {
  status: string;
  notes?: string;
}

export function listWorkOrders(params: ListParams = {}): Promise<Page<WorkOrder>> {
  return apiFetch<Page<WorkOrder>>(`/field-service/work-orders${buildParams(params)}`);
}

export function getWorkOrder(id: number): Promise<WorkOrder> {
  return apiFetch<WorkOrder>(`/field-service/work-orders/${id}`);
}

export function createWorkOrder(body: WorkOrderCreate): Promise<WorkOrder> {
  return apiFetch<WorkOrder>("/field-service/work-orders", { method: "POST", body });
}

export function updateWorkOrder(id: number, body: WorkOrderUpdate): Promise<WorkOrder> {
  return apiFetch<WorkOrder>(`/field-service/work-orders/${id}`, { method: "PATCH", body });
}

export function transitionWorkOrder(id: number, body: WorkOrderAction): Promise<WorkOrder> {
  return apiFetch<WorkOrder>(`/field-service/work-orders/${id}/action`, { method: "POST", body });
}

export function deleteWorkOrder(id: number): Promise<void> {
  return apiFetch<void>(`/field-service/work-orders/${id}`, { method: "DELETE" });
}

// ---------- Work Order Events ----------
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

export function listWorkOrderEvents(params: ListParams = {}): Promise<Page<WorkOrderEvent>> {
  return apiFetch<Page<WorkOrderEvent>>(`/field-service/work-order-events${buildParams(params)}`);
}
