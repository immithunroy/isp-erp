import { apiFetch } from "./api";
import { type ListParams, buildParams, type Page } from "./core-api";

// ---------- Designations ----------
export interface Designation {
  id: number;
  organization_id: number;
  department_id: number | null;
  name: string;
  code: string | null;
  grade: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignationCreate {
  organization_id: number;
  department_id?: number;
  name: string;
  code?: string;
  grade?: string;
  is_active?: boolean;
}

export interface DesignationUpdate {
  department_id?: number | null;
  name?: string;
  code?: string | null;
  grade?: string | null;
  is_active?: boolean;
}

export function listDesignations(params: ListParams = {}): Promise<Page<Designation>> {
  return apiFetch<Page<Designation>>(`/hrm/designations${buildParams(params)}`);
}

export function getDesignation(id: number): Promise<Designation> {
  return apiFetch<Designation>(`/hrm/designations/${id}`);
}

export function createDesignation(body: DesignationCreate): Promise<Designation> {
  return apiFetch<Designation>("/hrm/designations", { method: "POST", body });
}

export function updateDesignation(id: number, body: DesignationUpdate): Promise<Designation> {
  return apiFetch<Designation>(`/hrm/designations/${id}`, { method: "PATCH", body });
}

export function deleteDesignation(id: number): Promise<void> {
  return apiFetch<void>(`/hrm/designations/${id}`, { method: "DELETE" });
}

// ---------- Employees ----------
export type EmploymentStatus = "active" | "on_leave" | "terminated" | "resigned" | "probation";

export interface Employee {
  id: number;
  organization_id: number;
  branch_id: number | null;
  department_id: number | null;
  designation_id: number | null;
  supervisor_id: number | null;
  user_id: number | null;
  employee_code: string;
  full_name: string;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  joining_date: string | null;
  employment_status: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCreate {
  organization_id: number;
  branch_id?: number;
  department_id?: number;
  designation_id?: number;
  supervisor_id?: number;
  user_id?: number;
  employee_code: string;
  full_name: string;
  photo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  joining_date?: string;
  employment_status?: string;
  notes?: string;
}

export interface EmployeeUpdate {
  branch_id?: number | null;
  department_id?: number | null;
  designation_id?: number | null;
  supervisor_id?: number | null;
  user_id?: number | null;
  full_name?: string;
  photo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  joining_date?: string | null;
  employment_status?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function listEmployees(params: ListParams = {}): Promise<Page<Employee>> {
  return apiFetch<Page<Employee>>(`/hrm/employees${buildParams(params)}`);
}

export function getEmployee(id: number): Promise<Employee> {
  return apiFetch<Employee>(`/hrm/employees/${id}`);
}

export function createEmployee(body: EmployeeCreate): Promise<Employee> {
  return apiFetch<Employee>("/hrm/employees", { method: "POST", body });
}

export function updateEmployee(id: number, body: EmployeeUpdate): Promise<Employee> {
  return apiFetch<Employee>(`/hrm/employees/${id}`, { method: "PATCH", body });
}

export function deleteEmployee(id: number): Promise<void> {
  return apiFetch<void>(`/hrm/employees/${id}`, { method: "DELETE" });
}

// ---------- Shifts ----------
export interface Shift {
  id: number;
  organization_id: number;
  name: string;
  code: string | null;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftCreate {
  organization_id: number;
  name: string;
  code?: string;
  start_time: string;
  end_time: string;
  grace_minutes?: number;
  is_active?: boolean;
}

export interface ShiftUpdate {
  name?: string;
  code?: string | null;
  start_time?: string;
  end_time?: string;
  grace_minutes?: number;
  is_active?: boolean;
}

export function listShifts(params: ListParams = {}): Promise<Page<Shift>> {
  return apiFetch<Page<Shift>>(`/hrm/shifts${buildParams(params)}`);
}

export function getShift(id: number): Promise<Shift> {
  return apiFetch<Shift>(`/hrm/shifts/${id}`);
}

export function createShift(body: ShiftCreate): Promise<Shift> {
  return apiFetch<Shift>("/hrm/shifts", { method: "POST", body });
}

export function updateShift(id: number, body: ShiftUpdate): Promise<Shift> {
  return apiFetch<Shift>(`/hrm/shifts/${id}`, { method: "PATCH", body });
}

export function deleteShift(id: number): Promise<void> {
  return apiFetch<void>(`/hrm/shifts/${id}`, { method: "DELETE" });
}

// ---------- Employee Shifts (assignment) ----------
export interface EmployeeShift {
  id: number;
  employee_id: number;
  shift_id: number;
  effective_from: string;
  effective_to: string | null;
}

export interface EmployeeShiftCreate {
  employee_id: number;
  shift_id: number;
  effective_from: string;
  effective_to?: string;
}

export function assignShift(body: EmployeeShiftCreate): Promise<EmployeeShift> {
  return apiFetch<EmployeeShift>("/hrm/employee-shifts", { method: "POST", body });
}

// ---------- Holidays ----------
export type HolidayScope = "organization" | "branch";

export interface Holiday {
  id: number;
  organization_id: number;
  branch_id: number | null;
  name: string;
  description: string | null;
  date: string;
  is_recurring: boolean;
  scope: string;
  created_at: string;
  updated_at: string;
}

export interface HolidayCreate {
  organization_id: number;
  branch_id?: number;
  name: string;
  description?: string;
  date: string;
  is_recurring?: boolean;
  scope?: string;
}

export interface HolidayUpdate {
  branch_id?: number | null;
  name?: string;
  description?: string | null;
  date?: string;
  is_recurring?: boolean;
  scope?: string;
}

export function listHolidays(params: ListParams = {}): Promise<Page<Holiday>> {
  return apiFetch<Page<Holiday>>(`/hrm/holidays${buildParams(params)}`);
}

export function getHoliday(id: number): Promise<Holiday> {
  return apiFetch<Holiday>(`/hrm/holidays/${id}`);
}

export function createHoliday(body: HolidayCreate): Promise<Holiday> {
  return apiFetch<Holiday>("/hrm/holidays", { method: "POST", body });
}

export function updateHoliday(id: number, body: HolidayUpdate): Promise<Holiday> {
  return apiFetch<Holiday>(`/hrm/holidays/${id}`, { method: "PATCH", body });
}

export function deleteHoliday(id: number): Promise<void> {
  return apiFetch<void>(`/hrm/holidays/${id}`, { method: "DELETE" });
}

// ---------- Leave Types ----------
export interface LeaveType {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  description: string | null;
  default_days: number;
  is_paid: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveTypeCreate {
  organization_id: number;
  name: string;
  code: string;
  description?: string;
  default_days?: number;
  is_paid?: boolean;
  is_active?: boolean;
}

export interface LeaveTypeUpdate {
  name?: string;
  code?: string;
  description?: string | null;
  default_days?: number;
  is_paid?: boolean;
  is_active?: boolean;
}

export function listLeaveTypes(params: ListParams = {}): Promise<Page<LeaveType>> {
  return apiFetch<Page<LeaveType>>(`/hrm/leave-types${buildParams(params)}`);
}

export function createLeaveType(body: LeaveTypeCreate): Promise<LeaveType> {
  return apiFetch<LeaveType>("/hrm/leave-types", { method: "POST", body });
}

export function updateLeaveType(id: number, body: LeaveTypeUpdate): Promise<LeaveType> {
  return apiFetch<LeaveType>(`/hrm/leave-types/${id}`, { method: "PATCH", body });
}

export function deleteLeaveType(id: number): Promise<void> {
  return apiFetch<void>(`/hrm/leave-types/${id}`, { method: "DELETE" });
}

// ---------- Leave Balances ----------
export interface LeaveBalance {
  id: number;
  employee_id: number;
  leave_type_id: number;
  year: number;
  allocated_days: number;
  used_days: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalanceCreate {
  employee_id: number;
  leave_type_id: number;
  year: number;
  allocated_days?: number;
}

export interface LeaveBalanceUpdate {
  allocated_days?: number;
}

export function listLeaveBalances(params: ListParams = {}): Promise<Page<LeaveBalance>> {
  return apiFetch<Page<LeaveBalance>>(`/hrm/leave-balances${buildParams(params)}`);
}

export function createLeaveBalance(body: LeaveBalanceCreate): Promise<LeaveBalance> {
  return apiFetch<LeaveBalance>("/hrm/leave-balances", { method: "POST", body });
}

export function updateLeaveBalance(id: number, body: LeaveBalanceUpdate): Promise<LeaveBalance> {
  return apiFetch<LeaveBalance>(`/hrm/leave-balances/${id}`, { method: "PATCH", body });
}

// ---------- Leave Requests ----------
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: number;
  employee_id: number;
  leave_type_id: number;
  from_date: string;
  to_date: string;
  reason: string | null;
  status: string;
  approver_id: number | null;
  approved_at: string | null;
  approver_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestCreate {
  employee_id: number;
  leave_type_id: number;
  from_date: string;
  to_date: string;
  reason?: string;
}

export interface LeaveRequestAction {
  status: string;
  approver_note?: string;
}

export function listLeaveRequests(params: ListParams = {}): Promise<Page<LeaveRequest>> {
  return apiFetch<Page<LeaveRequest>>(`/hrm/leave-requests${buildParams(params)}`);
}

export function getLeaveRequest(id: number): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/hrm/leave-requests/${id}`);
}

export function createLeaveRequest(body: LeaveRequestCreate): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>("/hrm/leave-requests", { method: "POST", body });
}

export function actionLeaveRequest(id: number, body: LeaveRequestAction): Promise<LeaveRequest> {
  return apiFetch<LeaveRequest>(`/hrm/leave-requests/${id}/action`, { method: "POST", body });
}

// ---------- Attendance ----------
export type AttendanceType =
  | "check_in"
  | "check_out"
  | "break_resume"
  | "break_end"
  | "field";

export interface Attendance {
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
  ip: string | null;
  source: string;
  notes: string | null;
  is_corrected: boolean;
  created_at: string;
}

export interface AttendanceCreate {
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
  source?: string;
  notes?: string;
}

export interface AttendanceCorrectionCreate {
  attendance_id: number;
  previous_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  reason?: string;
}

export function listAttendance(params: ListParams = {}): Promise<Page<Attendance>> {
  return apiFetch<Page<Attendance>>(`/hrm/attendance${buildParams(params)}`);
}

export function getAttendance(id: number): Promise<Attendance> {
  return apiFetch<Attendance>(`/hrm/attendance/${id}`);
}

export function createAttendance(body: AttendanceCreate): Promise<Attendance> {
  return apiFetch<Attendance>("/hrm/attendance", { method: "POST", body });
}

export function correctAttendance(body: AttendanceCorrectionCreate): Promise<void> {
  return apiFetch<void>("/hrm/attendance-corrections", { method: "POST", body });
}