import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import {
  listDepartments,
  listOrganizations,
  type Department,
  type Organization,
} from "../lib/core-api";
import {
  type Employee,
  type EmployeeCreate,
  type EmployeeUpdate,
  createEmployee,
  deleteEmployee,
  listDesignations,
  listEmployees,
  updateEmployee,
  type Designation,
} from "../lib/hrm-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

interface EmployeeFormValues {
  organization_id: string;
  department_id: string;
  designation_id: string;
  supervisor_id: string;
  employee_code: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  joining_date: string;
}

interface EmployeeFilters {
  organization_id: string;
  department_id: string;
  is_active: string;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active": return "bg-green-100 text-green-700";
    case "on_leave": return "bg-amber-100 text-amber-700";
    case "probation": return "bg-slate-100 text-slate-700";
    case "terminated":
    case "resigned":
      return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

const PAGE_SIZE = 20;

export function Employees() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<EmployeeFilters>({ organization_id: "", department_id: "", is_active: "" });
  const [committed, setCommitted] = useState<EmployeeFilters>({ organization_id: "", department_id: "", is_active: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const canRead = hasPermission("hrm:employees:read") || hasPermission("hrm:employees:write");
  const canWrite = hasPermission("hrm:employees:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const filterDeptsQ = useQuery({
    queryKey: ["departments", committed.organization_id, "filter"],
    queryFn: () => listDepartments({ organization_id: Number(committed.organization_id), page: 1, page_size: 1000 }),
    enabled: !!committed.organization_id,
  });

  const listQ = useQuery({
    queryKey: ["employees", page, search, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = { page, page_size: PAGE_SIZE, search };
      if (committed.organization_id) p.organization_id = Number(committed.organization_id);
      if (committed.department_id) p.department_id = Number(committed.department_id);
      if (committed.is_active === "true") p.is_active = true;
      if (committed.is_active === "false") p.is_active = false;
      return listEmployees(p);
    },
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: EmployeeCreate) => createEmployee(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: EmployeeUpdate }) => updateEmployee(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteEmployee(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (e: Employee) => {
    if (window.confirm(`Delete employee "${e.full_name}" (${e.employee_code})?`)) deleteM.mutate(e.id);
  };

  const applyFilters = () => { setCommitted(filters); setPage(1); };
  const resetFilters = () => {
    const empty = { organization_id: "", department_id: "", is_active: "" };
    setFilters(empty);
    setCommitted(empty);
    setPage(1);
  };

  const orgName = useMemo(() => new Map((orgsQ.data?.items ?? []).map((o) => [o.id, o.name])), [orgsQ.data]);
  const filterDepts = filterDeptsQ.data?.items ?? [];

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Employees"
        subtitle="Manage employee records across the organization."
        action={canWrite ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Create employee</Button> : undefined}
      />

      <Input
        placeholder="Search by name, code or email..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-xs"
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Organization</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.organization_id}
              onChange={(e) => setFilters((f) => ({ ...f, organization_id: e.target.value, department_id: "" }))}
            >
              <option value="">— All —</option>
              {(orgsQ.data?.items ?? []).map((o) => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Department</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.department_id}
              onChange={(e) => setFilters((f) => ({ ...f, department_id: e.target.value }))}
              disabled={!filters.organization_id}
            >
              <option value="">— All —</option>
              {filterDepts.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Active</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.is_active}
              onChange={(e) => setFilters((f) => ({ ...f, is_active: e.target.value }))}
            >
              <option value="">— All —</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="h-9 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-100"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {listQ.isLoading ? (
        <LoadingState />
      ) : listQ.isError ? (
        <ErrorState error={listQ.error} />
      ) : listQ.data && listQ.data.items.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>ID</Th>
                <Th>Code</Th>
                <Th>Full name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Org</Th>
                <Th>Dept</Th>
                <Th>Status</Th>
                <Th>Active</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((e) => (
                <Tr key={e.id}>
                  <Td className="text-slate-400">{e.id}</Td>
                  <Td className="font-mono text-xs">{e.employee_code}</Td>
                  <Td className="font-medium">{e.full_name}</Td>
                  <Td>{e.email ?? "—"}</Td>
                  <Td>{e.phone ?? "—"}</Td>
                  <Td className="text-slate-500">{orgName.get(e.organization_id) ?? `#${e.organization_id}`}</Td>
                  <Td className="text-slate-400">{e.department_id ?? "—"}</Td>
                  <Td><Badge className={statusBadgeClass(e.employment_status)}>{e.employment_status}</Badge></Td>
                  <Td>
                    <Badge className={e.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                      {e.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(e); setModalOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(e)}>Delete</Button>
                      </>
                    )}
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={listQ.data.page} pages={listQ.data.pages} total={listQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No employees found." />
      )}

      {modalOpen && (
        <EmployeeForm
          organizations={orgsQ.data?.items ?? []}
          loadingOrgs={orgsQ.isLoading}
          editing={editing}
          submitting={createM.isPending || updateM.isPending}
          serverError={createM.error ?? updateM.error}
          onCancel={close}
          onSubmitCreate={(b) => createM.mutate(b)}
          onSubmitUpdate={(id, b) => updateM.mutate({ id, body: b })}
        />
      )}
    </div>
  );
}

function EmployeeForm({
  organizations,
  loadingOrgs,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  loadingOrgs: boolean;
  editing: Employee | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: EmployeeCreate) => void;
  onSubmitUpdate: (id: number, body: EmployeeUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          department_id: editing.department_id ? String(editing.department_id) : "",
          designation_id: editing.designation_id ? String(editing.designation_id) : "",
          supervisor_id: editing.supervisor_id ? String(editing.supervisor_id) : "",
          employee_code: editing.employee_code,
          full_name: editing.full_name,
          phone: editing.phone ?? "",
          email: editing.email ?? "",
          address: editing.address ?? "",
          joining_date: editing.joining_date ?? "",
        }
      : { organization_id: "", department_id: "", designation_id: "", supervisor_id: "", employee_code: "", full_name: "", phone: "", email: "", address: "", joining_date: "" },
  });

  const orgIdStr = watch("organization_id");
  const orgId = orgIdStr ? Number(orgIdStr) : undefined;

  const deptsQ = useQuery({
    queryKey: ["departments", orgId, "emp-form"],
    queryFn: () => listDepartments({ organization_id: orgId as number, page: 1, page_size: 1000 }),
    enabled: !!orgId,
  });
  const desigsQ = useQuery({
    queryKey: ["designations", orgId, "emp-form"],
    queryFn: () => listDesignations({ organization_id: orgId as number, page: 1, page_size: 1000 }),
    enabled: !!orgId,
  });
  const supsQ = useQuery({
    queryKey: ["employees", orgId, "emp-form-supervisors"],
    queryFn: () => listEmployees({ organization_id: orgId as number, page: 1, page_size: 1000 }),
    enabled: !!orgId,
  });

  const departments: Department[] = deptsQ.data?.items ?? [];
  const designations: Designation[] = desigsQ.data?.items ?? [];
  const supervisors: Employee[] = (supsQ.data?.items ?? []).filter((e) => e.id !== editing?.id);

  const onSubmit = (values: EmployeeFormValues) => {
    const orgIdNum = Number(values.organization_id);
    if (!orgIdNum) return;

    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError("email", { message: "Enter a valid email" });
      return;
    }
    if (values.joining_date && Number.isNaN(new Date(values.joining_date).getTime())) {
      setError("joining_date", { message: "Enter a valid date" });
      return;
    }

    if (isEdit && editing) {
      const body: EmployeeUpdate = {
        department_id: values.department_id ? Number(values.department_id) : null,
        designation_id: values.designation_id ? Number(values.designation_id) : null,
        supervisor_id: values.supervisor_id ? Number(values.supervisor_id) : null,
        full_name: values.full_name,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        joining_date: values.joining_date || null,
      };
      onSubmitUpdate(editing.id, body);
    } else {
      const body: EmployeeCreate = {
        organization_id: orgIdNum,
        department_id: values.department_id ? Number(values.department_id) : undefined,
        designation_id: values.designation_id ? Number(values.designation_id) : undefined,
        supervisor_id: values.supervisor_id ? Number(values.supervisor_id) : undefined,
        employee_code: values.employee_code,
        full_name: values.full_name,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
        joining_date: values.joining_date || undefined,
      };
      onSubmitCreate(body);
    }
  };

  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit employee" : "Create employee"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="employee-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organization" error={errors.organization_id?.message}>
            {loadingOrgs ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <select
                className={selectClass}
                {...register("organization_id", { required: "Organization is required" })}
                disabled={isEdit}
              >
                <option value="">— Select —</option>
                {organizations.map((o) => (
                  <option key={o.id} value={String(o.id)}>{o.name} ({o.code})</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Department" hint={orgId ? "Optional" : "Select an organization first"}>
            <select className={selectClass} {...register("department_id")} disabled={!orgId || deptsQ.isLoading}>
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name} ({d.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Designation" hint={orgId ? "Optional" : "Select an organization first"}>
            <select className={selectClass} {...register("designation_id")} disabled={!orgId || desigsQ.isLoading}>
              <option value="">— None —</option>
              {designations.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}{d.grade ? ` · ${d.grade}` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Supervisor" hint={orgId ? "Optional" : "Select an organization first"}>
            <select className={selectClass} {...register("supervisor_id")} disabled={!orgId || supsQ.isLoading}>
              <option value="">— None —</option>
              {supervisors.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.full_name} ({s.employee_code})</option>
              ))}
            </select>
          </Field>
          <Field label="Employee code" error={errors.employee_code?.message}>
            <Input {...register("employee_code", { required: "Employee code is required" })} disabled={isEdit} />
          </Field>
          <Field label="Full name" error={errors.full_name?.message}>
            <Input {...register("full_name", { required: "Full name is required" })} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Joining date" error={errors.joining_date?.message}>
            <Input type="date" {...register("joining_date")} />
          </Field>
        </div>
        <Field label="Address" error={errors.address?.message}>
          <Input {...register("address")} />
        </Field>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}