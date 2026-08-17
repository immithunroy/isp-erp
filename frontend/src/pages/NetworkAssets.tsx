import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import {
  createNetworkAsset,
  deleteNetworkAsset,
  listNetworkAssets,
  updateNetworkAsset,
  type NetworkAsset,
  type NetworkAssetCreate,
  type NetworkAssetUpdate,
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

const ASSET_TYPES: { value: string; label: string }[] = [
  { value: "olt", label: "OLT" },
  { value: "pop", label: "POP" },
  { value: "odf", label: "ODF" },
  { value: "tj_box", label: "TJ Box" },
  { value: "enclosure", label: "Enclosure" },
  { value: "splitter", label: "Splitter" },
  { value: "pole", label: "Pole" },
  { value: "manhole", label: "Manhole" },
  { value: "customer_premise", label: "Customer Premise" },
  { value: "other", label: "Other" },
];

const ASSET_STATUSES: { value: string; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "maintenance", label: "Maintenance" },
  { value: "faulty", label: "Faulty" },
  { value: "decommissioned", label: "Decommissioned" },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "planned":
      return "bg-blue-100 text-blue-700";
    case "maintenance":
      return "bg-amber-100 text-amber-700";
    case "faulty":
      return "bg-red-100 text-red-700";
    case "decommissioned":
      return "bg-slate-200 text-slate-700";
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

interface AssetFormValues {
  organization_id: string;
  asset_code: string;
  asset_type: string;
  name: string;
  status: string;
  latitude: string;
  longitude: string;
  capacity: string;
  notes: string;
  is_active: boolean;
}

interface AssetFilters {
  asset_type: string;
  status: string;
}

export function NetworkAssets() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<AssetFilters>({
    asset_type: "",
    status: "",
  });
  const [committed, setCommitted] = useState<AssetFilters>({
    asset_type: "",
    status: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkAsset | null>(null);

  const canRead =
    hasPermission("network:assets:read") || hasPermission("network:assets:write");
  const canWrite = hasPermission("network:assets:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["network-assets", page, search, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = {
        page,
        page_size: PAGE_SIZE,
        search,
      };
      if (committed.asset_type) p.asset_type = committed.asset_type;
      if (committed.status) p.status = committed.status;
      return listNetworkAssets(p);
    },
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: NetworkAssetCreate) => createNetworkAsset(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network-assets"] });
      qc.invalidateQueries({ queryKey: ["network-map-bbox"] });
      close();
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: NetworkAssetUpdate }) =>
      updateNetworkAsset(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network-assets"] });
      qc.invalidateQueries({ queryKey: ["network-map-bbox"] });
      close();
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteNetworkAsset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network-assets"] });
      qc.invalidateQueries({ queryKey: ["network-map-bbox"] });
    },
  });

  const close = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const onDelete = (a: NetworkAsset) => {
    if (window.confirm(`Delete asset "${a.name}" (${a.asset_code})?`))
      deleteM.mutate(a.id);
  };

  const applyFilters = () => {
    setCommitted(filters);
    setPage(1);
  };
  const resetFilters = () => {
    const empty = { asset_type: "", status: "" };
    setFilters(empty);
    setCommitted(empty);
    setPage(1);
  };

  const orgName = useMemo(
    () => new Map((orgsQ.data?.items ?? []).map((o) => [o.id, o.name])),
    [orgsQ.data],
  );

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Network Assets"
        subtitle="Manage physical network equipment and locations."
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Create asset
            </Button>
          ) : undefined
        }
      />

      <Input
        placeholder="Search by code or name..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-xs"
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Asset type</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.asset_type}
              onChange={(e) =>
                setFilters((f) => ({ ...f, asset_type: e.target.value }))
              }
            >
              <option value="">— All —</option>
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
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
              {ASSET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
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
                <Th>Type</Th>
                <Th>Name</Th>
                <Th>Org</Th>
                <Th>Status</Th>
                <Th>Coordinates</Th>
                <Th>Installed</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((a) => (
                <Tr key={a.id}>
                  <Td className="text-slate-400">{a.id}</Td>
                  <Td className="font-mono text-xs">{a.asset_code}</Td>
                  <Td>
                    <Badge>{a.asset_type}</Badge>
                  </Td>
                  <Td className="font-medium">{a.name}</Td>
                  <Td className="text-slate-500">
                    {orgName.get(a.organization_id) ?? `#${a.organization_id}`}
                  </Td>
                  <Td>
                    <Badge className={statusBadgeClass(a.status)}>{a.status}</Badge>
                  </Td>
                  <Td className="font-mono text-xs text-slate-500">
                    {a.latitude != null && a.longitude != null
                      ? `${a.latitude.toFixed(5)}, ${a.longitude.toFixed(5)}`
                      : "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {fmtDate(a.installed_at)}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(a);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => onDelete(a)}
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
        <EmptyState text="No network assets found." />
      )}

      {modalOpen && (
        <AssetForm
          organizations={orgsQ.data?.items ?? []}
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

function AssetForm({
  organizations,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  editing: NetworkAsset | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: NetworkAssetCreate) => void;
  onSubmitUpdate: (id: number, body: NetworkAssetUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssetFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          asset_code: editing.asset_code,
          asset_type: editing.asset_type,
          name: editing.name,
          status: editing.status,
          latitude:
            editing.latitude != null ? String(editing.latitude) : "",
          longitude:
            editing.longitude != null ? String(editing.longitude) : "",
          capacity: editing.capacity ?? "",
          notes: editing.notes ?? "",
          is_active: editing.is_active,
        }
      : {
          organization_id: "",
          asset_code: "",
          asset_type: "olt",
          name: "",
          status: "planned",
          latitude: "",
          longitude: "",
          capacity: "",
          notes: "",
          is_active: true,
        },
  });

  const onSubmit = (values: AssetFormValues) => {
    const organization_id = Number(values.organization_id);
    if (!organization_id) return;
    const lat = values.latitude === "" ? null : Number(values.latitude);
    const lng = values.longitude === "" ? null : Number(values.longitude);
    if (lat !== null && Number.isNaN(lat)) return;
    if (lng !== null && Number.isNaN(lng)) return;

    if (isEdit && editing) {
      const body: NetworkAssetUpdate = {
        name: values.name,
        status: values.status,
        latitude: lat,
        longitude: lng,
        capacity: values.capacity || null,
        notes: values.notes || null,
        is_active: values.is_active,
      };
      onSubmitUpdate(editing.id, body);
    } else {
      const body: NetworkAssetCreate = {
        organization_id,
        asset_code: values.asset_code,
        asset_type: values.asset_type,
        name: values.name,
        status: values.status,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        capacity: values.capacity || undefined,
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
      title={isEdit ? "Edit asset" : "Create asset"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="network-asset-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form
        id="network-asset-form"
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
          <Field label="Asset code" error={errors.asset_code?.message}>
            <Input
              {...register("asset_code", { required: "Asset code is required" })}
              disabled={isEdit}
            />
          </Field>
          <Field label="Asset type" error={errors.asset_type?.message}>
            <select
              className={selectClass}
              {...register("asset_type", { required: "Asset type is required" })}
              disabled={isEdit}
            >
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <select className={selectClass} {...register("status")}>
              {ASSET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capacity" hint="Optional">
            <Input {...register("capacity")} />
          </Field>
          <Field label="Latitude" error={errors.latitude?.message} hint="Optional">
            <Input step="any" {...register("latitude")} />
          </Field>
          <Field label="Longitude" error={errors.longitude?.message} hint="Optional">
            <Input step="any" {...register("longitude")} />
          </Field>
        </div>
        <Field label="Notes" hint="Optional">
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
