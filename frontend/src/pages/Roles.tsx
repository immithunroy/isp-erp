import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../lib/auth";
import {
  type PermissionDetail,
  type RoleCreate,
  type RoleDetail,
  type RoleUpdate,
  createRole,
  deleteRole,
  updateRole,
  listPermissions,
  listRoles,
} from "../lib/core-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Spinner";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

const roleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .regex(/^[a-z0-9_:]+$/, "Lowercase letters, digits, underscore or colon"),
  description: z.string().optional(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

const PAGE_SIZE = 20;

export function Roles() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoleDetail | null>(null);

  const canRead = hasPermission("core:roles:read") || hasPermission("core:roles:write");
  const canWrite = hasPermission("core:roles:write");

  const rolesQ = useQuery({
    queryKey: ["roles", page, search],
    queryFn: () => listRoles({ page, page_size: PAGE_SIZE, search }),
    enabled: canRead,
  });

  const permsQ = useQuery({
    queryKey: ["permissions-all"],
    queryFn: () => listPermissions({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const createM = useMutation({
    mutationFn: (b: RoleCreate) => createRole(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      close();
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: RoleUpdate }) => updateRole(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      close();
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });

  const close = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const onDelete = (r: RoleDetail) => {
    if (window.confirm(`Delete role "${r.name}"?`)) deleteM.mutate(r.id);
  };

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Roles"
        subtitle="Define roles and assign permissions."
        action={canWrite ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Create role</Button> : undefined}
      />

      <Input
        placeholder="Search roles..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-xs"
      />

      {rolesQ.isLoading ? (
        <LoadingState />
      ) : rolesQ.isError ? (
        <ErrorState error={rolesQ.error} />
      ) : rolesQ.data && rolesQ.data.items.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Code</Th>
                <Th>System</Th>
                <Th>Permissions</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {rolesQ.data.items.map((r) => (
                <Tr key={r.id}>
                  <Td className="text-slate-400">{r.id}</Td>
                  <Td className="font-medium">{r.name}</Td>
                  <Td><Badge>{r.code}</Badge></Td>
                  <Td>{r.is_system ? <Badge className="bg-amber-100 text-amber-700">system</Badge> : "—"}</Td>
                  <Td>
                    {r.permissions.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span title={r.permissions.map((p) => p.code).join(", ")}>
                        {r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setModalOpen(true); }}>Edit</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 disabled:text-slate-300"
                          disabled={r.is_system}
                          title={r.is_system ? "System roles cannot be deleted" : ""}
                          onClick={() => onDelete(r)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={rolesQ.data.page} pages={rolesQ.data.pages} total={rolesQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No roles found." />
      )}

      {modalOpen && (
        <RoleForm
          permissions={permsQ.data?.items ?? []}
          loadingPermissions={permsQ.isLoading}
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

function RoleForm({
  permissions,
  loadingPermissions,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  permissions: PermissionDetail[];
  loadingPermissions: boolean;
  editing: RoleDetail | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: RoleCreate) => void;
  onSubmitUpdate: (id: number, body: RoleUpdate) => void;
}) {
  const isEdit = editing !== null;

  const [selectedPermIds, setSelectedPermIds] = useState<number[]>(
    editing ? editing.permissions.map((p) => p.id) : [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: isEdit
      ? { name: editing.name, code: editing.code, description: editing.description ?? "" }
      : { name: "", code: "", description: "" },
  });

  const togglePerm = (id: number) => {
    setSelectedPermIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const grouped = useMemo(() => {
    const m = new Map<string, PermissionDetail[]>();
    for (const p of permissions) {
      const list = m.get(p.module) ?? [];
      list.push(p);
      m.set(p.module, list);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  const onSubmit = (values: RoleFormValues) => {
    const payload = {
      name: values.name,
      code: values.code,
      description: values.description || undefined,
      permission_ids: selectedPermIds,
    };
    if (isEdit && editing) {
      onSubmitUpdate(editing.id, payload);
    } else {
      onSubmitCreate(payload);
    }
  };

  const codeReadonly = isEdit && editing.is_system;

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit role" : "Create role"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="role-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name")} />
          </Field>
          <Field label="Code" error={errors.code?.message} hint={codeReadonly ? "System role code is fixed" : undefined}>
            <Input {...register("code")} disabled={codeReadonly} />
          </Field>
        </div>
        <Field label="Description" error={errors.description?.message}>
          <Input {...register("description")} />
        </Field>

        <Field label="Permissions">
          {loadingPermissions ? (
            <Spinner />
          ) : permissions.length === 0 ? (
            <p className="text-sm text-slate-500">No permissions defined.</p>
          ) : (
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
              {grouped.map(([module, perms]) => (
                <div key={module}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {module}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedPermIds.includes(p.id)}
                          onChange={() => togglePerm(p.id)}
                        />
                        <span>
                          <span className="font-mono text-xs">{p.code}</span>
                          {p.description ? (
                            <span className="block text-xs text-slate-500">{p.description}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Field>

        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}