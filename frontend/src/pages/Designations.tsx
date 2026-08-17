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
  type Designation,
  type DesignationCreate,
  type DesignationUpdate,
  createDesignation,
  deleteDesignation,
  listDesignations,
  updateDesignation,
} from "../lib/hrm-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

interface DesignationFormValues {
  organization_id: string;
  department_id: string;
  name: string;
  code: string;
  grade: string;
  is_active: boolean;
}

const PAGE_SIZE = 20;

export function Designations() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);

  const canRead = hasPermission("hrm:designations:read") || hasPermission("hrm:designations:write");
  const canWrite = hasPermission("hrm:designations:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["designations", page, search],
    queryFn: () => listDesignations({ page, page_size: PAGE_SIZE, search }),
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: DesignationCreate) => createDesignation(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["designations"] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: DesignationUpdate }) => updateDesignation(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["designations"] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteDesignation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["designations"] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (d: Designation) => {
    if (window.confirm(`Delete designation "${d.name}"?`)) deleteM.mutate(d.id);
  };

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Designations"
        subtitle="Job titles and grades across departments."
        action={canWrite ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Create designation</Button> : undefined}
      />

      <Input
        placeholder="Search designations..."
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
                <Th>Grade</Th>
                <Th>Org</Th>
                <Th>Dept</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((d) => (
                <Tr key={d.id}>
                  <Td className="text-slate-400">{d.id}</Td>
                  <Td className="font-medium">{d.name}</Td>
                  <Td>{d.code ? <Badge>{d.code}</Badge> : <span className="text-slate-400">—</span>}</Td>
                  <Td>{d.grade ?? "—"}</Td>
                  <Td className="text-slate-400">{d.organization_id}</Td>
                  <Td className="text-slate-400">{d.department_id ?? "—"}</Td>
                  <Td>
                    <Badge className={d.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                      {d.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(d); setModalOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(d)}>Delete</Button>
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
        <EmptyState text="No designations found." />
      )}

      {modalOpen && (
        <DesignationForm
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

function DesignationForm({
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
  editing: Designation | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: DesignationCreate) => void;
  onSubmitUpdate: (id: number, body: DesignationUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<DesignationFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          department_id: editing.department_id ? String(editing.department_id) : "",
          name: editing.name,
          code: editing.code ?? "",
          grade: editing.grade ?? "",
          is_active: editing.is_active,
        }
      : { organization_id: "", department_id: "", name: "", code: "", grade: "", is_active: true },
  });

  const orgIdStr = watch("organization_id");
  const orgId = orgIdStr ? Number(orgIdStr) : undefined;

  const deptsQ = useQuery({
    queryKey: ["departments", orgId, "form"],
    queryFn: () => listDepartments({ organization_id: orgId as number, page: 1, page_size: 1000 }),
    enabled: !!orgId,
  });

  const departments: Department[] = useMemo(() => deptsQ.data?.items ?? [], [deptsQ.data]);

  const onSubmit = (values: DesignationFormValues) => {
    if (!orgId) return;
    const body: DesignationCreate = {
      organization_id: orgId,
      department_id: values.department_id ? Number(values.department_id) : undefined,
      name: values.name,
      code: values.code || undefined,
      grade: values.grade || undefined,
      is_active: values.is_active,
    };
    if (isEdit && editing) {
      const update: DesignationUpdate = {
        department_id: values.department_id ? Number(values.department_id) : null,
        name: values.name,
        code: values.code || null,
        grade: values.grade || null,
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
      title={isEdit ? "Edit designation" : "Create designation"}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="designation-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="designation-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <Field label="Department" hint="Optional">
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              {...register("department_id")}
              disabled={!orgId}
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name} ({d.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Code" hint="Optional">
            <Input {...register("code")} />
          </Field>
          <Field label="Grade" hint="Optional">
            <Input {...register("grade")} />
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