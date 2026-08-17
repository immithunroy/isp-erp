import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import {
  createFiberCable,
  createSplice,
  deleteFiberCable,
  deleteFiberCore,
  deleteSplice,
  listFiberCables,
  listFiberCores,
  listNetworkAssets,
  listSplices,
  updateFiberCable,
  updateFiberCore,
  type FiberCable,
  type FiberCableCreate,
  type FiberCableUpdate,
  type FiberCore,
  type FiberCoreUpdate,
  type NetworkAsset,
  type Splice,
  type SpliceCreate,
} from "../lib/network-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  NoAccess,
  PageHeader,
  ServerError,
} from "../components/ui";

const PAGE_SIZE = 20;

const CABLE_TYPES: { value: string; label: string }[] = [
  { value: "underground", label: "Underground" },
  { value: "aerial", label: "Aerial" },
  { value: "direct_buried", label: "Direct Buried" },
  { value: "indoor", label: "Indoor" },
  { value: "other", label: "Other" },
];

const CABLE_STATUSES: { value: string; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "maintenance", label: "Maintenance" },
  { value: "faulty", label: "Faulty" },
  { value: "decommissioned", label: "Decommissioned" },
];

const CORE_STATUSES: { value: string; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "in_use", label: "In Use" },
  { value: "faulty", label: "Faulty" },
  { value: "dark", label: "Dark" },
  { value: "spliced", label: "Spliced" },
  { value: "retired", label: "Retired" },
];

function coreStatusBadgeClass(status: string): string {
  switch (status) {
    case "available":
      return "bg-green-100 text-green-700";
    case "reserved":
      return "bg-blue-100 text-blue-700";
    case "in_use":
      return "bg-amber-100 text-amber-700";
    case "faulty":
      return "bg-red-100 text-red-700";
    case "dark":
      return "bg-slate-200 text-slate-700";
    case "spliced":
      return "bg-purple-100 text-purple-700";
    case "retired":
      return "bg-slate-300 text-slate-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

type Tab = "cables" | "cores" | "splices";

export function FiberManagement() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>("cables");

  const canRead =
    hasPermission("network:fiber:read") || hasPermission("network:fiber:write");
  const canWrite = hasPermission("network:fiber:write");

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Fiber Management"
        subtitle="Manage fiber cables, cores and splices."
      />

      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { key: "cables", label: "Fiber Cables" },
            { key: "cores", label: "Fiber Cores" },
            { key: "splices", label: "Splices" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              "border-b-2 px-4 py-2 text-sm font-medium " +
              (tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cables" && <CablesTab canWrite={canWrite} />}
      {tab === "cores" && <CoresTab canWrite={canWrite} />}
      {tab === "splices" && <SplicesTab canWrite={canWrite} />}
    </div>
  );
}

// ----------------- Cables tab -----------------
interface CableFormValues {
  organization_id: string;
  cable_code: string;
  name: string;
  cable_type: string;
  core_count: string;
  start_asset_id: string;
  end_asset_id: string;
  installed_at: string;
  status: string;
  owner: string;
  notes: string;
}

function CablesTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FiberCable | null>(null);

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });
  const assetsQ = useQuery({
    queryKey: ["network-assets", "all"],
    queryFn: () => listNetworkAssets({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["fiber-cables", page, search],
    queryFn: () =>
      listFiberCables({ page, page_size: PAGE_SIZE, search }),
    enabled: true,
  });

  const createM = useMutation({
    mutationFn: (b: FiberCableCreate) => createFiberCable(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiber-cables"] });
      qc.invalidateQueries({ queryKey: ["network-map-cables"] });
      close();
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: FiberCableUpdate }) =>
      updateFiberCable(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiber-cables"] });
      qc.invalidateQueries({ queryKey: ["network-map-cables"] });
      close();
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteFiberCable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiber-cables"] });
      qc.invalidateQueries({ queryKey: ["network-map-cables"] });
    },
  });

  const close = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const onDelete = (c: FiberCable) => {
    if (window.confirm(`Delete cable "${c.name}" (${c.cable_code})?`))
      deleteM.mutate(c.id);
  };

  const assetLabel = useMemo(
    () =>
      new Map(
        (assetsQ.data?.items ?? []).map((a) => [a.id, `${a.asset_code} · ${a.name}`]),
      ),
    [assetsQ.data],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search by cable code or name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        {canWrite && (
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Create cable
          </Button>
        )}
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
                <Th>Type</Th>
                <Th>Cores</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Status</Th>
                <Th>Installed</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((c) => (
                <Tr key={c.id}>
                  <Td className="text-slate-400">{c.id}</Td>
                  <Td className="font-mono text-xs">{c.cable_code}</Td>
                  <Td className="font-medium">{c.name}</Td>
                  <Td>{c.cable_type ?? "—"}</Td>
                  <Td>{c.core_count}</Td>
                  <Td className="text-slate-500">
                    {c.start_asset_id
                      ? assetLabel.get(c.start_asset_id) ?? `#${c.start_asset_id}`
                      : "—"}
                  </Td>
                  <Td className="text-slate-500">
                    {c.end_asset_id
                      ? assetLabel.get(c.end_asset_id) ?? `#${c.end_asset_id}`
                      : "—"}
                  </Td>
                  <Td>
                    <Badge>{c.status}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {fmtDate(c.installed_at)}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => onDelete(c)}
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
          <Pagination
            page={listQ.data.page}
            pages={listQ.data.pages}
            total={listQ.data.total}
            onPage={setPage}
          />
        </div>
      ) : (
        <EmptyState text="No fiber cables found." />
      )}

      {modalOpen && (
        <CableForm
          organizations={orgsQ.data?.items ?? []}
          assets={assetsQ.data?.items ?? []}
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

function CableForm({
  organizations,
  assets,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  assets: NetworkAsset[];
  editing: FiberCable | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: FiberCableCreate) => void;
  onSubmitUpdate: (id: number, body: FiberCableUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CableFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          cable_code: editing.cable_code,
          name: editing.name,
          cable_type: editing.cable_type ?? "",
          core_count: String(editing.core_count),
          start_asset_id: editing.start_asset_id ? String(editing.start_asset_id) : "",
          end_asset_id: editing.end_asset_id ? String(editing.end_asset_id) : "",
          installed_at: editing.installed_at ?? "",
          status: editing.status,
          owner: editing.owner ?? "",
          notes: editing.notes ?? "",
        }
      : {
          organization_id: "",
          cable_code: "",
          name: "",
          cable_type: "",
          core_count: "12",
          start_asset_id: "",
          end_asset_id: "",
          installed_at: "",
          status: "planned",
          owner: "",
          notes: "",
        },
  });

  const onSubmit = (values: CableFormValues) => {
    const organization_id = Number(values.organization_id);
    if (!organization_id) return;
    const core_count = Number(values.core_count);
    if (!core_count || Number.isNaN(core_count)) return;

    if (isEdit && editing) {
      const body: FiberCableUpdate = {
        name: values.name,
        cable_type: values.cable_type || null,
        status: values.status,
        notes: values.notes || null,
      };
      onSubmitUpdate(editing.id, body);
    } else {
      const body: FiberCableCreate = {
        organization_id,
        cable_code: values.cable_code,
        name: values.name,
        cable_type: values.cable_type || undefined,
        core_count,
        start_asset_id: values.start_asset_id
          ? Number(values.start_asset_id)
          : undefined,
        end_asset_id: values.end_asset_id ? Number(values.end_asset_id) : undefined,
        installed_at: values.installed_at || undefined,
        status: values.status,
        owner: values.owner || undefined,
        notes: values.notes || undefined,
      };
      onSubmitCreate(body);
    }
  };

  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit fiber cable" : "Create fiber cable"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="cable-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form
        id="cable-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organization" error={errors.organization_id?.message}>
            <select
              className={selectClass}
              {...register("organization_id", {
                required: "Organization is required",
              })}
              disabled={isEdit}
            >
              <option value="">— Select —</option>
              {organizations.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cable code" error={errors.cable_code?.message}>
            <Input
              {...register("cable_code", { required: "Cable code is required" })}
              disabled={isEdit}
            />
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Core count" error={errors.core_count?.message}>
            <Input
              type="number"
              min={1}
              {...register("core_count", { required: "Core count is required" })}
              disabled={isEdit}
            />
          </Field>
          <Field label="Cable type" hint="Optional">
            <select className={selectClass} {...register("cable_type")} disabled={isEdit}>
              <option value="">— None —</option>
              {CABLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <select className={selectClass} {...register("status")}>
              {CABLE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start asset" hint="Optional">
            <select className={selectClass} {...register("start_asset_id")} disabled={isEdit}>
              <option value="">— None —</option>
              {assets.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.asset_code} · {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="End asset" hint="Optional">
            <select className={selectClass} {...register("end_asset_id")} disabled={isEdit}>
              <option value="">— None —</option>
              {assets.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.asset_code} · {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Installed date" hint="Optional">
            <Input type="date" {...register("installed_at")} disabled={isEdit} />
          </Field>
          <Field label="Owner" hint="Optional">
            <Input {...register("owner")} disabled={isEdit} />
          </Field>
        </div>
        <Field label="Notes" hint="Optional">
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

// ----------------- Cores tab -----------------
function CoresTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [selectedCableId, setSelectedCableId] = useState<string>("");
  const [page, setPage] = useState(1);

  const cablesQ = useQuery({
    queryKey: ["fiber-cables", "all"],
    queryFn: () => listFiberCables({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const coresQ = useQuery({
    queryKey: ["fiber-cores", selectedCableId, page],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = {
        page,
        page_size: PAGE_SIZE,
      };
      if (selectedCableId) p.cable_id = Number(selectedCableId);
      return listFiberCores(p);
    },
    enabled: true,
  });

  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: FiberCoreUpdate }) =>
      updateFiberCore(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiber-cores"] }),
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteFiberCore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiber-cores"] }),
  });

  const cableMap = useMemo(
    () => new Map((cablesQ.data?.items ?? []).map((c) => [c.id, c])),
    [cablesQ.data],
  );

  const onStatusChange = (core: FiberCore, status: string) => {
    updateM.mutate({ id: core.id, body: { status } });
  };
  const onDelete = (core: FiberCore) => {
    if (window.confirm(`Delete core #${core.core_number} (id ${core.id})?`))
      deleteM.mutate(core.id);
  };

  const selectClass =
    "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="w-72 space-y-1">
          <label className="text-xs font-medium text-slate-500">Cable</label>
          <select
            className={selectClass}
            value={selectedCableId}
            onChange={(e) => {
              setSelectedCableId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">— All cables —</option>
            {(cablesQ.data?.items ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.cable_code} · {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {coresQ.isLoading ? (
        <LoadingState />
      ) : coresQ.isError ? (
        <ErrorState error={coresQ.error} />
      ) : coresQ.data && coresQ.data.items.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>ID</Th>
                <Th>Cable</Th>
                <Th>Core #</Th>
                <Th>Color</Th>
                <Th>Status</Th>
                <Th>Source</Th>
                <Th>Destination</Th>
                <Th>Customer</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {coresQ.data.items.map((core) => {
                const cable = cableMap.get(core.cable_id);
                return (
                  <Tr key={core.id}>
                    <Td className="text-slate-400">{core.id}</Td>
                    <Td className="text-slate-500">
                      {cable
                        ? `${cable.cable_code}`
                        : `#${core.cable_id}`}
                    </Td>
                    <Td className="font-mono text-xs">{core.core_number}</Td>
                    <Td>{core.color ?? "—"}</Td>
                    <Td>
                      {canWrite ? (
                        <select
                          className={selectClass + " w-32"}
                          value={core.status}
                          onChange={(e) => onStatusChange(core, e.target.value)}
                          disabled={updateM.isPending}
                        >
                          {CORE_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge className={coreStatusBadgeClass(core.status)}>
                          {core.status}
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-slate-500">
                      {core.source_asset_id ?? "—"}
                    </Td>
                    <Td className="text-slate-500">
                      {core.destination_asset_id ?? "—"}
                    </Td>
                    <Td className="text-slate-500">
                      {core.related_customer_id ?? "—"}
                    </Td>
                    <Td className="text-right">
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => onDelete(core)}
                        >
                          Delete
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            page={coresQ.data.page}
            pages={coresQ.data.pages}
            total={coresQ.data.total}
            onPage={setPage}
          />
        </div>
      ) : (
        <EmptyState text="No fiber cores found. Select a cable to view its cores." />
      )}
    </div>
  );
}

// ----------------- Splices tab -----------------
interface SpliceFormValues {
  enclosure_asset_id: string;
  source_cable_id: string;
  source_core_id: string;
  destination_cable_id: string;
  destination_core_id: string;
  splice_loss: string;
  technician_id: string;
  notes: string;
}

function SplicesTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const cablesQ = useQuery({
    queryKey: ["fiber-cables", "all"],
    queryFn: () => listFiberCables({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });
  const assetsQ = useQuery({
    queryKey: ["network-assets", "all"],
    queryFn: () => listNetworkAssets({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["splices", page],
    queryFn: () => listSplices({ page, page_size: PAGE_SIZE }),
  });

  const createM = useMutation({
    mutationFn: (b: SpliceCreate) => createSplice(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["splices"] });
      setModalOpen(false);
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteSplice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["splices"] }),
  });

  const onDelete = (s: Splice) => {
    if (window.confirm(`Delete splice #${s.id}?`)) deleteM.mutate(s.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        {canWrite && (
          <Button onClick={() => setModalOpen(true)}>Create splice</Button>
        )}
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
                <Th>Enclosure</Th>
                <Th>Source core</Th>
                <Th>Destination core</Th>
                <Th>Loss (dB)</Th>
                <Th>Technician</Th>
                <Th>Spliced at</Th>
                <Th>Notes</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((s) => (
                <Tr key={s.id}>
                  <Td className="text-slate-400">{s.id}</Td>
                  <Td className="text-slate-500">
                    {s.enclosure_asset_id ?? "—"}
                  </Td>
                  <Td className="font-mono text-xs">{s.source_core_id}</Td>
                  <Td className="font-mono text-xs">{s.destination_core_id}</Td>
                  <Td>{s.splice_loss ?? "—"}</Td>
                  <Td className="text-slate-500">{s.technician_id ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {fmtDate(s.spliced_at)}
                  </Td>
                  <Td className="max-w-xs truncate" title={s.notes ?? ""}>
                    {s.notes ?? "—"}
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => onDelete(s)}
                      >
                        Delete
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={listQ.data.page}
            pages={listQ.data.pages}
            total={listQ.data.total}
            onPage={setPage}
          />
        </div>
      ) : (
        <EmptyState text="No splices recorded." />
      )}

      {modalOpen && (
        <SpliceForm
          cables={cablesQ.data?.items ?? []}
          enclosures={assetsQ.data?.items ?? []}
          submitting={createM.isPending}
          serverError={createM.error}
          onCancel={() => setModalOpen(false)}
          onSubmit={(body) => createM.mutate(body)}
        />
      )}
    </div>
  );
}

function SpliceForm({
  cables,
  enclosures,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  cables: FiberCable[];
  enclosures: NetworkAsset[];
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: SpliceCreate) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SpliceFormValues>({
    defaultValues: {
      enclosure_asset_id: "",
      source_cable_id: "",
      source_core_id: "",
      destination_cable_id: "",
      destination_core_id: "",
      splice_loss: "",
      technician_id: "",
      notes: "",
    },
  });

  const sourceCableId = watch("source_cable_id");
  const destCableId = watch("destination_cable_id");

  const sourceCoresQ = useQuery({
    queryKey: ["fiber-cores", "cable", sourceCableId],
    queryFn: () =>
      listFiberCores({ cable_id: Number(sourceCableId), page: 1, page_size: 1000 }),
    enabled: !!sourceCableId,
  });
  const destCoresQ = useQuery({
    queryKey: ["fiber-cores", "cable", destCableId],
    queryFn: () =>
      listFiberCores({ cable_id: Number(destCableId), page: 1, page_size: 1000 }),
    enabled: !!destCableId,
  });

  const onSubmitValues = (values: SpliceFormValues) => {
    const source_core_id = Number(values.source_core_id);
    const destination_core_id = Number(values.destination_core_id);
    if (!source_core_id || !destination_core_id) return;
    const body: SpliceCreate = {
      enclosure_asset_id: values.enclosure_asset_id
        ? Number(values.enclosure_asset_id)
        : undefined,
      source_core_id,
      destination_core_id,
      splice_loss: values.splice_loss ? Number(values.splice_loss) : undefined,
      technician_id: values.technician_id
        ? Number(values.technician_id)
        : undefined,
      notes: values.notes || undefined,
    };
    onSubmit(body);
  };

  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";
  const enclosureOptions = enclosures.filter(
    (a) => a.asset_type === "enclosure" || a.asset_type === "odf",
  );

  return (
    <Modal
      open
      onClose={onCancel}
      title="Create splice"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="splice-form" disabled={submitting}>
            {submitting ? "Saving..." : "Create"}
          </Button>
        </>
      }
    >
      <form
        id="splice-form"
        onSubmit={handleSubmit(onSubmitValues)}
        className="space-y-4"
        noValidate
      >
        <Field label="Enclosure / ODF asset" hint="Optional">
          <select className={selectClass} {...register("enclosure_asset_id")}>
            <option value="">— None —</option>
            {enclosureOptions.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.asset_code} · {a.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field label="Source cable" error={errors.source_cable_id?.message}>
              <select
                className={selectClass}
                {...register("source_cable_id", {
                  required: "Source cable is required",
                })}
              >
                <option value="">— Select —</option>
                {cables.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.cable_code} · {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source core" error={errors.source_core_id?.message}>
              <select
                className={selectClass}
                {...register("source_core_id", {
                  required: "Source core is required",
                })}
                disabled={!sourceCableId || sourceCoresQ.isLoading}
              >
                <option value="">
                  {sourceCableId
                    ? sourceCoresQ.isLoading
                      ? "Loading cores..."
                      : "— Select —"
                    : "Select a cable first"}
                </option>
                {(sourceCoresQ.data?.items ?? []).map((core: FiberCore) => (
                  <option key={core.id} value={String(core.id)}>
                    #{core.core_number}
                    {core.color ? ` (${core.color})` : ""} · {core.status}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="space-y-3">
            <Field
              label="Destination cable"
              error={errors.destination_cable_id?.message}
            >
              <select
                className={selectClass}
                {...register("destination_cable_id", {
                  required: "Destination cable is required",
                })}
              >
                <option value="">— Select —</option>
                {cables.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.cable_code} · {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Destination core"
              error={errors.destination_core_id?.message}
            >
              <select
                className={selectClass}
                {...register("destination_core_id", {
                  required: "Destination core is required",
                })}
                disabled={!destCableId || destCoresQ.isLoading}
              >
                <option value="">
                  {destCableId
                    ? destCoresQ.isLoading
                      ? "Loading cores..."
                      : "— Select —"
                    : "Select a cable first"}
                </option>
                {(destCoresQ.data?.items ?? []).map((core: FiberCore) => (
                  <option key={core.id} value={String(core.id)}>
                    #{core.core_number}
                    {core.color ? ` (${core.color})` : ""} · {core.status}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Splice loss (dB)" hint="Optional">
            <Input type="number" step="any" {...register("splice_loss")} />
          </Field>
          <Field label="Technician ID" hint="Optional">
            <Input type="number" {...register("technician_id")} />
          </Field>
        </div>

        <Field label="Notes" hint="Optional">
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
