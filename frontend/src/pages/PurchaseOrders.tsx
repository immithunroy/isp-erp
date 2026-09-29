import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import {
  addPurchaseOrderLine,
  cancelPurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  deletePurchaseOrderLine,
  listPurchaseOrders,
  listStockItems,
  listWarehouses,
  receivePurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderCreate,
  type PurchaseOrderLine,
  type PurchaseOrderLineCreate,
  type PurchaseOrderReceive,
  type PurchaseOrderStatus,
  type PurchaseOrderUpdate,
  type StockItem,
  type Warehouse,
} from "../lib/inventory-api";
import {
  approvePurchaseOrderLevel,
  listPurchaseOrderApprovals,
  rejectPurchaseOrderLevel,
  submitPurchaseOrderForApproval,
  type PurchaseOrderApproval,
} from "../lib/procurement-api";
import { listUsers, type UserDetail } from "../lib/core-api";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
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

const STATUSES: { value: PurchaseOrderStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "partially_received", label: "Partially received" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

function statusBadgeClass(status: PurchaseOrderStatus): string {
  switch (status) {
    case "draft":
      return "bg-slate-200 text-slate-700";
    case "pending_approval":
      return "bg-amber-100 text-amber-700";
    case "approved":
      return "bg-blue-100 text-blue-700";
    case "partially_received":
      return "bg-amber-100 text-amber-700";
    case "received":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function fmtQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function fmtMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function isReceivable(status: PurchaseOrderStatus): boolean {
  return status === "approved" || status === "partially_received";
}

export function PurchaseOrders() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [committedStatus, setCommittedStatus] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [lineTarget, setLineTarget] = useState<PurchaseOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<PurchaseOrder | null>(null);

  const canRead =
    hasPermission("inventory:purchase_orders:read") ||
    hasPermission("inventory:purchase_orders:write");
  const canWrite = hasPermission("inventory:purchase_orders:write");
  const canSubmitForApproval = hasPermission("procurement:purchase_orders:write");
  const canReadItems = canRead || hasPermission("inventory:items:read");
  const canReadWarehouses = canRead || hasPermission("inventory:warehouses:read");

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

  const listQ = useQuery({
    queryKey: ["purchase-orders", page, search, committedStatus],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = {
        page,
        page_size: PAGE_SIZE,
        search,
      };
      if (committedStatus) p.status = committedStatus;
      return listPurchaseOrders(p);
    },
    enabled: canRead,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["purchase-orders"] });
  };
  const invalidateStock = () => {
    qc.invalidateQueries({ queryKey: ["stock-levels"] });
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["inventory-summary"] });
  };

  const createM = useMutation({
    mutationFn: (b: PurchaseOrderCreate) => createPurchaseOrder(b),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: PurchaseOrderUpdate }) =>
      updatePurchaseOrder(id, body),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deletePurchaseOrder(id),
    onSuccess: () => {
      invalidate();
      setExpanded(null);
    },
  });
  const addLineM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: PurchaseOrderLineCreate }) =>
      addPurchaseOrderLine(id, body),
    onSuccess: () => {
      invalidate();
      setLineTarget(null);
    },
  });
  const deleteLineM = useMutation({
    mutationFn: ({ id, lineId }: { id: number; lineId: number }) =>
      deletePurchaseOrderLine(id, lineId),
    onSuccess: () => invalidate(),
  });
  const cancelM = useMutation({
    mutationFn: (id: number) => cancelPurchaseOrder(id),
    onSuccess: () => invalidate(),
  });
  const receiveM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: PurchaseOrderReceive }) =>
      receivePurchaseOrder(id, body),
    onSuccess: () => {
      invalidate();
      invalidateStock();
      setReceiveTarget(null);
    },
  });

  if (!canRead) return <NoAccess />;

  const warehouses = warehousesQ.data?.items ?? [];
  const items = itemsQ.data?.items ?? [];

  const applyFilters = () => {
    setCommittedStatus(statusFilter);
    setPage(1);
  };
  const resetFilters = () => {
    setStatusFilter("");
    setCommittedStatus("");
    setPage(1);
  };

  const onDelete = (po: PurchaseOrder) => {
    if (window.confirm(`Delete purchase order "${po.po_number}"?`)) deleteM.mutate(po.id);
  };
  const onDeleteLine = (po: PurchaseOrder, line: PurchaseOrderLine) => {
    if (window.confirm(`Remove line ${line.id} from "${po.po_number}"?`))
      deleteLineM.mutate({ id: po.id, lineId: line.id });
  };
  const onApprove = (po: PurchaseOrder) => {
    setApprovalTarget(po);
  };
  const onCancel = (po: PurchaseOrder) => {
    if (window.confirm(`Cancel purchase order "${po.po_number}"?`))
      cancelM.mutate(po.id);
  };

  const actionError =
    deleteM.error ??
    deleteLineM.error ??
    cancelM.error ??
    addLineM.error;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Order stock from suppliers and receive it into a warehouse."
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setCreateOpen(true);
              }}
            >
              New purchase order
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by PO number or supplier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <select
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">— All statuses —</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
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

      {listQ.isLoading ? (
        <LoadingState />
      ) : listQ.isError ? (
        <ErrorState error={listQ.error} />
      ) : listQ.data && listQ.data.items.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>PO number</Th>
                <Th>Supplier</Th>
                <Th>Warehouse</Th>
                <Th>Status</Th>
                <Th>Order date</Th>
                <Th>Expected</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((po) => {
                const warehouse = warehouses.find((w) => w.id === po.warehouse_id);
                const isOpen = expanded === po.id;
                return (
                  <Fragment key={po.id}>
                    <Tr>
                      <Td>
                        <button
                          type="button"
                          className="font-mono text-xs text-brand hover:underline"
                          onClick={() => setExpanded(isOpen ? null : po.id)}
                        >
                          {po.po_number}
                        </button>
                        <div className="text-xs text-slate-400">
                          {po.lines.length} line{po.lines.length === 1 ? "" : "s"}
                        </div>
                      </Td>
                      <Td className="font-medium">{po.supplier_name}</Td>
                      <Td className="text-slate-500">
                        {warehouse
                          ? `${warehouse.code} · ${warehouse.name}`
                          : `#${po.warehouse_id}`}
                      </Td>
                      <Td>
                        <Badge className={statusBadgeClass(po.status)}>{po.status}</Badge>
                      </Td>
                      <Td className="whitespace-nowrap text-slate-500">
                        {fmtDate(po.order_date)}
                      </Td>
                      <Td className="whitespace-nowrap text-slate-500">
                        {fmtDate(po.expected_date)}
                      </Td>
                      <Td className="text-right font-medium">
                        {fmtMoney(po.total_amount, po.currency)}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {po.status === "draft" && canWrite && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(po)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLineTarget(po)}
                            >
                              Add line
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => onDelete(po)}
                            >
                              Delete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => onCancel(po)}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {po.status === "draft" && canSubmitForApproval && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onApprove(po)}
                          >
                            Submit for approval
                          </Button>
                        )}
                        {po.status === "pending_approval" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onApprove(po)}
                          >
                            Approvals
                          </Button>
                        )}
                        {po.status === "pending_approval" && canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => onCancel(po)}
                          >
                            Cancel
                          </Button>
                        )}
                        {isReceivable(po.status) && canWrite && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReceiveTarget(po)}
                            >
                              Receive
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600"
                              onClick={() => onCancel(po)}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {(po.status === "received" || po.status === "cancelled") && (
                          <span className="text-xs text-slate-400">Read-only</span>
                        )}
                      </Td>
                    </Tr>
                    {isOpen && (
                      <Tr>
                        <Td colSpan={8} className="bg-slate-50">
                          <PurchaseOrderDetail
                            po={po}
                            items={items}
                            canEditLines={canWrite && po.status === "draft"}
                            deletingLineId={
                              deleteLineM.isPending ? deleteLineM.variables?.lineId : undefined
                            }
                            onDeleteLine={(line) => onDeleteLine(po, line)}
                          />
                        </Td>
                      </Tr>
                    )}
                  </Fragment>
                );
              })}
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
        <EmptyState text="No purchase orders found." />
      )}

      <ServerError error={actionError} />

      {createOpen && (
        <PurchaseOrderForm
          organizations={orgsQ.data?.items ?? []}
          items={items}
          warehouses={warehouses}
          editing={null}
          submitting={createM.isPending || updateM.isPending}
          serverError={createM.error ?? updateM.error}
          onCancel={() => setCreateOpen(false)}
          onSubmitCreate={(b) => createM.mutate(b)}
          onSubmitUpdate={(id, b) => updateM.mutate({ id, body: b })}
        />
      )}

      {editing && (
        <PurchaseOrderForm
          organizations={orgsQ.data?.items ?? []}
          items={items}
          warehouses={warehouses}
          editing={editing}
          submitting={updateM.isPending}
          serverError={updateM.error}
          onCancel={() => setEditing(null)}
          onSubmitCreate={(b) => createM.mutate(b)}
          onSubmitUpdate={(id, b) => updateM.mutate({ id, body: b })}
        />
      )}

      {lineTarget && (
        <AddLineForm
          items={items}
          submitting={addLineM.isPending}
          serverError={addLineM.error}
          onCancel={() => setLineTarget(null)}
          onSubmit={(body) => addLineM.mutate({ id: lineTarget.id, body })}
        />
      )}

      {receiveTarget && (
        <ReceiveForm
          po={receiveTarget}
          items={items}
          submitting={receiveM.isPending}
          serverError={receiveM.error}
          onCancel={() => setReceiveTarget(null)}
          onSubmit={(body) => receiveM.mutate({ id: receiveTarget.id, body })}
        />
      )}

      {approvalTarget && (
        <ApprovalChainForm
          po={approvalTarget}
          onClose={() => setApprovalTarget(null)}
          onChanged={() => {
            invalidate();
          }}
        />
      )}
    </div>
  );
}

/**
 * Approval chain panel. A draft purchase order is submitted with an ordered
 * list of approvers; from then on each level is approved or rejected in turn,
 * and the final approval moves the PO to `approved`.
 */
function ApprovalChainForm({
  po,
  onClose,
  onChanged,
}: {
  po: PurchaseOrder;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { hasPermission, user } = useAuth();
  const canDecide = hasPermission("procurement:purchase_orders:approve");
  const chainQ = useQuery({
    queryKey: ["po-approvals", po.id],
    queryFn: () => listPurchaseOrderApprovals(po.id),
  });
  const usersQ = useQuery({
    queryKey: ["users-all-active"],
    queryFn: () => listUsers({ page: 1, page_size: 500, is_active: true }),
    staleTime: 60_000,
    enabled: po.status === "draft",
  });

  const [approverIds, setApproverIds] = useState<number[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});

  const submitM = useMutation({
    mutationFn: () => submitPurchaseOrderForApproval(po.id, approverIds),
    onSuccess: () => {
      onChanged();
      chainQ.refetch();
    },
  });
  const decideM = useMutation({
    mutationFn: ({ sequence, approve }: { sequence: number; approve: boolean }) =>
      approve
        ? approvePurchaseOrderLevel(po.id, sequence, comments[sequence] ?? null)
        : rejectPurchaseOrderLevel(po.id, sequence, comments[sequence] ?? null),
    onSuccess: () => {
      onChanged();
      chainQ.refetch();
    },
  });

  const chain = chainQ.data ?? [];
  const users: UserDetail[] = usersQ.data?.items ?? [];
  const error = submitM.error ?? decideM.error;

  const addApprover = (userId: number) => {
    if (!userId) return;
    setApproverIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  };
  const removeApprover = (userId: number) => {
    setApproverIds((prev) => prev.filter((id) => id !== userId));
  };
  const userName = (id: number) => users.find((u) => u.id === id)?.full_name ?? `#${id}`;

  // Only the first still-pending level can be decided.
  const activeLevel = chain.find((c) => c.status === "pending");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Approvals — ${po.po_number}`}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {po.status === "draft" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Build the approval chain. Approvers are decided in the order listed,
              and the purchase order becomes approved only once the last level signs
              off. Rejecting at any level returns it to draft.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Approvers in order</label>
              {approverIds.length === 0 && (
                <p className="text-sm text-slate-400">No approvers selected yet.</p>
              )}
              {approverIds.map((id, index) => (
                <div
                  key={id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">
                      {index + 1}
                    </span>
                    {userName(id)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => removeApprover(id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Add approver</label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value=""
                onChange={(e) => addApprover(Number(e.target.value))}
              >
                <option value="">— Select user —</option>
                {users
                  .filter((u) => !approverIds.includes(u.id))
                  .map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>
            <Button
              onClick={() => submitM.mutate()}
              disabled={submitM.isPending || approverIds.length === 0}
            >
              {submitM.isPending ? "Submitting..." : "Submit for approval"}
            </Button>
          </div>
        ) : chainQ.isLoading ? (
            <LoadingState />
          ) : chainQ.isError ? (
            <ErrorState error={chainQ.error} />
          ) : chain.length === 0 ? (
            <EmptyState text="This purchase order is not in the approval flow." />
          ) : (
            <div className="space-y-3">
              <Table>
                <TableHead>
                  <Tr>
                    <Th>Level</Th>
                    <Th>Approver</Th>
                    <Th>Status</Th>
                    <Th>Decided</Th>
                    <Th>Comments</Th>
                  </Tr>
                </TableHead>
                <TableBody>
                  {chain.map((c) => (
                    <Tr key={c.id}>
                      <Td>{c.sequence}</Td>
                      <Td>{c.approver_name ?? `#${c.approver_id}`}</Td>
                      <Td>
                        <ApprovalBadge status={c.status} />
                      </Td>
                      <Td className="text-slate-500">{fmtDate(c.decided_at)}</Td>
                      <Td className="text-slate-500">{c.comments ?? "—"}</Td>
                    </Tr>
                  ))}
                </TableBody>
              </Table>

              {canDecide && activeLevel && (activeLevel.approver_id === user?.id || user?.is_superuser) && (
                <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-900">
                    Level {activeLevel.sequence} is awaiting your decision
                    {activeLevel.approver_name ? ` (${activeLevel.approver_name})` : ""}.
                  </p>
                  <textarea
                    className="h-20 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    placeholder="Comments (optional)"
                    value={comments[activeLevel.sequence] ?? ""}
                    onChange={(e) =>
                      setComments((prev) => ({ ...prev, [activeLevel.sequence]: e.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={decideM.isPending}
                      onClick={() =>
                        decideM.mutate({ sequence: activeLevel.sequence, approve: true })
                      }
                    >
                      Approve level {activeLevel.sequence}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={decideM.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Reject this purchase order? It will return to draft for revision.`,
                          )
                        ) {
                          decideM.mutate({ sequence: activeLevel.sequence, approve: false });
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        <ServerError error={error} />
      </div>
    </Modal>
  );
}

function ApprovalBadge({ status }: { status: PurchaseOrderApproval["status"] }) {
  const cls =
    status === "approved"
      ? "bg-green-100 text-green-700"
      : status === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return <Badge className={cls}>{status}</Badge>;
}

function PurchaseOrderDetail({
  po,
  items,
  canEditLines,
  deletingLineId,
  onDeleteLine,
}: {
  po: PurchaseOrder;
  items: StockItem[];
  canEditLines: boolean;
  deletingLineId?: number;
  onDeleteLine: (line: PurchaseOrderLine) => void;
}) {
  return (
    <div className="space-y-3 p-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-4">
        <div className="flex gap-1">
          <dt className="text-slate-400">Contact:</dt>
          <dd className="text-slate-600">{po.supplier_contact ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-slate-400">Email:</dt>
          <dd className="break-all text-slate-600">{po.supplier_email ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-slate-400">Approved at:</dt>
          <dd className="text-slate-600">{fmtDate(po.approved_at)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-slate-400">Received at:</dt>
          <dd className="text-slate-600">{fmtDate(po.received_at)}</dd>
        </div>
      </dl>

      {po.notes && <p className="text-xs text-slate-500">{po.notes}</p>}

      {po.lines.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          No lines on this purchase order.
        </p>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white">
          <Table>
            <TableHead>
              <Tr>
                <Th>Item</Th>
                <Th className="text-right">Quantity</Th>
                <Th className="text-right">Received</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="text-right">Unit cost</Th>
                <Th className="text-right">Line total</Th>
                <Th>Notes</Th>
                {canEditLines && <Th className="text-right">Actions</Th>}
              </Tr>
            </TableHead>
            <TableBody>
              {po.lines.map((line) => {
                const item = items.find((i) => i.id === line.item_id);
                const outstanding = line.quantity - line.received_quantity;
                return (
                  <Tr key={line.id}>
                    <Td>
                      <div className="font-mono text-xs text-slate-500">
                        {item?.sku ?? `#${line.item_id}`}
                      </div>
                      <div className="font-medium">
                        {item?.name ?? `Item ${line.item_id}`}
                      </div>
                    </Td>
                    <Td className="text-right">{fmtQty(line.quantity)}</Td>
                    <Td className="text-right text-slate-500">
                      {fmtQty(line.received_quantity)}
                    </Td>
                    <Td
                      className={
                        outstanding > 0
                          ? "text-right text-amber-600"
                          : "text-right text-slate-400"
                      }
                    >
                      {fmtQty(outstanding)}
                    </Td>
                    <Td className="text-right text-slate-500">
                      {fmtMoney(line.unit_cost, po.currency)}
                    </Td>
                    <Td className="text-right font-medium">
                      {fmtMoney(line.line_total, po.currency)}
                    </Td>
                    <Td className="max-w-xs truncate text-slate-500">{line.notes ?? "—"}</Td>
                    {canEditLines && (
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          disabled={deletingLineId === line.id}
                          onClick={() => onDeleteLine(line)}
                        >
                          Remove
                        </Button>
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-end">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd>{fmtMoney(po.subtotal, po.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Tax</dt>
            <dd>{fmtMoney(po.tax_amount, po.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{fmtMoney(po.total_amount, po.currency)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

interface LineDraft {
  key: number;
  item_id: string;
  quantity: string;
  unit_cost: string;
  notes: string;
}

let lineKeySeed = 0;

function nextLineKey(): number {
  lineKeySeed += 1;
  return lineKeySeed;
}

function emptyLine(item?: StockItem): LineDraft {
  return {
    key: nextLineKey(),
    item_id: item ? String(item.id) : "",
    quantity: "1",
    unit_cost: item?.unit_cost != null ? String(item.unit_cost) : "0",
    notes: "",
  };
}

interface PurchaseOrderFormValues {
  organization_id: string;
  po_number: string;
  supplier_name: string;
  supplier_contact: string;
  supplier_email: string;
  warehouse_id: string;
  expected_date: string;
  currency: string;
  tax_amount: string;
  notes: string;
}

function PurchaseOrderForm({
  organizations,
  items,
  warehouses,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  items: StockItem[];
  warehouses: Warehouse[];
  editing: PurchaseOrder | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: PurchaseOrderCreate) => void;
  onSubmitUpdate: (id: number, body: PurchaseOrderUpdate) => void;
}) {
  const isEdit = editing !== null;
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          po_number: editing.po_number,
          supplier_name: editing.supplier_name,
          supplier_contact: editing.supplier_contact ?? "",
          supplier_email: editing.supplier_email ?? "",
          warehouse_id: String(editing.warehouse_id),
          expected_date: editing.expected_date ?? "",
          currency: editing.currency,
          tax_amount: String(editing.tax_amount),
          notes: editing.notes ?? "",
        }
      : {
          organization_id: "",
          po_number: "",
          supplier_name: "",
          supplier_contact: "",
          supplier_email: "",
          warehouse_id: "",
          expected_date: "",
          currency: "USD",
          tax_amount: "0",
          notes: "",
        },
  });

  const updateLine = (key: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const onSubmit = (values: PurchaseOrderFormValues) => {
    const tax_amount = Number(values.tax_amount);
    if (Number.isNaN(tax_amount)) return;

    if (isEdit && editing) {
      const warehouse_id = Number(values.warehouse_id);
      if (!warehouse_id) return;
      const body: PurchaseOrderUpdate = {
        supplier_name: values.supplier_name,
        supplier_contact: values.supplier_contact || null,
        supplier_email: values.supplier_email || null,
        warehouse_id,
        expected_date: values.expected_date || null,
        currency: values.currency,
        tax_amount,
        notes: values.notes || null,
      };
      onSubmitUpdate(editing.id, body);
      return;
    }

    const organization_id = Number(values.organization_id);
    const warehouse_id = Number(values.warehouse_id);
    if (!organization_id || !warehouse_id) return;
    const payloadLines: PurchaseOrderLineCreate[] = [];
    for (const line of lines) {
      const item_id = Number(line.item_id);
      const quantity = Number(line.quantity);
      const unit_cost = Number(line.unit_cost);
      if (!item_id || Number.isNaN(quantity) || quantity <= 0) return;
      if (Number.isNaN(unit_cost)) return;
      payloadLines.push({
        item_id,
        quantity,
        unit_cost,
        notes: line.notes || null,
      });
    }
    if (payloadLines.length === 0) return;

    const body: PurchaseOrderCreate = {
      organization_id,
      po_number: values.po_number,
      supplier_name: values.supplier_name,
      warehouse_id,
      supplier_contact: values.supplier_contact || null,
      supplier_email: values.supplier_email || null,
      expected_date: values.expected_date || null,
      currency: values.currency,
      tax_amount,
      notes: values.notes || null,
      lines: payloadLines,
    };
    onSubmitCreate(body);
  };

  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? `Edit purchase order ${editing?.po_number ?? ""}` : "New purchase order"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="inventory-po-form" disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save" : "Create purchase order"}
          </Button>
        </>
      }
    >
      <form
        id="inventory-po-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organization" error={errors.organization_id?.message}>
            <select
              className={selectClass}
              {...register("organization_id", { required: "Organization is required" })}
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
          <Field label="PO number" error={errors.po_number?.message}>
            <Input
              {...register("po_number", { required: "PO number is required" })}
              disabled={isEdit}
            />
          </Field>
          <Field label="Supplier name" error={errors.supplier_name?.message}>
            <Input
              {...register("supplier_name", { required: "Supplier name is required" })}
            />
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
          <Field label="Supplier contact" hint="Optional">
            <Input {...register("supplier_contact")} />
          </Field>
          <Field label="Supplier email" hint="Optional">
            <Input type="email" {...register("supplier_email")} />
          </Field>
          <Field label="Expected date" hint="Optional">
            <Input type="date" {...register("expected_date")} />
          </Field>
          <Field label="Currency" error={errors.currency?.message}>
            <Input {...register("currency", { required: "Currency is required" })} />
          </Field>
          <Field label="Tax amount" error={errors.tax_amount?.message}>
            <Input step="any" type="number" {...register("tax_amount", { required: true })} />
          </Field>
        </div>

        {!isEdit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Lines</span>
              <Button type="button" variant="secondary" size="sm" onClick={addLine}>
                Add line
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="text-sm text-slate-500">
                At least one line is required. Use &ldquo;Add line&rdquo;.
              </p>
            ) : (
              lines.map((line, index) => (
                <div
                  key={line.key}
                  className="grid grid-cols-12 items-end gap-2 rounded-md border border-slate-200 p-2"
                >
                  <div className="col-span-12 space-y-1 md:col-span-4">
                    <label className="text-xs font-medium text-slate-500">
                      Item {index + 1}
                    </label>
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      value={line.item_id}
                      onChange={(e) => {
                        const next = items.find((i) => i.id === Number(e.target.value));
                        updateLine(line.key, {
                          item_id: e.target.value,
                          unit_cost:
                            next?.unit_cost != null ? String(next.unit_cost) : line.unit_cost,
                        });
                      }}
                    >
                      <option value="">— Select —</option>
                      {items.map((i) => (
                        <option key={i.id} value={String(i.id)}>
                          {i.sku} · {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 space-y-1 md:col-span-2">
                    <label className="text-xs font-medium text-slate-500">Quantity</label>
                    <Input
                      className="h-9"
                      step="any"
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-6 space-y-1 md:col-span-2">
                    <label className="text-xs font-medium text-slate-500">Unit cost</label>
                    <Input
                      className="h-9"
                      step="any"
                      type="number"
                      value={line.unit_cost}
                      onChange={(e) => updateLine(line.key, { unit_cost: e.target.value })}
                    />
                  </div>
                  <div className="col-span-12 space-y-1 md:col-span-3">
                    <label className="text-xs font-medium text-slate-500">Notes</label>
                    <Input
                      className="h-9"
                      value={line.notes}
                      onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                    />
                  </div>
                  <div className="col-span-12 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      disabled={lines.length <= 1}
                      onClick={() => removeLine(line.key)}
                    >
                      Remove line
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <Field label="Notes" hint="Optional">
          <textarea
            className="h-20 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("notes")}
            spellCheck={false}
          />
        </Field>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}

interface LineFormValues {
  item_id: string;
  quantity: string;
  unit_cost: string;
  notes: string;
}

function AddLineForm({
  items,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  items: StockItem[];
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: PurchaseOrderLineCreate) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LineFormValues>({
    defaultValues: { item_id: "", quantity: "1", unit_cost: "0", notes: "" },
  });

  const onSubmitValues = (values: LineFormValues) => {
    const item_id = Number(values.item_id);
    const quantity = Number(values.quantity);
    const unit_cost = Number(values.unit_cost);
    if (!item_id || Number.isNaN(quantity) || quantity <= 0) return;
    if (Number.isNaN(unit_cost)) return;
    onSubmit({ item_id, quantity, unit_cost, notes: values.notes || null });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Add purchase order line"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="inventory-po-line-form" disabled={submitting}>
            {submitting ? "Adding..." : "Add line"}
          </Button>
        </>
      }
    >
      <form
        id="inventory-po-line-form"
        onSubmit={handleSubmit(onSubmitValues)}
        className="space-y-4"
        noValidate
      >
        <Field label="Item" error={errors.item_id?.message}>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity" error={errors.quantity?.message}>
            <Input
              step="any"
              type="number"
              {...register("quantity", { required: "Quantity is required" })}
            />
          </Field>
          <Field label="Unit cost" error={errors.unit_cost?.message}>
            <Input
              step="any"
              type="number"
              {...register("unit_cost", { required: "Unit cost is required" })}
            />
          </Field>
        </div>
        <Field label="Notes" hint="Optional">
          <Input {...register("notes")} />
        </Field>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}

function ReceiveForm({
  po,
  items,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  po: PurchaseOrder;
  items: StockItem[];
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: PurchaseOrderReceive) => void;
}) {
  const initial: Record<number, string> = {};
  for (const line of po.lines) {
    initial[line.id] = String(Math.max(0, line.quantity - line.received_quantity));
  }
  const [quantities, setQuantities] = useState<Record<number, string>>(initial);
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const lines: PurchaseOrderReceive["lines"] = [];
    for (const line of po.lines) {
      const quantity = Number(quantities[line.id] ?? "0");
      if (Number.isNaN(quantity) || quantity <= 0) continue;
      lines.push({ line_id: line.id, quantity });
    }
    if (lines.length === 0) return;
    onSubmit({ lines, notes: notes || null });
  };

  const totalReceiving = po.lines.reduce(
    (sum, line) => sum + (Number(quantities[line.id] ?? "0") || 0),
    0,
  );

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Receive stock for ${po.po_number}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || totalReceiving <= 0}>
            {submitting ? "Receiving..." : "Receive into stock"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Enter the quantity received for each line. Receiving posts a receipt movement per
          line into warehouse {po.warehouse_id}.
        </p>
        <div className="rounded-md border border-slate-200">
          <Table>
            <TableHead>
              <Tr>
                <Th>Item</Th>
                <Th className="text-right">Ordered</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="text-right">Receiving now</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {po.lines.map((line) => {
                const item = items.find((i) => i.id === line.item_id);
                const outstanding = line.quantity - line.received_quantity;
                return (
                  <Tr key={line.id}>
                    <Td>
                      <div className="font-mono text-xs text-slate-500">
                        {item?.sku ?? `#${line.item_id}`}
                      </div>
                      <div className="font-medium">
                        {item?.name ?? `Item ${line.item_id}`}
                      </div>
                    </Td>
                    <Td className="text-right">{fmtQty(line.quantity)}</Td>
                    <Td className="text-right text-slate-500">{fmtQty(outstanding)}</Td>
                    <Td className="text-right">
                      <Input
                        className="h-9 w-24 text-right"
                        step="any"
                        type="number"
                        min={0}
                        max={outstanding}
                        disabled={outstanding <= 0}
                        value={quantities[line.id] ?? ""}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [line.id]: e.target.value,
                          }))
                        }
                      />
                    </Td>
                  </Tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Field label="Notes" hint="Optional">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <ServerError error={serverError} />
      </div>
    </Modal>
  );
}
