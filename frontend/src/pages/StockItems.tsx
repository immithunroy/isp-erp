import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import {
  createStockItem,
  deleteStockItem,
  listStockItems,
  updateStockItem,
  type StockItem,
  type StockItemCreate,
  type StockItemUpdate,
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

const UNITS: string[] = ["pcs", "m", "km", "roll", "set", "box", "kg", "ltr"];

const CATEGORIES: string[] = [
  "fiber_cable",
  "optic",
  "network_equipment",
  "enclosure",
  "hardware",
  "tooling",
  "consumable",
  "other",
];

const ASSET_CLASSES: string[] = [
  "passive",
  "active",
  "consumable",
  "spare_part",
  "tooling",
];

interface StockItemFilters {
  organization_id: string;
  category: string;
  asset_class: string;
  is_active: string;
}

const EMPTY_FILTERS: StockItemFilters = {
  organization_id: "",
  category: "",
  asset_class: "",
  is_active: "",
};

function fmtQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StockItems() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<StockItemFilters>(EMPTY_FILTERS);
  const [committed, setCommitted] = useState<StockItemFilters>(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);

  const canRead =
    hasPermission("inventory:items:read") || hasPermission("inventory:items:write");
  const canWrite = hasPermission("inventory:items:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["inventory-items", page, search, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = {
        page,
        page_size: PAGE_SIZE,
        search,
      };
      if (committed.organization_id) p.organization_id = committed.organization_id;
      if (committed.category) p.category = committed.category;
      if (committed.asset_class) p.asset_class = committed.asset_class;
      if (committed.is_active) p.is_active = committed.is_active;
      return listStockItems(p);
    },
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: StockItemCreate) => createStockItem(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-summary"] });
      close();
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: StockItemUpdate }) =>
      updateStockItem(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-summary"] });
      close();
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteStockItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-items"] });
      qc.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
  });

  const close = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const onDelete = (i: StockItem) => {
    if (window.confirm(`Delete item "${i.name}" (${i.sku})?`)) deleteM.mutate(i.id);
  };

  const applyFilters = () => {
    setCommitted(filters);
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setCommitted(EMPTY_FILTERS);
    setPage(1);
  };

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Stock Items"
        subtitle="Catalog of everything that can be held in a warehouse."
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Create item
            </Button>
          ) : undefined
        }
      />

      <Input
        placeholder="Search by SKU, name or description..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-xs"
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
            <label className="text-xs font-medium text-slate-500">Category</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">— All —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Asset class</label>
            <select
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={filters.asset_class}
              onChange={(e) => setFilters((f) => ({ ...f, asset_class: e.target.value }))}
            >
              <option value="">— All —</option>
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
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
                <Th>SKU</Th>
                <Th>Name</Th>
                <Th>Category</Th>
                <Th>Asset class</Th>
                <Th>Unit</Th>
                <Th>Unit cost</Th>
                <Th>Reorder level</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((i) => (
                <Tr key={i.id}>
                  <Td className="text-slate-400">{i.id}</Td>
                  <Td className="font-mono text-xs">{i.sku}</Td>
                  <Td className="font-medium">{i.name}</Td>
                  <Td>
                    {i.category ? <Badge>{i.category}</Badge> : <span className="text-slate-400">—</span>}
                  </Td>
                  <Td className="text-slate-500">{i.asset_class ?? "—"}</Td>
                  <Td className="text-slate-500">{i.unit}</Td>
                  <Td className="text-slate-500">{fmtMoney(i.unit_cost)}</Td>
                  <Td className="text-slate-500">{fmtQty(i.reorder_level)}</Td>
                  <Td>
                    <Badge
                      className={
                        i.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-700"
                      }
                    >
                      {i.is_active ? "active" : "inactive"}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(i);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => onDelete(i)}
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
        <EmptyState text="No stock items found." />
      )}

      <ServerError error={deleteM.isError ? deleteM.error : null} />

      {modalOpen && (
        <StockItemForm
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

interface StockItemFormValues {
  organization_id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  unit_cost: string;
  reorder_level: string;
  asset_class: string;
  notes: string;
  is_active: boolean;
}

function StockItemForm({
  organizations,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  editing: StockItem | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: StockItemCreate) => void;
  onSubmitUpdate: (id: number, body: StockItemUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StockItemFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          sku: editing.sku,
          name: editing.name,
          description: editing.description ?? "",
          category: editing.category ?? "",
          unit: editing.unit,
          unit_cost: editing.unit_cost != null ? String(editing.unit_cost) : "",
          reorder_level: String(editing.reorder_level),
          asset_class: editing.asset_class ?? "",
          notes: editing.notes ?? "",
          is_active: editing.is_active,
        }
      : {
          organization_id: "",
          sku: "",
          name: "",
          description: "",
          category: "",
          unit: "pcs",
          unit_cost: "",
          reorder_level: "0",
          asset_class: "",
          notes: "",
          is_active: true,
        },
  });

  const onSubmit = (values: StockItemFormValues) => {
    const organization_id = Number(values.organization_id);
    if (!organization_id) return;
    const unit_cost = values.unit_cost === "" ? null : Number(values.unit_cost);
    if (unit_cost !== null && Number.isNaN(unit_cost)) return;
    const reorder_level = Number(values.reorder_level);
    if (Number.isNaN(reorder_level)) return;

    if (isEdit && editing) {
      const body: StockItemUpdate = {
        sku: values.sku,
        name: values.name,
        description: values.description || null,
        category: values.category || null,
        unit: values.unit,
        unit_cost,
        reorder_level,
        asset_class: values.asset_class || null,
        is_active: values.is_active,
        notes: values.notes || null,
      };
      onSubmitUpdate(editing.id, body);
    } else {
      const body: StockItemCreate = {
        organization_id,
        sku: values.sku,
        name: values.name,
        description: values.description || null,
        category: values.category || null,
        unit: values.unit,
        unit_cost,
        reorder_level,
        asset_class: values.asset_class || null,
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
      title={isEdit ? "Edit stock item" : "Create stock item"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="inventory-item-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form
        id="inventory-item-form"
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
          <Field label="SKU" error={errors.sku?.message}>
            <Input {...register("sku", { required: "SKU is required" })} />
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Unit" error={errors.unit?.message}>
            <select className={selectClass} {...register("unit", { required: true })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category" hint="Optional">
            <select className={selectClass} {...register("category")}>
              <option value="">— None —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Asset class" hint="Optional">
            <select className={selectClass} {...register("asset_class")}>
              <option value="">— None —</option>
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit cost" hint="Optional">
            <Input step="any" {...register("unit_cost")} />
          </Field>
          <Field label="Reorder level" error={errors.reorder_level?.message}>
            <Input step="any" {...register("reorder_level", { required: true })} />
          </Field>
        </div>
        <Field label="Description" hint="Optional">
          <textarea
            className="h-20 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("description")}
            spellCheck={false}
          />
        </Field>
        <Field label="Notes" hint="Optional">
          <textarea
            className="h-20 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
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
