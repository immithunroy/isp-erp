import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import {
  listOrganizations,
  type Organization,
} from "../lib/core-api";
import {
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type LeaveTypeCreate,
  type LeaveTypeUpdate,
  actionLeaveRequest,
  createLeaveType,
  deleteLeaveType,
  listLeaveBalances,
  listLeaveRequests,
  listLeaveTypes,
  updateLeaveType,
} from "../lib/hrm-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

const PAGE_SIZE = 20;

type LeaveTab = "types" | "requests" | "balances";

export function Leave() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<LeaveTab>("types");

  const canRead = hasPermission("hrm:leave:read") || hasPermission("hrm:leave:write") || hasPermission("hrm:leave:approve");
  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader title="Leave" subtitle="Leave types, requests and balances." />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-1 border-b border-slate-200 px-3 pt-2">
          <TabButton active={tab === "types"} onClick={() => setTab("types")}>Leave Types</TabButton>
          <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>Leave Requests</TabButton>
          <TabButton active={tab === "balances"} onClick={() => setTab("balances")}>Leave Balances</TabButton>
        </div>
        <div className="p-4">
          {tab === "types" && <LeaveTypesSection />}
          {tab === "requests" && <LeaveRequestsSection />}
          {tab === "balances" && <LeaveBalancesSection />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-t border-b-2 px-3 py-2 text-sm font-medium " +
        (active ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </button>
  );
}

// ---------- Leave Types ----------
interface LeaveTypeFormValues {
  organization_id: string;
  name: string;
  code: string;
  description: string;
  default_days: string;
  is_paid: boolean;
  is_active: boolean;
}

function LeaveTypesSection() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);

  const canWrite = hasPermission("hrm:leave:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["leave-types", page, search],
    queryFn: () => listLeaveTypes({ page, page_size: PAGE_SIZE, search }),
  });

  const createM = useMutation({
    mutationFn: (b: LeaveTypeCreate) => createLeaveType(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-types"] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: LeaveTypeUpdate }) => updateLeaveType(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-types"] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteLeaveType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave-types"] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (lt: LeaveType) => {
    if (window.confirm(`Delete leave type "${lt.name}"?`)) deleteM.mutate(lt.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search leave types..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        {canWrite && <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Add type</Button>}
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
                <Th>Name</Th>
                <Th>Code</Th>
                <Th>Default days</Th>
                <Th>Paid</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((lt) => (
                <Tr key={lt.id}>
                  <Td className="text-slate-400">{lt.id}</Td>
                  <Td className="font-medium">{lt.name}</Td>
                  <Td><Badge>{lt.code}</Badge></Td>
                  <Td>{lt.default_days}</Td>
                  <Td>{lt.is_paid ? "Yes" : "No"}</Td>
                  <Td>
                    <Badge className={lt.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                      {lt.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(lt); setModalOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(lt)}>Delete</Button>
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
        <EmptyState text="No leave types found." />
      )}

      {modalOpen && (
        <LeaveTypeForm
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

function LeaveTypeForm({
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
  editing: LeaveType | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: LeaveTypeCreate) => void;
  onSubmitUpdate: (id: number, body: LeaveTypeUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LeaveTypeFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          name: editing.name,
          code: editing.code,
          description: editing.description ?? "",
          default_days: String(editing.default_days),
          is_paid: editing.is_paid,
          is_active: editing.is_active,
        }
      : { organization_id: "", name: "", code: "", description: "", default_days: "0", is_paid: true, is_active: true },
  });

  const onSubmit = (values: LeaveTypeFormValues) => {
    const orgId = Number(values.organization_id);
    if (!orgId) return;
    const body: LeaveTypeCreate = {
      organization_id: orgId,
      name: values.name,
      code: values.code,
      description: values.description || undefined,
      default_days: Number(values.default_days) || 0,
      is_paid: values.is_paid,
      is_active: values.is_active,
    };
    if (isEdit && editing) {
      const update: LeaveTypeUpdate = {
        name: values.name,
        code: values.code,
        description: values.description || null,
        default_days: Number(values.default_days) || 0,
        is_paid: values.is_paid,
        is_active: values.is_active,
      };
      onSubmitUpdate(editing.id, update);
    } else {
      onSubmitCreate(body);
    }
  };

  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit leave type" : "Create leave type"}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="leave-type-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="leave-type-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Code" error={errors.code?.message}>
            <Input {...register("code", { required: "Code is required" })} />
          </Field>
          <Field label="Default days" error={errors.default_days?.message}>
            <Input type="number" min={0} step={0.5} {...register("default_days", { required: "Required" })} />
          </Field>
          <Field label="Description">
            <Input {...register("description")} />
          </Field>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("is_paid")} /> Paid
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register("is_active")} /> Active
          </label>
        </div>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}

// ---------- Leave Requests ----------
function LeaveRequestsSection() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<LeaveRequest | null>(null);
  const [actionKind, setActionKind] = useState<"approve" | "reject">("approve");

  const typesQ = useQuery({
    queryKey: ["leave-types", "all"],
    queryFn: () => listLeaveTypes({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["leave-requests", page],
    queryFn: () => listLeaveRequests({ page, page_size: PAGE_SIZE }),
  });

  const actionM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { status: string; approver_note?: string } }) =>
      actionLeaveRequest(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave-requests"] }); setActionTarget(null); },
  });

  const canApprove = hasPermission("hrm:leave:approve");

  const typeName = new Map((typesQ.data?.items ?? []).map((t) => [t.id, t.name]));

  const openAction = (r: LeaveRequest, kind: "approve" | "reject") => {
    setActionTarget(r);
    setActionKind(kind);
  };

  return (
    <div className="space-y-3">
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
                <Th>Employee</Th>
                <Th>Type</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Reason</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((r) => (
                <Tr key={r.id}>
                  <Td className="text-slate-400">{r.id}</Td>
                  <Td>#{r.employee_id}</Td>
                  <Td>{typeName.get(r.leave_type_id) ?? `#${r.leave_type_id}`}</Td>
                  <Td className="whitespace-nowrap">{r.from_date}</Td>
                  <Td className="whitespace-nowrap">{r.to_date}</Td>
                  <Td className="max-w-xs truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</Td>
                  <Td>
                    <Badge
                      className={
                        r.status === "approved" ? "bg-green-100 text-green-700"
                        : r.status === "rejected" ? "bg-red-100 text-red-700"
                        : r.status === "cancelled" ? "bg-slate-100 text-slate-500"
                        : "bg-amber-100 text-amber-700"
                      }
                    >
                      {r.status}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {r.status === "pending" && canApprove && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openAction(r, "approve")}>Approve</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => openAction(r, "reject")}>Reject</Button>
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
        <EmptyState text="No leave requests found." />
      )}

      {actionTarget && (
        <ActionDialog
          request={actionTarget}
          kind={actionKind}
          submitting={actionM.isPending}
          serverError={actionM.error}
          onCancel={() => setActionTarget(null)}
          onConfirm={(note) =>
            actionM.mutate({
              id: actionTarget.id,
              body: { status: actionKind === "approve" ? "approved" : "rejected", approver_note: note || undefined },
            })
          }
        />
      )}
    </div>
  );
}

function ActionDialog({
  request,
  kind,
  submitting,
  serverError,
  onCancel,
  onConfirm,
}: {
  request: LeaveRequest;
  kind: "approve" | "reject";
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Modal
      open
      onClose={onCancel}
      title={kind === "approve" ? "Approve leave request" : "Reject leave request"}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button
            variant={kind === "approve" ? "primary" : "danger"}
            disabled={submitting}
            onClick={() => onConfirm(note)}
          >
            {submitting ? "Saving..." : kind === "approve" ? "Approve" : "Reject"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Request #{request.id} for employee #{request.employee_id} —
          {" "}{request.from_date} to {request.to_date}
        </p>
        <Field label="Approver note" hint="Optional">
          <textarea
            className="h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            spellCheck={false}
          />
        </Field>
        <ServerError error={serverError} />
      </div>
    </Modal>
  );
}

// ---------- Leave Balances ----------
function LeaveBalancesSection() {
  const [page, setPage] = useState(1);
  const typesQ = useQuery({
    queryKey: ["leave-types", "all"],
    queryFn: () => listLeaveTypes({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });
  const listQ = useQuery({
    queryKey: ["leave-balances", page],
    queryFn: () => listLeaveBalances({ page, page_size: PAGE_SIZE }),
  });

  const typeName = new Map((typesQ.data?.items ?? []).map((t) => [t.id, `${t.name} (${t.code})`]));

  return (
    <div className="space-y-3">
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
                <Th>Employee</Th>
                <Th>Leave type</Th>
                <Th>Year</Th>
                <Th>Allocated</Th>
                <Th>Used</Th>
                <Th>Remaining</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((b: LeaveBalance) => {
                const remaining = (b.allocated_days ?? 0) - (b.used_days ?? 0);
                return (
                  <Tr key={b.id}>
                    <Td className="text-slate-400">{b.id}</Td>
                    <Td>#{b.employee_id}</Td>
                    <Td>{typeName.get(b.leave_type_id) ?? `#${b.leave_type_id}`}</Td>
                    <Td>{b.year}</Td>
                    <Td>{b.allocated_days}</Td>
                    <Td>{b.used_days}</Td>
                    <Td>
                      <Badge className={remaining > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                        {remaining}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={listQ.data.page} pages={listQ.data.pages} total={listQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No leave balances found." />
      )}
    </div>
  );
}