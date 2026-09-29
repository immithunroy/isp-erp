import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import {
  createStockMovement,
  getStockSummary,
  listStockItems,
  listStockLevels,
  listStockMovements,
  listWarehouses,
  transferStock,
  type ManualMovementType,
  type MovementType,
  type StockItem,
  type StockMovementCreate,
  type StockTransferCreate,
  type Warehouse,
} from "../lib/inventory-api";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { Card } from "../components/Card";
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

type Tab = "levels" | "movements";

const MOVEMENT_TYPE_CONFIG: Record<MovementType, { label: string; badge: string }> = {
  receipt: { label: "Receipt", badge: "bg-green-100 text-green-700" },
  issue: { label: "Issue", badge: "bg-red-100 text-red-700" },
  adjustment: { label: "Adjustment", badge: "bg-amber-100 text-amber-700" },
  transfer_in: { label: "Transfer in", badge: "bg-blue-100 text-blue-700" },
  transfer_out: { label: "Transfer out", badge: "bg-blue-100 text-blue-700" },
};

const MOVEMENT_TYPE_OPTIONS: { value: ManualMovementType; label: string; hint: string }[] = [
  { value: "receipt", label: "Receipt", hint: "Adds stock into the warehouse." },
  { value: "issue", label: "Issue", hint: "Removes stock, e.g. issued to the field." },
  {
    value: "adjustment",
    label: "Adjustment",
    hint: "Signed delta. Use a negative value to write stock off.",
  },
];

function fmtQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function deltaClass(delta: number): string {
  if (delta > 0) return "text-green-600";
  if (delta < 0) return "text-red-600";
  return "text-slate-500";
}

function fmtDelta(delta: number): string {
  return `${delta > 0 ? "+" : ""}${fmtQty(delta)}`;
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={tone ?? "mt-1 text-xl font-semibold text-slate-800"}>{value}</div>
    </Card>
  );
}

export function InventoryStock() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("levels");

  const [levelPage, setLevelPage] = useState(1);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [committedWarehouse, setCommittedWarehouse] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [movementPage, setMovementPage] = useState(1);
  const [movementItemFilter, setMovementItemFilter] = useState("");
  const [movementWarehouseFilter, setMovementWarehouseFilter] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("");
  const [committedMovements, setCommittedMovements] = useState({
    item_id: "",
    warehouse_id: "",
    movement_type: "",
  });

  const [movementOpen, setMovementOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const canRead =
    hasPermission("inventory:stock:read") || hasPermission("inventory:stock:write");
  const canReadMovements = canRead || hasPermission("inventory:movements:read");
  const canReadWarehouses = canRead || hasPermission("inventory:warehouses:read");
  const canReadItems = canRead || hasPermission("inventory:items:read");
  const canWrite = hasPermission("inventory:stock:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const warehousesQ = useQuery({
    queryKey: ["inventory-warehouses", "all"],
    queryFn: () => listWarehouses({ page: 1, page_size: 500 }),
    enabled: canReadWarehouses,
    staleTime: 60_000,
  });

  const itemsQ = useQuery({
    queryKey: ["inventory-items", "all"],
    queryFn: () => listStockItems({ page: 1, page_size: 500 }),
    enabled: canReadItems,
    staleTime: 60_000,
  });

  const summaryQ = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: () => getStockSummary(),
    enabled: canRead,
  });

  const levelsQ = useQuery({
    queryKey: ["stock-levels", levelPage, committedWarehouse, lowOnly],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = {
        page: levelPage,
        page_size: PAGE_SIZE,
        low_only: lowOnly,
      };
      if (committedWarehouse) p.warehouse_id = committedWarehouse;
      return listStockLevels(p);
    },
    enabled: canRead,
  });

  const movementsQ = useQuery({
    queryKey: ["stock-movements", movementPage, committedMovements],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = {
        page: movementPage,
        page_size: PAGE_SIZE,
      };
      if (committedMovements.item_id) p.item_id = committedMovements.item_id;
      if (committedMovements.warehouse_id) p.warehouse_id = committedMovements.warehouse_id;
      if (committedMovements.movement_type) p.movement_type = committedMovements.movement_type;
      return listStockMovements(p);
    },
    enabled: canReadMovements,
  });

  const invalidateStock = () => {
    qc.invalidateQueries({ queryKey: ["stock-levels"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["inventory-summary"] });
  };

  const createMovementM = useMutation({
    mutationFn: (b: StockMovementCreate) => createStockMovement(b),
    onSuccess: () => {
      invalidateStock();
      setMovementOpen(false);
    },
  });

  const transferM = useMutation({
    mutationFn: (b: StockTransferCreate) => transferStock(b),
    onSuccess: () => {
      invalidateStock();
      setTransferOpen(false);
    },
  });

  if (!canRead) return <NoAccess />;

  const warehouses = warehousesQ.data?.items ?? [];
  const items = itemsQ.data?.items ?? [];
  const summary = summaryQ.data;

  const applyLevelFilters = () => {
    setCommittedWarehouse(warehouseFilter);
    setLevelPage(1);
  };
  const applyMovementFilters = () => {
    setCommittedMovements({
      item_id: movementItemFilter,
      warehouse_id: movementWarehouseFilter,
      movement_type: movementTypeFilter,
    });
    setMovementPage(1);
  };
  const resetMovementFilters = () => {
    setMovementItemFilter("");
    setMovementWarehouseFilter("");
    setMovementTypeFilter("");
    setCommittedMovements({ item_id: "", warehouse_id: "", movement_type: "" });
    setMovementPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Stock"
        subtitle="Stock on hand per warehouse, and the movement ledger behind it."
        action={
          canWrite ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                Transfer
              </Button>
              <Button onClick={() => setMovementOpen(true)}>New movement</Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label="Items"
          value={summary ? summary.item_count.toLocaleString() : "—"}
        />
        <StatCard
          label="Warehouses"
          value={
            summary
              ? `${summary.active_warehouse_count} / ${summary.warehouse_count}`
              : "—"
          }
        />
        <StatCard
          label="Total quantity"
          value={summary ? fmtQty(summary.total_quantity) : "—"}
        />
        <StatCard
          label="Total value"
          value={summary ? fmtMoney(summary.total_value) : "—"}
        />
        <StatCard
          label="Low stock"
          value={summary ? summary.low_stock_count.toLocaleString() : "—"}
          tone={
            summary && summary.low_stock_count > 0
              ? "mt-1 text-xl font-semibold text-red-600"
              : undefined
          }
        />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { key: "levels", label: "Stock levels" },
            { key: "movements", label: "Movements" },
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

      {tab === "levels" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Warehouse</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                >
                  <option value="">— All —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.code} · {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={lowOnly}
                    onChange={(e) => {
                      setLowOnly(e.target.checked);
                      setLevelPage(1);
                    }}
                  />
                  Low stock only
                </label>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={applyLevelFilters}
                  className="h-9 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  Filter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWarehouseFilter("");
                    setLowOnly(false);
                    setCommittedWarehouse("");
                    setLevelPage(1);
                  }}
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {levelsQ.isLoading ? (
            <LoadingState />
          ) : levelsQ.isError ? (
            <ErrorState error={levelsQ.error} />
          ) : levelsQ.data && levelsQ.data.items.length > 0 ? (
            <div className="space-y-2">
              <Table>
                <TableHead>
                  <Tr>
                    <Th>ID</Th>
                    <Th>Item</Th>
                    <Th>Warehouse</Th>
                    <Th className="text-right">On hand</Th>
                    <Th className="text-right">Reserved</Th>
                    <Th className="text-right">Available</Th>
                    <Th className="text-right">Reorder level</Th>
                    <Th>Status</Th>
                    <Th>Updated</Th>
                  </Tr>
                </TableHead>
                <TableBody>
                  {levelsQ.data.items.map((l) => {
                    const item = items.find((i) => i.id === l.item_id);
                    const warehouse = warehouses.find((w) => w.id === l.warehouse_id);
                    return (
                      <Tr key={l.id}>
                        <Td className="text-slate-400">{l.id}</Td>
                        <Td>
                          <div className="font-mono text-xs text-slate-500">
                            {item?.sku ?? `#${l.item_id}`}
                          </div>
                          <div className="font-medium">
                            {item?.name ?? `Item ${l.item_id}`}
                          </div>
                        </Td>
                        <Td className="text-slate-500">
                          {warehouse ? `${warehouse.code} · ${warehouse.name}` : `#${l.warehouse_id}`}
                        </Td>
                        <Td className="text-right font-medium">
                          {fmtQty(l.quantity)} {item?.unit ?? ""}
                        </Td>
                        <Td className="text-right text-slate-500">
                          {fmtQty(l.reserved_quantity)}
                        </Td>
                        <Td className="text-right text-slate-500">
                          {fmtQty(l.available_quantity)}
                        </Td>
                        <Td className="text-right text-slate-500">
                          {fmtQty(l.reorder_level)}
                        </Td>
                        <Td>
                          <Badge
                            className={
                              l.is_low ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }
                          >
                            {l.is_low ? "low" : "ok"}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap text-slate-500">
                          {fmtDate(l.updated_at)}
                        </Td>
                      </Tr>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={levelsQ.data.page}
                pages={levelsQ.data.pages}
                total={levelsQ.data.total}
                onPage={setLevelPage}
              />
            </div>
          ) : (
            <EmptyState
              text={
                lowOnly
                  ? "No low stock levels. Everything is above its reorder level."
                  : "No stock levels found."
              }
            />
          )}
        </div>
      )}

      {tab === "movements" && (
        <div className="space-y-3">
          {!canReadMovements ? (
            <EmptyState text="You do not have permission to read stock movements." />
          ) : (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Item</label>
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                      value={movementItemFilter}
                      onChange={(e) => setMovementItemFilter(e.target.value)}
                    >
                      <option value="">— All —</option>
                      {items.map((i) => (
                        <option key={i.id} value={String(i.id)}>
                          {i.sku} · {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Warehouse</label>
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                      value={movementWarehouseFilter}
                      onChange={(e) => setMovementWarehouseFilter(e.target.value)}
                    >
                      <option value="">— All —</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={String(w.id)}>
                          {w.code} · {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Type</label>
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                      value={movementTypeFilter}
                      onChange={(e) => setMovementTypeFilter(e.target.value)}
                    >
                      <option value="">— All —</option>
                      {(Object.keys(MOVEMENT_TYPE_CONFIG) as MovementType[]).map((t) => (
                        <option key={t} value={t}>
                          {MOVEMENT_TYPE_CONFIG[t].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={applyMovementFilters}
                      className="h-9 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark"
                    >
                      Filter
                    </button>
                    <button
                      type="button"
                      onClick={resetMovementFilters}
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {movementsQ.isLoading ? (
                <LoadingState />
              ) : movementsQ.isError ? (
                <ErrorState error={movementsQ.error} />
              ) : movementsQ.data && movementsQ.data.items.length > 0 ? (
                <div className="space-y-2">
                  <Table>
                    <TableHead>
                      <Tr>
                        <Th>ID</Th>
                        <Th>Moved at</Th>
                        <Th>Type</Th>
                        <Th>Item</Th>
                        <Th>Warehouse</Th>
                        <Th className="text-right">Delta</Th>
                        <Th className="text-right">Balance</Th>
                        <Th>Network asset</Th>
                        <Th>Reason</Th>
                      </Tr>
                    </TableHead>
                    <TableBody>
                      {movementsQ.data.items.map((m) => {
                        const item = items.find((i) => i.id === m.item_id);
                        const warehouse = warehouses.find((w) => w.id === m.warehouse_id);
                        const cfg = MOVEMENT_TYPE_CONFIG[m.movement_type] ?? {
                          label: m.movement_type,
                          badge: "bg-slate-100 text-slate-600",
                        };
                        return (
                          <Tr key={m.id}>
                            <Td className="text-slate-400">{m.id}</Td>
                            <Td className="whitespace-nowrap text-slate-500">
                              {fmtDate(m.moved_at)}
                            </Td>
                            <Td>
                              <Badge className={cfg.badge}>{cfg.label}</Badge>
                            </Td>
                            <Td>
                              <div className="font-mono text-xs text-slate-500">
                                {item?.sku ?? `#${m.item_id}`}
                              </div>
                              <div className="font-medium">
                                {item?.name ?? `Item ${m.item_id}`}
                              </div>
                            </Td>
                            <Td className="text-slate-500">
                              {warehouse
                                ? `${warehouse.code} · ${warehouse.name}`
                                : `#${m.warehouse_id}`}
                              {m.to_warehouse_id != null && (
                                <div className="text-xs text-slate-400">
                                  → #{m.to_warehouse_id}
                                </div>
                              )}
                            </Td>
                            <Td className={`text-right font-medium ${deltaClass(m.signed_delta)}`}>
                              {fmtDelta(m.signed_delta)}
                            </Td>
                            <Td className="text-right text-slate-500">
                              {m.balance_after != null ? fmtQty(m.balance_after) : "—"}
                            </Td>
                            <Td className="font-mono text-xs text-slate-500">
                              {m.network_asset_id != null ? `#${m.network_asset_id}` : "—"}
                            </Td>
                            <Td className="max-w-xs truncate text-slate-500">
                              {m.reason ?? "—"}
                            </Td>
                          </Tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Pagination
                    page={movementsQ.data.page}
                    pages={movementsQ.data.pages}
                    total={movementsQ.data.total}
                    onPage={setMovementPage}
                  />
                </div>
              ) : (
                <EmptyState text="No stock movements found." />
              )}
            </>
          )}
        </div>
      )}

      {movementOpen && (
        <MovementForm
          organizations={orgsQ.data?.items ?? []}
          items={items}
          warehouses={warehouses}
          submitting={createMovementM.isPending}
          serverError={createMovementM.error}
          onCancel={() => setMovementOpen(false)}
          onSubmit={(body) => createMovementM.mutate(body)}
        />
      )}

      {transferOpen && (
        <TransferForm
          organizations={orgsQ.data?.items ?? []}
          items={items}
          warehouses={warehouses}
          submitting={transferM.isPending}
          serverError={transferM.error}
          onCancel={() => setTransferOpen(false)}
          onSubmit={(body) => transferM.mutate(body)}
        />
      )}
    </div>
  );
}

interface MovementFormValues {
  organization_id: string;
  movement_type: ManualMovementType;
  item_id: string;
  warehouse_id: string;
  quantity: string;
  network_asset_id: string;
  reason: string;
}

function MovementForm({
  organizations,
  items,
  warehouses,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  organizations: Organization[];
  items: StockItem[];
  warehouses: Warehouse[];
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: StockMovementCreate) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<MovementFormValues>({
    defaultValues: {
      organization_id: "",
      movement_type: "receipt",
      item_id: "",
      warehouse_id: "",
      quantity: "",
      network_asset_id: "",
      reason: "",
    },
  });

  const movementType = watch("movement_type");
  const typeHint =
    MOVEMENT_TYPE_OPTIONS.find((o) => o.value === movementType)?.hint ?? undefined;

  const onSubmitValues = (values: MovementFormValues) => {
    const organization_id = Number(values.organization_id);
    const item_id = Number(values.item_id);
    const warehouse_id = Number(values.warehouse_id);
    const quantity = Number(values.quantity);
    if (!organization_id || !item_id || !warehouse_id) return;
    if (Number.isNaN(quantity) || quantity === 0) return;
    if (values.movement_type !== "adjustment" && quantity <= 0) return;
    const assetId =
      values.network_asset_id === "" ? null : Number(values.network_asset_id);
    if (assetId !== null && Number.isNaN(assetId)) return;

    onSubmit({
      organization_id,
      movement_type: values.movement_type,
      item_id,
      warehouse_id,
      quantity,
      network_asset_id: assetId,
      reason: values.reason || null,
    });
  };

  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title="New stock movement"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="inventory-movement-form" disabled={submitting}>
            {submitting ? "Recording..." : "Record movement"}
          </Button>
        </>
      }
    >
      <form
        id="inventory-movement-form"
        onSubmit={handleSubmit(onSubmitValues)}
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
            >
              <option value="">— Select —</option>
              {organizations.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type" error={errors.movement_type?.message} hint={typeHint}>
            <select
              className={selectClass}
              {...register("movement_type", { required: "Type is required" })}
            >
              {MOVEMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Item" error={errors.item_id?.message}>
            <select
              className={selectClass}
              {...register("item_id", { required: "Item is required" })}
            >
              <option value="">— Select —</option>
              {items.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.sku} · {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Warehouse" error={errors.warehouse_id?.message}>
            <select
              className={selectClass}
              {...register("warehouse_id", { required: "Warehouse is required" })}
            >
              <option value="">— Select —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Quantity"
            error={errors.quantity?.message}
            hint={movementType === "adjustment" ? "Signed, e.g. -2" : "Must be greater than 0"}
          >
            <Input
              step="any"
              type="number"
              {...register("quantity", { required: "Quantity is required" })}
            />
          </Field>
          <Field
            label="Network asset ID"
            hint="Optional — the asset this stock was installed into"
          >
            <Input inputMode="numeric" {...register("network_asset_id")} />
          </Field>
        </div>
        <Field label="Reason" hint="Optional">
          <Input {...register("reason")} />
        </Field>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}

interface TransferFormValues {
  organization_id: string;
  item_id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  quantity: string;
  reason: string;
}

function TransferForm({
  organizations,
  items,
  warehouses,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  organizations: Organization[];
  items: StockItem[];
  warehouses: Warehouse[];
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: StockTransferCreate) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferFormValues>({
    defaultValues: {
      organization_id: "",
      item_id: "",
      from_warehouse_id: "",
      to_warehouse_id: "",
      quantity: "",
      reason: "",
    },
  });

  const onSubmitValues = (values: TransferFormValues) => {
    const organization_id = Number(values.organization_id);
    const item_id = Number(values.item_id);
    const from_warehouse_id = Number(values.from_warehouse_id);
    const to_warehouse_id = Number(values.to_warehouse_id);
    const quantity = Number(values.quantity);
    if (!organization_id || !item_id || !from_warehouse_id || !to_warehouse_id) return;
    if (from_warehouse_id === to_warehouse_id) return;
    if (Number.isNaN(quantity) || quantity <= 0) return;

    onSubmit({
      organization_id,
      item_id,
      from_warehouse_id,
      to_warehouse_id,
      quantity,
      reason: values.reason || null,
    });
  };

  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title="Transfer stock between warehouses"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="inventory-transfer-form" disabled={submitting}>
            {submitting ? "Transferring..." : "Transfer"}
          </Button>
        </>
      }
    >
      <form
        id="inventory-transfer-form"
        onSubmit={handleSubmit(onSubmitValues)}
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
            >
              <option value="">— Select —</option>
              {organizations.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Item" error={errors.item_id?.message}>
            <select
              className={selectClass}
              {...register("item_id", { required: "Item is required" })}
            >
              <option value="">— Select —</option>
              {items.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.sku} · {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From warehouse" error={errors.from_warehouse_id?.message}>
            <select
              className={selectClass}
              {...register("from_warehouse_id", { required: "Source warehouse is required" })}
            >
              <option value="">— Select —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To warehouse" error={errors.to_warehouse_id?.message}>
            <select
              className={selectClass}
              {...register("to_warehouse_id", {
                required: "Destination warehouse is required",
              })}
            >
              <option value="">— Select —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity" error={errors.quantity?.message}>
            <Input
              step="any"
              type="number"
              {...register("quantity", { required: "Quantity is required" })}
            />
          </Field>
          <Field label="Reason" hint="Optional">
            <Input {...register("reason")} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          A transfer records two movements: a transfer_out from the source warehouse and a
          transfer_in into the destination.
        </p>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}
