import { apiFetch } from "./api";

// ---------- Generic pagination ----------
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

function buildParams(params: ListParams): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      usp.set(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

// ---------- Organizations ----------
export interface Organization {
  id: number;
  name: string;
  legal_name: string | null;
  code: string;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCreate {
  name: string;
  legal_name?: string;
  code: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active?: boolean;
}

export interface OrganizationUpdate {
  name?: string;
  legal_name?: string;
  code?: string;
  address?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active?: boolean;
}

export function listOrganizations(params: ListParams = {}): Promise<Page<Organization>> {
  return apiFetch<Page<Organization>>(`/core/organizations${buildParams(params)}`);
}

export function getOrganization(id: number): Promise<Organization> {
  return apiFetch<Organization>(`/core/organizations/${id}`);
}

export function createOrganization(body: OrganizationCreate): Promise<Organization> {
  return apiFetch<Organization>("/core/organizations", { method: "POST", body });
}

export function updateOrganization(id: number, body: OrganizationUpdate): Promise<Organization> {
  return apiFetch<Organization>(`/core/organizations/${id}`, { method: "PATCH", body });
}

export function deleteOrganization(id: number): Promise<void> {
  return apiFetch<void>(`/core/organizations/${id}`, { method: "DELETE" });
}

// ---------- Branches ----------
export interface Branch {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchCreate {
  organization_id: number;
  name: string;
  code: string;
  address?: string;
  is_active?: boolean;
}

export interface BranchUpdate {
  name?: string;
  code?: string;
  address?: string;
  is_active?: boolean;
}

export function listBranches(params: ListParams = {}): Promise<Page<Branch>> {
  return apiFetch<Page<Branch>>(`/core/branches${buildParams(params)}`);
}

export function createBranch(body: BranchCreate): Promise<Branch> {
  return apiFetch<Branch>("/core/branches", { method: "POST", body });
}

export function updateBranch(id: number, body: BranchUpdate): Promise<Branch> {
  return apiFetch<Branch>(`/core/branches/${id}`, { method: "PATCH", body });
}

export function deleteBranch(id: number): Promise<void> {
  return apiFetch<void>(`/core/branches/${id}`, { method: "DELETE" });
}

// ---------- Departments ----------
export interface Department {
  id: number;
  organization_id: number;
  branch_id: number | null;
  parent_id: number | null;
  name: string;
  code: string;
  is_active: boolean;
}

export interface DepartmentCreate {
  organization_id: number;
  branch_id?: number;
  parent_id?: number;
  name: string;
  code: string;
  is_active?: boolean;
}

export interface DepartmentUpdate {
  branch_id?: number | null;
  parent_id?: number | null;
  name?: string;
  code?: string;
  is_active?: boolean;
}

export function listDepartments(params: ListParams = {}): Promise<Page<Department>> {
  return apiFetch<Page<Department>>(`/core/departments${buildParams(params)}`);
}

export function createDepartment(body: DepartmentCreate): Promise<Department> {
  return apiFetch<Department>("/core/departments", { method: "POST", body });
}

export function updateDepartment(id: number, body: DepartmentUpdate): Promise<Department> {
  return apiFetch<Department>(`/core/departments/${id}`, { method: "PATCH", body });
}

export function deleteDepartment(id: number): Promise<void> {
  return apiFetch<void>(`/core/departments/${id}`, { method: "DELETE" });
}

// ---------- Permissions ----------
export interface PermissionDetail {
  id: number;
  code: string;
  module: string;
  description: string | null;
}

export function listPermissions(params: ListParams = {}): Promise<Page<PermissionDetail>> {
  return apiFetch<Page<PermissionDetail>>(`/core/permissions${buildParams(params)}`);
}

export function listAllPermissions(): Promise<PermissionDetail[]> {
  return listPermissions({ page: 1, page_size: 1000 }).then((p) => p.items);
}

// ---------- Roles ----------
export interface RoleDetail {
  id: number;
  name: string;
  code: string;
  is_system: boolean;
  description: string | null;
  permissions: PermissionDetail[];
}

export interface RoleCreate {
  name: string;
  code: string;
  description?: string;
  permission_ids: number[];
}

export interface RoleUpdate {
  name?: string;
  code?: string;
  description?: string;
  permission_ids?: number[];
}

export function listRoles(params: ListParams = {}): Promise<Page<RoleDetail>> {
  return apiFetch<Page<RoleDetail>>(`/core/roles${buildParams(params)}`);
}

export function getRole(id: number): Promise<RoleDetail> {
  return apiFetch<RoleDetail>(`/core/roles/${id}`);
}

export function createRole(body: RoleCreate): Promise<RoleDetail> {
  return apiFetch<RoleDetail>("/core/roles", { method: "POST", body });
}

export function updateRole(id: number, body: RoleUpdate): Promise<RoleDetail> {
  return apiFetch<RoleDetail>(`/core/roles/${id}`, { method: "PATCH", body });
}

export function deleteRole(id: number): Promise<void> {
  return apiFetch<void>(`/core/roles/${id}`, { method: "DELETE" });
}

// ---------- Users ----------
export interface UserDetail {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_superuser: boolean;
  organization_id: number | null;
  roles: { id: number; name: string; code: string }[];
  permissions: { id: number; code: string; module: string }[];
  last_login_at: string | null;
  created_at: string;
}

export interface UserCreate {
  email: string;
  full_name: string;
  password: string;
  phone?: string;
  organization_id?: number;
  is_superuser?: boolean;
  role_ids: number[];
  permission_ids: number[];
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  password?: string;
  phone?: string | null;
  organization_id?: number | null;
  is_superuser?: boolean;
  is_active?: boolean;
  role_ids?: number[];
  permission_ids?: number[];
}

export function listUsers(params: ListParams = {}): Promise<Page<UserDetail>> {
  return apiFetch<Page<UserDetail>>(`/core/users${buildParams(params)}`);
}

export function getUser(id: number): Promise<UserDetail> {
  return apiFetch<UserDetail>(`/core/users/${id}`);
}

export function createUser(body: UserCreate): Promise<UserDetail> {
  return apiFetch<UserDetail>("/core/users", { method: "POST", body });
}

export function updateUser(id: number, body: UserUpdate): Promise<UserDetail> {
  return apiFetch<UserDetail>(`/core/users/${id}`, { method: "PATCH", body });
}

export function deleteUser(id: number): Promise<void> {
  return apiFetch<void>(`/core/users/${id}`, { method: "DELETE" });
}

// ---------- Audit logs ----------
export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip: string | null;
  user_agent: string | null;
  device_id: string | null;
  created_at: string;
}

export function listAuditLogs(params: ListParams = {}): Promise<Page<AuditLog>> {
  return apiFetch<Page<AuditLog>>(`/core/audit-logs${buildParams(params)}`);
}

// ---------- System settings ----------
export interface SystemSetting {
  id: number;
  key: string;
  value: Record<string, unknown>;
  category: string | null;
  description: string | null;
}

export interface SystemSettingCreate {
  key: string;
  value: Record<string, unknown>;
  category?: string;
  description?: string;
}

export interface SystemSettingUpdate {
  key?: string;
  value?: Record<string, unknown>;
  category?: string;
  description?: string;
}

export function listSystemSettings(params: ListParams = {}): Promise<Page<SystemSetting>> {
  return apiFetch<Page<SystemSetting>>(`/core/settings${buildParams(params)}`);
}

export function createSystemSetting(body: SystemSettingCreate): Promise<SystemSetting> {
  return apiFetch<SystemSetting>("/core/settings", { method: "POST", body });
}

export function updateSystemSetting(id: number, body: SystemSettingUpdate): Promise<SystemSetting> {
  return apiFetch<SystemSetting>(`/core/settings/${id}`, { method: "PATCH", body });
}

export function deleteSystemSetting(id: number): Promise<void> {
  return apiFetch<void>(`/core/settings/${id}`, { method: "DELETE" });
}