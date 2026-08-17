import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import {
  listOrganizations,
  type Organization,
} from "../lib/core-api";
import { listEmployees, type Employee } from "../lib/hrm-api";
import {
  type WorkOrder,
  type WorkOrderAction,
  type WorkOrderCreate,
  type WorkOrderEvent,
  type WorkOrderUpdate,
  createWorkOrder,
  deleteWorkOrder,
  listCustomers,
  listWorkOrderEvents,
  listWorkOrders,
  transitionWorkOrder,
  updateWorkOrder,
  type Customer,
} from "../lib/customers-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

const PAGE_SIZE = 20;

const WORK_ORDER_STATUSES: { value: string; label: string }[] = [
  { value: "assigned", label: "Assigned" },
  { value: "accepted", label: "Accepted" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "approved", label: "Approved" },
];

const JOB_TYPES: { value: string; label: string }[] = [
  { value: "installation", label: "Installation" },
  { value: "repair", label: "Repair" },
  { value: "maintenance", label: "Maintenance" },
  { value: "survey", label: "Survey" },
  { value: "disconnection", label: "Disconnection" },
  { value: "relocation", label: "Relocation" },
  { value: "upgrade", label: "Upgrade" },
  { value: "support", label: "Support" },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "assigned": return "bg-slate-100 text-slate-700";
    case "accepted": return "bg-blue-100 text-blue-700";
    case "in_progress": return "bg-amber-100 text-amber-700";
    case "completed": return "bg-green-100 text-green-700";
    case "cancelled": return "bg-red-100 text-red-700";
    case "approved": return "bg-emerald-100 text-emerald-800";
    default: return "bg-slate-100 text-slate-600";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-700";
    case "high": return "bg-orange-100 text-orange-700";
    case "medium": return "bg-amber-100 text-amber-700";
    case "low": return "bg-slate-100 text-slate-600";
    default: return "bg-slate-100 text-slate-600";
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

interface WorkOrderFormValues {
  organization_id: string;
  customer_id: string;
  work_order_code: string;
  job_type: string;
  priority: string;
  assigned_employee_id: string;
  scheduled_date: string;
  notes: string;
}

interface WorkOrderFilters {
  status: string;
  priority: string;
  assigned_employee_id: string;
  customer_id: string;
}

export function FieldService() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<WorkOrderFilters>({
    status: "",
    priority: "",
    assigned_employee_id: "",
    customer_id: "",
  });
  const [committed, setCommitted] = useState<WorkOrderFilters>({
    status: "",
    priority: "",
    assigned_employee_id: "",
    customer_id: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<WorkOrder | null>(null);
  const [eventsTarget, setEventsTarget] = useState<WorkOrder | null>(null);

  const canRead = hasPermission("field_service:read") || hasPermission("field_service:write") || hasPermission("field_service:approve");
  const canWrite = hasPermission("field_service:write");
  const canApprove = hasPermission("field_service:approve");
  const canTransition = canWrite || canApprove;

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });
  const employeesQ = useQuery({
    queryKey: ["employees", "all"],
    queryFn: () => listEmployees({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });
  const customersQ = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => listCustomers({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["work-orders", page, search, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = { page, page_size: PAGE_SIZE, search };
      if (committed.status) p.status = committed.status;
      if (committed.priority) p.priority = committed.priority;
      if (committed.assigned_employee_id) p.assigned_employee_id = Number(committed.assigned_employee_id);
      if (committed.customer_id) p.customer_id = Number(committed.customer_id);
      return listWorkOrders(p);
    },
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: WorkOrderCreate) => createWorkOrder(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-orders"] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: WorkOrderUpdate }) => updateWorkOrder(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-orders"] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteWorkOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work-orders"] }),
  });
  const transitionM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: WorkOrderAction }) => transitionWorkOrder(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      setTransitionTarget(null);
    },
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (w: WorkOrder) => {
    if (window.confirm(`Delete work order "${w.work_order_code}"?`)) deleteM.mutate(w.id);
  };

  const applyFilters = () => { setCommitted(filters); setPage(1); };
  const resetFilters = () => {
    const empty = { status: "", priority: "", assigned_employee_id: "", customer_id: "" };
    setFilters(empty);
    setCommitted(empty);
    setPage(1);
  };

  const employeeName = useMemo(
    () => new Map((employeesQ.data?.items ?? []).map((e) => [e.id, `${e.full_name} (${e.employee_code})`])),
    [employeesQ.data],
  );
  const customerName = useMemo(
    () => new Map((customersQ.data?.items ?? []).map((c) => [c.id, `${c.name} (${c.customer_code})`])),
    [customersQ.data],
  );

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Field Service"
        subtitle="Work orders for field operations."
        action={canWrite ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Create work order</Button> : undefined}
      />

      <Input
        placeholder="Search by work order code..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-xs"
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Status</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">— All —</option>
              {WORK_ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Priority</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.priority}
              onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
            >
              <option value="">— All —</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Assigned employee</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.assigned_employee_id}
              onChange={(e) => setFilters((f) => ({ ...f, assigned_employee_id: e.target.value }))}
            >
              <option value="">— All —</option>
              {(employeesQ.data?.items ?? []).map((e) => (
                <option key={e.id} value={String(e.id)}>{e.full_name} ({e.employee_code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Customer</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.customer_id}
              onChange={(e) => setFilters((f) => ({ ...f, customer_id: e.target.value }))}
            >
              <option value="">— All —</option>
              {(customersQ.data?.items ?? []).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name} ({c.customer_code})</option>
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
                <Th>Job type</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Customer</Th>
                <Th>Assigned to</Th>
                <Th>Scheduled</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((w) => (
                <Tr key={w.id}>
                  <Td className="text-slate-400">{w.id}</Td>
                  <Td className="font-mono text-xs">{w.work_order_code}</Td>
                  <Td>{w.job_type}</Td>
                  <Td><Badge className={priorityBadgeClass(w.priority)}>{w.priority}</Badge></Td>
                  <Td><Badge className={statusBadgeClass(w.status)}>{w.status}</Badge></Td>
                  <Td className="text-slate-500">{w.customer_id ? customerName.get(w.customer_id) ?? `#${w.customer_id}` : "—"}</Td>
                  <Td className="text-slate-500">{w.assigned_employee_id ? employeeName.get(w.assigned_employee_id) ?? `#${w.assigned_employee_id}` : "—"}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{fmtDate(w.scheduled_date)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {canTransition && (
                      <Button variant="ghost" size="sm" onClick={() => setTransitionTarget(w)}>Transition</Button>
                    )}
                    {canWrite && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(w); setModalOpen(true); }}>Edit</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEventsTarget(w)}>Events</Button>
                    {canWrite && (
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(w)}>Delete</Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={listQ.data.page} pages={listQ.data.pages} total={listQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No work orders found." />
      )}

      {modalOpen && (
        <WorkOrderForm
          organizations={orgsQ.data?.items ?? []}
          employees={employeesQ.data?.items ?? []}
          customers={customersQ.data?.items ?? []}
          editing={editing}
          submitting={createM.isPending || updateM.isPending}
          serverError={createM.error ?? updateM.error}
          onCancel={close}
          onSubmitCreate={(b) => createM.mutate(b)}
          onSubmitUpdate={(id, b) => updateM.mutate({ id, body: b })}
        />
      )}

      {transitionTarget && (
        <TransitionModal
          workOrder={transitionTarget}
          canApprove={canApprove}
          canWrite={canWrite}
          submitting={transitionM.isPending}
          serverError={transitionM.error}
          onCancel={() => setTransitionTarget(null)}
          onConfirm={(body) => transitionM.mutate({ id: transitionTarget.id, body })}
        />
      )}

      {eventsTarget && (
        <EventsModal
          workOrder={eventsTarget}
          onClose={() => setEventsTarget(null)}
        />
      )}
    </div>
  );
}

// ---------- Work order create/edit form ----------
function WorkOrderForm({
  organizations,
  employees,
  customers,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  employees: Employee[];
  customers: Customer[];
  editing: WorkOrder | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: WorkOrderCreate) => void;
  onSubmitUpdate: (id: number, body: WorkOrderUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkOrderFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          customer_id: editing.customer_id ? String(editing.customer_id) : "",
          work_order_code: editing.work_order_code,
          job_type: editing.job_type,
          priority: editing.priority,
          assigned_employee_id: editing.assigned_employee_id ? String(editing.assigned_employee_id) : "",
          scheduled_date: editing.scheduled_date ?? "",
          notes: editing.notes ?? "",
        }
      : {
          organization_id: "",
          customer_id: "",
          work_order_code: "",
          job_type: "installation",
          priority: "medium",
          assigned_employee_id: "",
          scheduled_date: "",
          notes: "",
        },
  });

  const onSubmit = (values: WorkOrderFormValues) => {
    const orgIdNum = Number(values.organization_id);
    if (!orgIdNum) return;

    if (values.scheduled_date && Number.isNaN(new Date(values.scheduled_date).getTime())) {
      return;
    }

    if (isEdit && editing) {
      const body: WorkOrderUpdate = {
        assigned_employee_id: values.assigned_employee_id ? Number(values.assigned_employee_id) : null,
        scheduled_date: values.scheduled_date || null,
        priority: values.priority,
        notes: values.notes || null,
      };
      onSubmitUpdate(editing.id, body);
    } else {
      const body: WorkOrderCreate = {
        organization_id: orgIdNum,
        customer_id: values.customer_id ? Number(values.customer_id) : undefined,
        work_order_code: values.work_order_code,
        job_type: values.job_type,
        priority: values.priority,
        assigned_employee_id: values.assigned_employee_id ? Number(values.assigned_employee_id) : undefined,
        scheduled_date: values.scheduled_date || undefined,
        notes: values.notes || undefined,
      };
      onSubmitCreate(body);
    }
  };

  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit work order" : "Create work order"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="work-order-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="work-order-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <Field label="Work order code" error={errors.work_order_code?.message}>
            <Input {...register("work_order_code", { required: "Work order code is required" })} disabled={isEdit} />
          </Field>
          <Field label="Job type" error={errors.job_type?.message}>
            <select className={selectClass} {...register("job_type", { required: "Job type is required" })} disabled={isEdit}>
              {JOB_TYPES.map((j) => (
                <option key={j.value} value={j.value}>{j.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority" error={errors.priority?.message}>
            <select className={selectClass} {...register("priority", { required: "Priority is required" })}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Customer" hint="Optional">
            <select className={selectClass} {...register("customer_id")} disabled={isEdit}>
              <option value="">— None —</option>
              {customers.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name} ({c.customer_code})</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned employee" hint="Optional">
            <select className={selectClass} {...register("assigned_employee_id")}>
              <option value="">— None —</option>
              {employees.map((e) => (
                <option key={e.id} value={String(e.id)}>{e.full_name} ({e.employee_code})</option>
              ))}
            </select>
          </Field>
          <Field label="Scheduled date" error={errors.scheduled_date?.message}>
            <Input type="date" {...register("scheduled_date")} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className="h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("notes")}
            spellCheck={false}
          />
        </Field>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}

// ---------- Transition modal ----------
interface TransitionFormValues {
  status: string;
  notes: string;
}

function TransitionModal({
  workOrder,
  canApprove,
  canWrite,
  submitting,
  serverError,
  onCancel,
  onConfirm,
}: {
  workOrder: WorkOrder;
  canApprove: boolean;
  canWrite: boolean;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onConfirm: (body: WorkOrderAction) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransitionFormValues>({
    defaultValues: { status: "", notes: "" },
  });

  const availableStatuses = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    if (canWrite) {
      list.push(
        { value: "assigned", label: "Assigned" },
        { value: "accepted", label: "Accepted" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      );
    }
    if (canApprove) {
      list.push({ value: "approved", label: "Approved" });
    }
    return list.filter((s) => s.value !== workOrder.status);
  }, [canWrite, canApprove, workOrder.status]);

  const onSubmit = (values: TransitionFormValues) => {
    if (!values.status) return;
    onConfirm({ status: values.status, notes: values.notes || undefined });
  };

  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Transition work order ${workOrder.work_order_code}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="transition-form" disabled={submitting}>
            {submitting ? "Saving..." : "Apply"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Current status: <Badge className={statusBadgeClass(workOrder.status)}>{workOrder.status}</Badge>
        </p>
        <form id="transition-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="New status" error={errors.status?.message}>
            <select
              className={selectClass}
              {...register("status", { required: "Select a new status" })}
            >
              <option value="">— Select —</option>
              {availableStatuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes" hint="Optional">
            <textarea
              className="h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              {...register("notes")}
              spellCheck={false}
            />
          </Field>
          <ServerError error={serverError} />
        </form>
      </div>
    </Modal>
  );
}

// ---------- Events modal ----------
function EventsModal({ workOrder, onClose }: { workOrder: WorkOrder; onClose: () => void }) {
  const eventsQ = useQuery({
    queryKey: ["work-order-events", workOrder.id],
    queryFn: () => listWorkOrderEvents({ work_order_id: workOrder.id, page: 1, page_size: 100 }),
  });
  const events: WorkOrderEvent[] = eventsQ.data?.items ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Events — ${workOrder.work_order_code}`}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {eventsQ.isLoading ? (
        <LoadingState />
      ) : eventsQ.isError ? (
        <ErrorState error={eventsQ.error} />
      ) : events.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>ID</Th>
                <Th>Event type</Th>
                <Th>Actor</Th>
                <Th>Notes</Th>
                <Th>Created at</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {events.map((ev) => (
                <Tr key={ev.id}>
                  <Td className="text-slate-400">{ev.id}</Td>
                  <Td><Badge>{ev.event_type}</Badge></Td>
                  <Td className="text-slate-500">{ev.actor_id ? `#${ev.actor_id}` : "—"}</Td>
                  <Td className="max-w-xs truncate" title={ev.notes ?? ""}>{ev.notes ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{fmtDateTime(ev.created_at)}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState text="No events recorded for this work order." />
      )}
    </Modal>
  );
}
