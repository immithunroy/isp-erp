import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import {
  listBranches,
  listOrganizations,
  type Branch,
  type Organization,
} from "../lib/core-api";
import {
  type Holiday,
  type HolidayCreate,
  type HolidayUpdate,
  createHoliday,
  deleteHoliday,
  listHolidays,
  updateHoliday,
} from "../lib/hrm-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

interface HolidayFormValues {
  organization_id: string;
  branch_id: string;
  name: string;
  description: string;
  date: string;
  is_recurring: boolean;
  scope: string;
}

interface HolidayFilters {
  organization_id: string;
  year: string;
}

const PAGE_SIZE = 20;

export function Holidays() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<HolidayFilters>({ organization_id: "", year: "" });
  const [committed, setCommitted] = useState<HolidayFilters>({ organization_id: "", year: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);

  const canRead = hasPermission("hrm:holidays:read") || hasPermission("hrm:holidays:write");
  const canWrite = hasPermission("hrm:holidays:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["holidays", page, search, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = { page, page_size: PAGE_SIZE, search };
      if (committed.organization_id) p.organization_id = Number(committed.organization_id);
      if (committed.year) p.year = Number(committed.year);
      return listHolidays(p);
    },
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: HolidayCreate) => createHoliday(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["holidays"] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: HolidayUpdate }) => updateHoliday(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["holidays"] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteHoliday(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holidays"] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (h: Holiday) => {
    if (window.confirm(`Delete holiday "${h.name}"?`)) deleteM.mutate(h.id);
  };

  const applyFilters = () => { setCommitted(filters); setPage(1); };
  const resetFilters = () => {
    const empty = { organization_id: "", year: "" };
    setFilters(empty);
    setCommitted(empty);
    setPage(1);
  };

  const orgName = useMemo(() => new Map((orgsQ.data?.items ?? []).map((o) => [o.id, o.name])), [orgsQ.data]);

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Holidays"
        subtitle="Organization and branch holidays."
        action={canWrite ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Create holiday</Button> : undefined}
      />

      <Input
        placeholder="Search holidays..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-xs"
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Organization</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.organization_id}
              onChange={(e) => setFilters({ ...filters, organization_id: e.target.value })}
            >
              <option value="">— All —</option>
              {(orgsQ.data?.items ?? []).map((o) => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Year</label>
            <Input
              type="number"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="h-9"
              placeholder="e.g. 2026"
            />
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
                <Th>Date</Th>
                <Th>Name</Th>
                <Th>Scope</Th>
                <Th>Recurring</Th>
                <Th>Org</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((h) => (
                <Tr key={h.id}>
                  <Td className="text-slate-400">{h.id}</Td>
                  <Td className="whitespace-nowrap">{h.date}</Td>
                  <Td className="font-medium">{h.name}</Td>
                  <Td><Badge>{h.scope}</Badge></Td>
                  <Td>{h.is_recurring ? "Yes" : "No"}</Td>
                  <Td className="text-slate-500">{orgName.get(h.organization_id) ?? `#${h.organization_id}`}</Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(h); setModalOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(h)}>Delete</Button>
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
        <EmptyState text="No holidays found." />
      )}

      {modalOpen && (
        <HolidayForm
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

function HolidayForm({
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
  editing: Holiday | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: HolidayCreate) => void;
  onSubmitUpdate: (id: number, body: HolidayUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<HolidayFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          branch_id: editing.branch_id ? String(editing.branch_id) : "",
          name: editing.name,
          description: editing.description ?? "",
          date: editing.date,
          is_recurring: editing.is_recurring,
          scope: editing.scope,
        }
      : { organization_id: "", branch_id: "", name: "", description: "", date: "", is_recurring: false, scope: "organization" },
  });

  const orgIdStr = watch("organization_id");
  const orgId = orgIdStr ? Number(orgIdStr) : undefined;
  const scope = watch("scope");

  const branchesQ = useQuery({
    queryKey: ["branches", orgId, "form"],
    queryFn: () => listBranches({ organization_id: orgId as number, page: 1, page_size: 1000 }),
    enabled: !!orgId,
  });

  const branches: Branch[] = branchesQ.data?.items ?? [];

  const onSubmit = (values: HolidayFormValues) => {
    const orgIdNum = Number(values.organization_id);
    if (!orgIdNum) return;
    const body: HolidayCreate = {
      organization_id: orgIdNum,
      branch_id: values.branch_id ? Number(values.branch_id) : undefined,
      name: values.name,
      description: values.description || undefined,
      date: values.date,
      is_recurring: values.is_recurring,
      scope: values.scope,
    };
    if (isEdit && editing) {
      const update: HolidayUpdate = {
        branch_id: values.branch_id ? Number(values.branch_id) : null,
        name: values.name,
        description: values.description || null,
        date: values.date,
        is_recurring: values.is_recurring,
        scope: values.scope,
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
      title={isEdit ? "Edit holiday" : "Create holiday"}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="holiday-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="holiday-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <Field label="Branch" hint={scope === "branch" ? "Required for branch scope" : "Optional"}>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              {...register("branch_id")}
              disabled={!orgId}
            >
              <option value="">— None (org-wide) —</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name} ({b.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Date" error={errors.date?.message}>
            <Input type="date" {...register("date", { required: "Date is required" })} />
          </Field>
          <Field label="Scope">
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              {...register("scope")}
            >
              <option value="organization">Organization</option>
              <option value="branch">Branch</option>
            </select>
          </Field>
          <Field label="Description" hint="Optional">
            <Input {...register("description")} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("is_recurring")} /> Recurring (same date every year)
        </label>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}