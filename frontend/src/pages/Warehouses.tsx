import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import {
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  updateWarehouse,
  type Warehouse,
  type WarehouseCreate,
  type WarehouseUpdate,
} from "../lib/inventory-api";
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

interface WarehouseFilters {
  organization_id: string;
  is_active: string;
}

export function Warehouses() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<WarehouseFilters>({
    organization_id: "",
    is_active: "",
  });
  const [committed, setCommitted] = useState<WarehouseFilters>({
    organization_id: "",
    is_active: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  const canRead =
    hasPermission("inventory:warehouses:read") ||
    hasPermission("inventory:warehouses:write");
  const canWrite = hasPermission("inventory:warehouses:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["inventory-warehouses", page, search, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = {
        page,
        page_size: PAGE_SIZE,
        search,
      };
      if (committed.organization_id) p.organization_id = committed.organization_id;
      if (committed.is_active) p.is_active = committed.is_active;
      return listWarehouses(p);
    },
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: WarehouseCreate) => createWarehouse(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      qc.invalidateQueries({ queryKey: ["inventory-summary"] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      close();
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: WarehouseUpdate }) =>
      updateWarehouse(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      qc.invalidateQueries({ queryKey: ["inventory-summary"] });
      close();
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteWarehouse(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-warehouses"] });
      qc.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
  });

  const close = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const onDelete = (w: Warehouse) => {
    if (window.confirm(`Delete warehouse "${w.name}" (${w.code})?`)) deleteM.mutate(w.id);
  };

  const applyFilters = () => {
    setCommitted(filters);
    setPage(1);
  };
  const resetFilters = () => {
    const empty = { organization_id: "", is_active: "" };
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
        title="Warehouses"
        subtitle="Storage locations that hold stock items."
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Create warehouse
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
            <label className="text-xs font-medium text-slate-500">Organization</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.organization_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, organization_id: e.target.value }))
              }
            >
              <option value="">— All —</option>
              {(orgsQ.data?.items ?? []).map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Active</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.is_active}
              onChange={(e) => setFilters((f) => ({ ...f, is_active: e.target.value }))}
            >
              <option value="">— All —</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
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
                <Th>Org</Th>
                <Th>Address</Th>
                <Th>Coordinates</Th>
                <Th>Manager</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((w) => (
                <Tr key={w.id}>
                  <Td className="text-slate-400">{w.id}</Td>
                  <Td className="font-mono text-xs">{w.code}</Td>
                  <Td className="font-medium">{w.name}</Td>
                  <Td className="text-slate-500">
                    {orgName.get(w.organization_id) ?? `#${w.organization_id}`}
                  </Td>
                  <Td className="text-slate-500">{w.address ?? "—"}</Td>
                  <Td className="font-mono text-xs text-slate-500">
                    {w.latitude != null && w.longitude != null
                      ? `${w.latitude.toFixed(5)}, ${w.longitude.toFixed(5)}`
                      : "—"}
                  </Td>
                  <Td className="text-slate-500">
                    {w.manager_id != null ? `#${w.manager_id}` : "—"}
                  </Td>
                  <Td>
                    <Badge
                      className={
                        w.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-700"
                      }
                    >
                      {w.is_active ? "active" : "inactive"}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(w);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => onDelete(w)}
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
        <EmptyState text="No warehouses found." />
      )}

      <ServerError error={deleteM.isError ? deleteM.error : null} />

      {modalOpen && (
        <WarehouseForm
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

interface WarehouseFormValues {
  organization_id: string;
  code: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  manager_id: string;
  notes: string;
  is_active: boolean;
}

function WarehouseForm({
  organizations,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  editing: Warehouse | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: WarehouseCreate) => void;
  onSubmitUpdate: (id: number, body: WarehouseUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WarehouseFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          code: editing.code,
          name: editing.name,
          address: editing.address ?? "",
          latitude: editing.latitude != null ? String(editing.latitude) : "",
          longitude: editing.longitude != null ? String(editing.longitude) : "",
          manager_id: editing.manager_id != null ? String(editing.manager_id) : "",
          notes: editing.notes ?? "",
          is_active: editing.is_active,
        }
      : {
          organization_id: "",
          code: "",
          name: "",
          address: "",
          latitude: "",
          longitude: "",
          manager_id: "",
          notes: "",
          is_active: true,
        },
  });

  const onSubmit = (values: WarehouseFormValues) => {
    const organization_id = Number(values.organization_id);
    if (!organization_id) return;
    const lat = values.latitude === "" ? null : Number(values.latitude);
    const lng = values.longitude === "" ? null : Number(values.longitude);
    if (lat !== null && Number.isNaN(lat)) return;
    if (lng !== null && Number.isNaN(lng)) return;
    const manager_id = values.manager_id === "" ? null : Number(values.manager_id);
    if (manager_id !== null && Number.isNaN(manager_id)) return;

    if (isEdit && editing) {
      const body: WarehouseUpdate = {
        code: values.code,
        name: values.name,
        address: values.address || null,
        latitude: lat,
        longitude: lng,
        manager_id,
        is_active: values.is_active,
        notes: values.notes || null,
      };
      onSubmitUpdate(editing.id, body);
    } else {
      const body: WarehouseCreate = {
        organization_id,
        code: values.code,
        name: values.name,
        address: values.address || null,
        latitude: lat,
        longitude: lng,
        manager_id,
        is_active: values.is_active,
        notes: values.notes || null,
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
      title={isEdit ? "Edit warehouse" : "Create warehouse"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="inventory-warehouse-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form
        id="inventory-warehouse-form"
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
          <Field label="Code" error={errors.code?.message}>
            <Input
              {...register("code", { required: "Code is required" })}
              disabled={isEdit}
            />
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Manager user ID" hint="Optional">
            <Input inputMode="numeric" {...register("manager_id")} />
          </Field>
          <Field label="Latitude" hint="Optional">
            <Input step="any" {...register("latitude")} />
          </Field>
          <Field label="Longitude" hint="Optional">
            <Input step="any" {...register("longitude")} />
          </Field>
        </div>
        <Field label="Address" hint="Optional">
          <Input {...register("address")} />
        </Field>
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
