import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import {
  listOrganizations,
  type Organization,
} from "../lib/core-api";
import {
  type Shift,
  type ShiftCreate,
  type ShiftUpdate,
  createShift,
  deleteShift,
  listShifts,
  updateShift,
} from "../lib/hrm-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

interface ShiftFormValues {
  organization_id: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  grace_minutes: string;
  is_active: boolean;
}

const PAGE_SIZE = 20;

export function Shifts() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);

  const canRead = hasPermission("hrm:shifts:read") || hasPermission("hrm:shifts:write");
  const canWrite = hasPermission("hrm:shifts:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["shifts", page, search],
    queryFn: () => listShifts({ page, page_size: PAGE_SIZE, search }),
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: ShiftCreate) => createShift(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ShiftUpdate }) => updateShift(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteShift(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (s: Shift) => {
    if (window.confirm(`Delete shift "${s.name}"?`)) deleteM.mutate(s.id);
  };

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Shifts"
        subtitle="Work shift definitions and grace periods."
        action={canWrite ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Create shift</Button> : undefined}
      />

      <Input
        placeholder="Search shifts..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-xs"
      />

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
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Grace (min)</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((s) => (
                <Tr key={s.id}>
                  <Td className="text-slate-400">{s.id}</Td>
                  <Td className="font-medium">{s.name}</Td>
                  <Td>{s.code ? <Badge>{s.code}</Badge> : <span className="text-slate-400">—</span>}</Td>
                  <Td className="font-mono text-xs">{s.start_time}</Td>
                  <Td className="font-mono text-xs">{s.end_time}</Td>
                  <Td>{s.grace_minutes}</Td>
                  <Td>
                    <Badge className={s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setModalOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(s)}>Delete</Button>
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
        <EmptyState text="No shifts found." />
      )}

      {modalOpen && (
        <ShiftForm
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

function ShiftForm({
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
  editing: Shift | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: ShiftCreate) => void;
  onSubmitUpdate: (id: number, body: ShiftUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShiftFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          name: editing.name,
          code: editing.code ?? "",
          start_time: editing.start_time,
          end_time: editing.end_time,
          grace_minutes: String(editing.grace_minutes),
          is_active: editing.is_active,
        }
      : { organization_id: "", name: "", code: "", start_time: "09:00", end_time: "18:00", grace_minutes: "15", is_active: true },
  });

  const onSubmit = (values: ShiftFormValues) => {
    const orgId = Number(values.organization_id);
    if (!orgId) return;
    const body: ShiftCreate = {
      organization_id: orgId,
      name: values.name,
      code: values.code || undefined,
      start_time: values.start_time,
      end_time: values.end_time,
      grace_minutes: Number(values.grace_minutes) || 0,
      is_active: values.is_active,
    };
    if (isEdit && editing) {
      const update: ShiftUpdate = {
        name: values.name,
        code: values.code || null,
        start_time: values.start_time,
        end_time: values.end_time,
        grace_minutes: Number(values.grace_minutes) || 0,
        is_active: values.is_active,
      };
      onSubmitUpdate(editing.id, update);
    } else {
      onSubmitCreate(body);
    }
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit shift" : "Create shift"}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="shift-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="shift-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organization" error={errors.organization_id?.message}>
            {loadingOrgs ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
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
          <Field label="Code" hint="Optional">
            <Input {...register("code")} />
          </Field>
          <Field label="Grace minutes" error={errors.grace_minutes?.message}>
            <Input type="number" min={0} {...register("grace_minutes", { required: "Required" })} />
          </Field>
          <Field label="Start time" error={errors.start_time?.message}>
            <Input type="time" {...register("start_time", { required: "Start time is required" })} />
          </Field>
          <Field label="End time" error={errors.end_time?.message}>
            <Input type="time" {...register("end_time", { required: "End time is required" })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("is_active")} /> Active
        </label>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}