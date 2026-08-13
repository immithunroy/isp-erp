import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../lib/auth";
import {
  type Branch,
  type BranchCreate,
  type BranchUpdate,
  type Department,
  type DepartmentCreate,
  type DepartmentUpdate,
  type Organization,
  type OrganizationCreate,
  type OrganizationUpdate,
  createBranch,
  createDepartment,
  createOrganization,
  deleteBranch,
  deleteDepartment,
  deleteOrganization,
  listBranches,
  listDepartments,
  listOrganizations,
  updateBranch,
  updateDepartment,
  updateOrganization,
} from "../lib/core-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

const orgSchema = z.object({
  name: z.string().min(1, "Name is required"),
  legal_name: z.string().optional(),
  code: z.string().min(1, "Code is required"),
  address: z.string().optional(),
  contact_email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  is_active: z.boolean().default(true),
});
type OrgFormValues = z.infer<typeof orgSchema>;

const branchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  address: z.string().optional(),
  is_active: z.boolean().default(true),
});
type BranchFormValues = z.infer<typeof branchSchema>;

const departmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  branch_id: z.string().optional().or(z.literal("")),
  parent_id: z.string().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});
type DeptFormValues = z.infer<typeof departmentSchema>;

const PAGE_SIZE = 20;

type OrgTab = "branches" | "departments";

export function Organizations() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [tab, setTab] = useState<OrgTab>("branches");

  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  const canRead = hasPermission("core:organizations:read") || hasPermission("core:organizations:write");
  const canWrite = hasPermission("core:organizations:write");

  const orgsQ = useQuery({
    queryKey: ["organizations", page, search],
    queryFn: () => listOrganizations({ page, page_size: PAGE_SIZE, search }),
    enabled: canRead,
  });

  const createOrgM = useMutation({
    mutationFn: (b: OrganizationCreate) => createOrganization(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["organizations"] }); closeOrg(); },
  });
  const updateOrgM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: OrganizationUpdate }) => updateOrganization(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["organizations"] }); closeOrg(); },
  });
  const deleteOrgM = useMutation({
    mutationFn: (id: number) => deleteOrganization(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });

  const closeOrg = () => { setOrgModalOpen(false); setEditingOrg(null); };
  const onDeleteOrg = (o: Organization) => {
    if (window.confirm(`Delete organization "${o.name}"? Branches and departments may be affected.`)) {
      deleteOrgM.mutate(o.id);
      if (selectedOrgId === o.id) setSelectedOrgId(null);
    }
  };

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Organizations"
        subtitle="Manage organizations, branches and departments."
        action={canWrite ? <Button onClick={() => { setEditingOrg(null); setOrgModalOpen(true); }}>Create organization</Button> : undefined}
      />

      <Input
        placeholder="Search organizations..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-xs"
      />

      {orgsQ.isLoading ? (
        <LoadingState />
      ) : orgsQ.isError ? (
        <ErrorState error={orgsQ.error} />
      ) : orgsQ.data && orgsQ.data.items.length > 0 ? (
        <>
          <div className="space-y-2">
            <Table>
              <TableHead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Name</Th>
                  <Th>Code</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </TableHead>
              <TableBody>
                {orgsQ.data.items.map((o) => (
                  <Tr
                    key={o.id}
                    className={selectedOrgId === o.id ? "bg-brand/5" : undefined}
                  >
                    <Td className="text-slate-400">{o.id}</Td>
                    <Td>
                      <button
                        type="button"
                        className="font-medium text-brand hover:underline"
                        onClick={() => setSelectedOrgId(o.id === selectedOrgId ? null : o.id)}
                      >
                        {o.name}
                        {o.legal_name ? <span className="ml-1 text-slate-400">({o.legal_name})</span> : null}
                      </button>
                    </Td>
                    <Td><Badge>{o.code}</Badge></Td>
                    <Td>{o.contact_email ?? "—"}</Td>
                    <Td>{o.contact_phone ?? "—"}</Td>
                    <Td>
                      <Badge className={o.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                        {o.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      {canWrite && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingOrg(o); setOrgModalOpen(true); }}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDeleteOrg(o)}>Delete</Button>
                        </>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TableBody>
            </Table>
            <Pagination page={orgsQ.data.page} pages={orgsQ.data.pages} total={orgsQ.data.total} onPage={setPage} />
          </div>

          {selectedOrgId && (
            <OrgChildren
              orgId={selectedOrgId}
              canWrite={canWrite}
              tab={tab}
              setTab={setTab}
            />
          )}
        </>
      ) : (
        <EmptyState text="No organizations found." />
      )}

      {orgModalOpen && (
        <OrgForm
          editing={editingOrg}
          submitting={createOrgM.isPending || updateOrgM.isPending}
          serverError={createOrgM.error ?? updateOrgM.error}
          onCancel={closeOrg}
          onSubmitCreate={(b) => createOrgM.mutate(b)}
          onSubmitUpdate={(id, b) => updateOrgM.mutate({ id, body: b })}
        />
      )}
    </div>
  );
}

function OrgForm({
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  editing: Organization | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: OrganizationCreate) => void;
  onSubmitUpdate: (id: number, body: OrganizationUpdate) => void;
}) {
  const isEdit = editing !== null;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgFormValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: isEdit
      ? {
          name: editing.name,
          legal_name: editing.legal_name ?? "",
          code: editing.code,
          address: editing.address ?? "",
          contact_email: editing.contact_email ?? "",
          contact_phone: editing.contact_phone ?? "",
          is_active: editing.is_active,
        }
      : { name: "", legal_name: "", code: "", address: "", contact_email: "", contact_phone: "", is_active: true },
  });

  const onSubmit = (values: OrgFormValues) => {
    const body: OrganizationCreate = {
      name: values.name,
      legal_name: values.legal_name || undefined,
      code: values.code,
      address: values.address || undefined,
      contact_email: values.contact_email || undefined,
      contact_phone: values.contact_phone || undefined,
      is_active: values.is_active,
    };
    if (isEdit && editing) onSubmitUpdate(editing.id, body);
    else onSubmitCreate(body);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit organization" : "Create organization"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="org-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="org-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name")} />
          </Field>
          <Field label="Legal name" error={errors.legal_name?.message}>
            <Input {...register("legal_name")} />
          </Field>
          <Field label="Code" error={errors.code?.message}>
            <Input {...register("code")} />
          </Field>
          <Field label="Contact email" error={errors.contact_email?.message}>
            <Input type="email" {...register("contact_email")} />
          </Field>
          <Field label="Contact phone" error={errors.contact_phone?.message}>
            <Input {...register("contact_phone")} />
          </Field>
          <Field label="Address" error={errors.address?.message}>
            <Input {...register("address")} />
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

// ---------- Branches & Departments for selected org ----------
function OrgChildren({
  orgId,
  canWrite,
  tab,
  setTab,
}: {
  orgId: number;
  canWrite: boolean;
  tab: OrgTab;
  setTab: (t: OrgTab) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-1 border-b border-slate-200 px-3 pt-2">
        <TabButton active={tab === "branches"} onClick={() => setTab("branches")}>Branches</TabButton>
        <TabButton active={tab === "departments"} onClick={() => setTab("departments")}>Departments</TabButton>
      </div>
      <div className="p-4">
        {tab === "branches" ? (
          <BranchesSection orgId={orgId} canWrite={canWrite} />
        ) : (
          <DepartmentsSection orgId={orgId} canWrite={canWrite} />
        )}
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

function BranchesSection({ orgId, canWrite }: { orgId: number; canWrite: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  const listQ = useQuery({
    queryKey: ["branches", orgId, page],
    queryFn: () => listBranches({ organization_id: orgId, page, page_size: PAGE_SIZE }),
  });

  const createM = useMutation({
    mutationFn: (b: BranchCreate) => createBranch(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches", orgId] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: BranchUpdate }) => updateBranch(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches", orgId] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteBranch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches", orgId] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (b: Branch) => {
    if (window.confirm(`Delete branch "${b.name}"?`)) deleteM.mutate(b.id);
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: "", code: "", address: "", is_active: true },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: "", code: "", address: "", is_active: true });
    setModalOpen(true);
  };
  const openEdit = (b: Branch) => {
    setEditing(b);
    reset({ name: b.name, code: b.code, address: b.address ?? "", is_active: b.is_active });
    setModalOpen(true);
  };

  const onSubmit = (values: BranchFormValues) => {
    const body: BranchCreate = {
      organization_id: orgId,
      name: values.name,
      code: values.code,
      address: values.address || undefined,
      is_active: values.is_active,
    };
    if (editing) updateM.mutate({ id: editing.id, body });
    else createM.mutate(body);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold text-slate-600">Branches for organization #{orgId}</h3>
        {canWrite && <Button size="sm" onClick={openCreate}>Add branch</Button>}
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
                <Th>Address</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((b) => (
                <Tr key={b.id}>
                  <Td className="text-slate-400">{b.id}</Td>
                  <Td className="font-medium">{b.name}</Td>
                  <Td><Badge>{b.code}</Badge></Td>
                  <Td>{b.address ?? "—"}</Td>
                  <Td>
                    <Badge className={b.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                      {b.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(b)}>Delete</Button>
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
        <EmptyState text="No branches for this organization." />
      )}

      {modalOpen && (
        <Modal
          open
          onClose={close}
          title={editing ? "Edit branch" : "Add branch"}
          footer={
            <>
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button type="submit" form="branch-form" disabled={createM.isPending || updateM.isPending}>
                {createM.isPending || updateM.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          }
        >
          <form id="branch-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Name" error={errors.name?.message}>
              <Input {...register("name")} />
            </Field>
            <Field label="Code" error={errors.code?.message}>
              <Input {...register("code")} />
            </Field>
            <Field label="Address" error={errors.address?.message}>
              <Input {...register("address")} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("is_active")} /> Active
            </label>
            <ServerError error={createM.error ?? updateM.error} />
          </form>
        </Modal>
      )}
    </div>
  );
}

function DepartmentsSection({ orgId, canWrite }: { orgId: number; canWrite: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const branchesQ = useQuery({
    queryKey: ["branches", orgId, "all"],
    queryFn: () => listBranches({ organization_id: orgId, page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const deptsQ = useQuery({
    queryKey: ["departments", orgId, page],
    queryFn: () => listDepartments({ organization_id: orgId, page, page_size: PAGE_SIZE }),
    enabled: !!branchesQ.data,
  });

  const createM = useMutation({
    mutationFn: (b: DepartmentCreate) => createDepartment(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments", orgId] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: DepartmentUpdate }) => updateDepartment(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments", orgId] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteDepartment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments", orgId] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (d: Department) => {
    if (window.confirm(`Delete department "${d.name}"?`)) deleteM.mutate(d.id);
  };

  const branches = useMemo(() => branchesQ.data?.items ?? [], [branchesQ.data]);
  const allDepts = useMemo(() => deptsQ.data?.items ?? [], [deptsQ.data]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeptFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "", code: "", branch_id: "", parent_id: "", is_active: true },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: "", code: "", branch_id: "", parent_id: "", is_active: true });
    setModalOpen(true);
  };
  const openEdit = (d: Department) => {
    setEditing(d);
    reset({
      name: d.name,
      code: d.code,
      branch_id: d.branch_id ? String(d.branch_id) : "",
      parent_id: d.parent_id ? String(d.parent_id) : "",
      is_active: d.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = (values: DeptFormValues) => {
    const toNum = (v: string | undefined): number | undefined => (v && v.trim() !== "" ? Number(v) : undefined);
    const body: DepartmentCreate = {
      organization_id: orgId,
      name: values.name,
      code: values.code,
      branch_id: toNum(values.branch_id),
      parent_id: toNum(values.parent_id),
      is_active: values.is_active,
    };
    if (editing) updateM.mutate({ id: editing.id, body });
    else createM.mutate(body);
  };

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);
  const deptName = useMemo(() => new Map(allDepts.map((d) => [d.id, d.name])), [allDepts]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold text-slate-600">Departments for organization #{orgId}</h3>
        {canWrite && <Button size="sm" onClick={openCreate}>Add department</Button>}
      </div>

      {deptsQ.isLoading ? (
        <LoadingState />
      ) : deptsQ.isError ? (
        <ErrorState error={deptsQ.error} />
      ) : deptsQ.data && deptsQ.data.items.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Code</Th>
                <Th>Branch</Th>
                <Th>Parent</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {deptsQ.data.items.map((d) => (
                <Tr key={d.id}>
                  <Td className="text-slate-400">{d.id}</Td>
                  <Td className="font-medium">{d.name}</Td>
                  <Td><Badge>{d.code}</Badge></Td>
                  <Td>{(d.branch_id && branchName.get(d.branch_id)) ?? (d.branch_id ? `#${d.branch_id}` : "—")}</Td>
                  <Td>{(d.parent_id && deptName.get(d.parent_id)) ?? (d.parent_id ? `#${d.parent_id}` : "—")}</Td>
                  <Td>
                    <Badge className={d.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                      {d.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(d)}>Delete</Button>
                      </>
                    )}
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={deptsQ.data.page} pages={deptsQ.data.pages} total={deptsQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No departments for this organization." />
      )}

      {modalOpen && (
        <Modal
          open
          onClose={close}
          title={editing ? "Edit department" : "Add department"}
          footer={
            <>
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button type="submit" form="dept-form" disabled={createM.isPending || updateM.isPending}>
                {createM.isPending || updateM.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          }
        >
          <form id="dept-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" error={errors.name?.message}>
                <Input {...register("name")} />
              </Field>
              <Field label="Code" error={errors.code?.message}>
                <Input {...register("code")} />
              </Field>
              <Field label="Branch" error={errors.branch_id?.message} hint="Optional">
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  {...register("branch_id")}
                >
                  <option value="">— None —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={String(b.id)}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </Field>
              <Field label="Parent department" error={errors.parent_id?.message} hint="Optional">
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  {...register("parent_id")}
                  disabled={editing !== null}
                >
                  <option value="">— None —</option>
                  {allDepts.filter((d) => d.id !== editing?.id).map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("is_active")} /> Active
            </label>
            <ServerError error={createM.error ?? updateM.error} />
          </form>
        </Modal>
      )}
    </div>
  );
}