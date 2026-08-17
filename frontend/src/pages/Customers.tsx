import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  listBranches,
  listOrganizations,
  type Branch,
  type Organization,
} from "../lib/core-api";
import { listEmployees, type Employee } from "../lib/hrm-api";
import {
  type Customer,
  type CustomerCreate,
  type CustomerUpdate,
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from "../lib/customers-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

const PAGE_SIZE = 20;

const CUSTOMER_STATUSES: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending_installation", label: "Pending Installation" },
  { value: "suspended", label: "Suspended" },
  { value: "disconnected", label: "Disconnected" },
  { value: "terminated", label: "Terminated" },
];

interface CustomerFormValues {
  organization_id: string;
  branch_id: string;
  customer_code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  installation_date: string;
  status: string;
  assigned_technician_id: string;
  notes: string;
  is_active: boolean;
}

interface CustomerFilters {
  organization_id: string;
  status: string;
  assigned_technician_id: string;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active": return "bg-green-100 text-green-700";
    case "pending_installation": return "bg-amber-100 text-amber-700";
    case "suspended": return "bg-orange-100 text-orange-700";
    case "disconnected": return "bg-red-100 text-red-700";
    case "terminated": return "bg-slate-300 text-slate-800";
    default: return "bg-slate-100 text-slate-600";
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export function Customers() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CustomerFilters>({
    organization_id: "",
    status: "",
    assigned_technician_id: "",
  });
  const [committed, setCommitted] = useState<CustomerFilters>({
    organization_id: "",
    status: "",
    assigned_technician_id: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const canRead = hasPermission("customers:read") || hasPermission("customers:write");
  const canWrite = hasPermission("customers:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const techniciansQ = useQuery({
    queryKey: ["employees", "technicians-all"],
    queryFn: () => listEmployees({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["customers", page, search, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = { page, page_size: PAGE_SIZE, search };
      if (committed.organization_id) p.organization_id = Number(committed.organization_id);
      if (committed.status) p.status = committed.status;
      if (committed.assigned_technician_id) p.assigned_technician_id = Number(committed.assigned_technician_id);
      return listCustomers(p);
    },
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: CustomerCreate) => createCustomer(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CustomerUpdate }) => updateCustomer(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (c: Customer) => {
    if (window.confirm(`Delete customer "${c.name}" (${c.customer_code})?`)) deleteM.mutate(c.id);
  };

  const applyFilters = () => { setCommitted(filters); setPage(1); };
  const resetFilters = () => {
    const empty = { organization_id: "", status: "", assigned_technician_id: "" };
    setFilters(empty);
    setCommitted(empty);
    setPage(1);
  };

  const orgName = useMemo(() => new Map((orgsQ.data?.items ?? []).map((o) => [o.id, o.name])), [orgsQ.data]);
  const technicianName = useMemo(
    () => new Map((techniciansQ.data?.items ?? []).map((e) => [e.id, `${e.full_name} (${e.employee_code})`])),
    [techniciansQ.data],
  );

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Customers"
        subtitle="Manage customer records across the organization."
        action={canWrite ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Create customer</Button> : undefined}
      />

      <Input
        placeholder="Search by name, code or phone..."
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
              onChange={(e) => setFilters((f) => ({ ...f, organization_id: e.target.value }))}
            >
              <option value="">— All —</option>
              {(orgsQ.data?.items ?? []).map((o) => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Status</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">— All —</option>
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Assigned technician</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.assigned_technician_id}
              onChange={(e) => setFilters((f) => ({ ...f, assigned_technician_id: e.target.value }))}
            >
              <option value="">— All —</option>
              {(techniciansQ.data?.items ?? []).map((t) => (
                <option key={t.id} value={String(t.id)}>{t.full_name} ({t.employee_code})</option>
              ))}
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
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Email</Th>
                <Th>Org</Th>
                <Th>Status</Th>
                <Th>Technician</Th>
                <Th>Installed</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((c) => (
                <Tr key={c.id}>
                  <Td className="text-slate-400">{c.id}</Td>
                  <Td className="font-mono text-xs">{c.customer_code}</Td>
                  <Td className="font-medium">
                    <button
                      type="button"
                      className="text-left text-brand hover:underline"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      {c.name}
                    </button>
                  </Td>
                  <Td>{c.phone ?? "—"}</Td>
                  <Td>{c.email ?? "—"}</Td>
                  <Td className="text-slate-500">{orgName.get(c.organization_id) ?? `#${c.organization_id}`}</Td>
                  <Td><Badge className={statusBadgeClass(c.status)}>{c.status}</Badge></Td>
                  <Td className="text-slate-500">{c.assigned_technician_id ? technicianName.get(c.assigned_technician_id) ?? `#${c.assigned_technician_id}` : "—"}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{fmtDate(c.installation_date)}</Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setModalOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(c)}>Delete</Button>
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
        <EmptyState text="No customers found." />
      )}

      {modalOpen && (
        <CustomerForm
          organizations={orgsQ.data?.items ?? []}
          technicians={techniciansQ.data?.items ?? []}
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

function CustomerForm({
  organizations,
  technicians,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  technicians: Employee[];
  editing: Customer | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: CustomerCreate) => void;
  onSubmitUpdate: (id: number, body: CustomerUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          branch_id: editing.branch_id ? String(editing.branch_id) : "",
          customer_code: editing.customer_code,
          name: editing.name,
          phone: editing.phone ?? "",
          email: editing.email ?? "",
          address: editing.address ?? "",
          installation_date: editing.installation_date ?? "",
          status: editing.status,
          assigned_technician_id: editing.assigned_technician_id ? String(editing.assigned_technician_id) : "",
          notes: editing.notes ?? "",
          is_active: editing.is_active,
        }
      : {
          organization_id: "",
          branch_id: "",
          customer_code: "",
          name: "",
          phone: "",
          email: "",
          address: "",
          installation_date: "",
          status: "active",
          assigned_technician_id: "",
          notes: "",
          is_active: true,
        },
  });

  const orgIdStr = watch("organization_id");
  const orgId = orgIdStr ? Number(orgIdStr) : undefined;

  const branchesQ = useQuery({
    queryKey: ["branches", orgId, "cust-form"],
    queryFn: () => listBranches({ organization_id: orgId as number, page: 1, page_size: 1000 }),
    enabled: !!orgId,
  });
  const branches: Branch[] = branchesQ.data?.items ?? [];

  const onSubmit = (values: CustomerFormValues) => {
    const orgIdNum = Number(values.organization_id);
    if (!orgIdNum) return;

    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError("email", { message: "Enter a valid email" });
      return;
    }
    if (values.installation_date && Number.isNaN(new Date(values.installation_date).getTime())) {
      setError("installation_date", { message: "Enter a valid date" });
      return;
    }

    if (isEdit && editing) {
      const body: CustomerUpdate = {
        branch_id: values.branch_id ? Number(values.branch_id) : null,
        customer_code: values.customer_code,
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        installation_date: values.installation_date || null,
        status: values.status,
        assigned_technician_id: values.assigned_technician_id ? Number(values.assigned_technician_id) : null,
        notes: values.notes || null,
        is_active: values.is_active,
      };
      onSubmitUpdate(editing.id, body);
    } else {
      const body: CustomerCreate = {
        organization_id: orgIdNum,
        branch_id: values.branch_id ? Number(values.branch_id) : undefined,
        customer_code: values.customer_code,
        name: values.name,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
        installation_date: values.installation_date || undefined,
        status: values.status,
        assigned_technician_id: values.assigned_technician_id ? Number(values.assigned_technician_id) : undefined,
        notes: values.notes || undefined,
        is_active: values.is_active,
      };
      onSubmitCreate(body);
    }
  };

  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit customer" : "Create customer"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="customer-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organization" error={errors.organization_id?.message}>
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
          </Field>
          <Field label="Branch" hint={orgId ? "Optional" : "Select an organization first"}>
            <select className={selectClass} {...register("branch_id")} disabled={!orgId || branchesQ.isLoading}>
              <option value="">— None —</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name} ({b.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Customer code" error={errors.customer_code?.message}>
            <Input {...register("customer_code", { required: "Customer code is required" })} disabled={isEdit} />
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Installation date" error={errors.installation_date?.message}>
            <Input type="date" {...register("installation_date")} />
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <select className={selectClass} {...register("status", { required: "Status is required" })}>
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned technician" hint="Optional">
            <select className={selectClass} {...register("assigned_technician_id")}>
              <option value="">— None —</option>
              {technicians.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.full_name} ({t.employee_code})</option>
              ))}
            </select>
          </Field>
          <Field label="Address" error={errors.address?.message}>
            <Input {...register("address")} />
          </Field>
        </div>
        <Field label="Notes" error={errors.notes?.message}>
          <textarea
            className="h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("notes")}
            spellCheck={false}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("is_active")} /> Active
        </label>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}
