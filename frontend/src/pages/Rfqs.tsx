import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import { listStockItems, listWarehouses, type StockItem, type Warehouse } from "../lib/inventory-api";
import {
  acceptSupplierQuote,
  cancelRfq,
  convertQuoteToPurchaseOrder,
  createRfq,
  createSupplierQuote,
  getRfq,
  issueRfq,
  listRfqs,
  listSupplierQuotes,
  rejectSupplierQuote,
  type Rfq,
  type RfqStatus,
  type SupplierQuote,
} from "../lib/procurement-api";
import { listSuppliers, type Supplier } from "../lib/procurement-api";
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

const STATUS_STYLES: Record<RfqStatus, string> = {
  draft: "bg-slate-200 text-slate-700",
  issued: "bg-blue-100 text-blue-700",
  closed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const QUOTE_STATUS_STYLES: Record<SupplierQuote["status"], string> = {
  received: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export function Rfqs() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [committedStatus, setCommittedStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const canRead =
    hasPermission("procurement:rfq:read") || hasPermission("procurement:rfq:write");
  const canWrite = hasPermission("procurement:rfq:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["procurement-rfqs", page, search, committedStatus],
    queryFn: () => {
      const p: Record<string, string | number | undefined> = {
        page,
        page_size: PAGE_SIZE,
        search,
      };
      if (committedStatus) p.status = committedStatus;
      return listRfqs(p);
    },
    enabled: canRead,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["procurement-rfqs"] });
    qc.invalidateQueries({ queryKey: ["procurement-rfq-detail"] });
    qc.invalidateQueries({ queryKey: ["procurement-quotes"] });
  };

  const issueM = useMutation({
    mutationFn: (id: number) => issueRfq(id),
    onSuccess: invalidate,
  });
  const cancelM = useMutation({
    mutationFn: (id: number) => cancelRfq(id),
    onSuccess: invalidate,
  });

  const orgName = useMemo(
    () => new Map((orgsQ.data?.items ?? []).map((o) => [o.id, o.name])),
    [orgsQ.data],
  );

  if (!canRead) return <NoAccess />;

  const applyStatus = () => {
    setCommittedStatus(status);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Requests for Quotation"
        subtitle="Ask suppliers to bid on stock items, compare quotes and award the work."
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              Create RFQ
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by RFQ number or title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Status</label>
          <div className="flex gap-2">
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">— All —</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={applyStatus}
              className="h-9 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("");
                setCommittedStatus("");
                setPage(1);
              }}
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
                <Th>RFQ number</Th>
                <Th>Title</Th>
                <Th>Org</Th>
                <Th>Lines</Th>
                <Th>Quotes</Th>
                <Th>Due</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((r) => (
                <Tr key={r.id}>
                  <Td className="text-slate-400">{r.id}</Td>
                  <Td className="font-mono text-xs">{r.rfq_number}</Td>
                  <Td className="font-medium">{r.title}</Td>
                  <Td className="text-slate-500">
                    {orgName.get(r.organization_id) ?? `#${r.organization_id}`}
                  </Td>
                  <Td className="text-slate-500">{r.lines.length}</Td>
                  <Td className="text-slate-500">{r.quote_count}</Td>
                  <Td className="text-slate-500">{r.due_date ?? "—"}</Td>
                  <Td>
                    <Badge className={STATUS_STYLES[r.status]}>{r.status}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDetailId(r.id)}>
                      Quotes
                    </Button>
                    {canWrite && r.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={issueM.isPending}
                        onClick={() => issueM.mutate(r.id)}
                      >
                        Issue
                      </Button>
                    )}
                    {canWrite && (r.status === "draft" || r.status === "issued") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        disabled={cancelM.isPending}
                        onClick={() => {
                          if (window.confirm(`Cancel RFQ ${r.rfq_number}?`)) {
                            cancelM.mutate(r.id);
                          }
                        }}
                      >
                        Cancel
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
        <EmptyState text="No RFQs found." />
      )}

      <ServerError error={issueM.isError ? issueM.error : cancelM.isError ? cancelM.error : null} />

      {createOpen && (
        <RfqForm
          organizations={orgsQ.data?.items ?? []}
          onCancel={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            invalidate();
          }}
        />
      )}

      {detailId !== null && (
        <RfqDetail
          rfqId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

// ── Create RFQ ─────────────────────────────────────────────────────────
interface LineDraft {
  stock_item_id: string;
  quantity: string;
  target_unit_cost: string;
}

interface RfqFormValues {
  organization_id: string;
  rfq_number: string;
  title: string;
  due_date: string;
  notes: string;
}

function RfqForm({
  organizations,
  onCancel,
  onCreated,
}: {
  organizations: Organization[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const itemsQ = useQuery({
    queryKey: ["stock-items-all"],
    queryFn: () => listStockItems({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });
  const [lines, setLines] = useState<LineDraft[]>([
    { stock_item_id: "", quantity: "1", target_unit_cost: "" },
  ]);

  const createM = useMutation({
    mutationFn: createRfq,
    onSuccess: onCreated,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RfqFormValues>({
    defaultValues: {
      organization_id: "",
      rfq_number: "",
      title: "",
      due_date: "",
      notes: "",
    },
  });

  const items: StockItem[] = itemsQ.data?.items ?? [];
  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  const setLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const onSubmit = (values: RfqFormValues) => {
    const organization_id = Number(values.organization_id);
    if (!organization_id) return;

    const payloadLines = lines
      .filter((l) => l.stock_item_id !== "")
      .map((l) => ({
        stock_item_id: Number(l.stock_item_id),
        quantity: Number(l.quantity),
        target_unit_cost: l.target_unit_cost === "" ? null : Number(l.target_unit_cost),
      }));
    if (payloadLines.length === 0) return;

    createM.mutate({
      organization_id,
      rfq_number: values.rfq_number,
      title: values.title,
      due_date: values.due_date || null,
      notes: values.notes || null,
      lines: payloadLines,
    });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Create RFQ"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="procurement-rfq-form" disabled={createM.isPending}>
            {createM.isPending ? "Saving..." : "Create RFQ"}
          </Button>
        </>
      }
    >
      <form
        id="procurement-rfq-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organization" error={errors.organization_id?.message}>
            <select
              className={selectClass}
              {...register("organization_id", { required: "Organization is required" })}
            >
              <option value="">— Select —</option>
              {organizations.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="RFQ number" error={errors.rfq_number?.message}>
            <Input {...register("rfq_number", { required: "RFQ number is required" })} />
          </Field>
          <Field label="Title" error={errors.title?.message}>
            <Input {...register("title", { required: "Title is required" })} />
          </Field>
          <Field label="Due date" hint="Optional">
            <Input type="date" {...register("due_date")} />
          </Field>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500">Items</label>
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <select
                  className={selectClass}
                  value={line.stock_item_id}
                  onChange={(e) => setLine(index, { stock_item_id: e.target.value })}
                >
                  <option value="">— Select item —</option>
                  {items.map((i) => (
                    <option key={i.id} value={String(i.id)}>
                      {i.sku} — {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <Input
                  inputMode="decimal"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => setLine(index, { quantity: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Input
                  inputMode="decimal"
                  placeholder="Target unit cost"
                  value={line.target_unit_cost}
                  onChange={(e) => setLine(index, { target_unit_cost: e.target.value })}
                />
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  disabled={lines.length === 1}
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setLines((prev) => [...prev, { stock_item_id: "", quantity: "1", target_unit_cost: "" }])
            }
          >
            Add line
          </Button>
        </div>

        <Field label="Notes" hint="Optional">
          <textarea
            className="h-20 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("notes")}
            spellCheck={false}
          />
        </Field>
        <ServerError error={createM.error} />
      </form>
    </Modal>
  );
}

// ── RFQ detail + quotes ────────────────────────────────────────────────
function RfqDetail({
  rfqId,
  onClose,
  onChanged,
}: {
  rfqId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { hasPermission } = useAuth();
  const canQuote =
    hasPermission("procurement:quotes:read") || hasPermission("procurement:quotes:write");
  const canQuoteWrite = hasPermission("procurement:quotes:write");
  const canDecide = hasPermission("procurement:quotes:approve");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [convertQuote, setConvertQuote] = useState<SupplierQuote | null>(null);

  const rfqQ = useQuery({
    queryKey: ["procurement-rfq-detail", rfqId],
    queryFn: () => getRfq(rfqId),
  });
  const quotesQ = useQuery({
    queryKey: ["procurement-quotes", { rfq_id: rfqId }],
    queryFn: () => listSupplierQuotes({ rfq_id: rfqId, page: 1, page_size: 200 }),
    enabled: canQuote,
  });

  const acceptM = useMutation({
    mutationFn: (id: number) => acceptSupplierQuote(id),
    onSuccess: () => {
      onChanged();
    },
  });
  const rejectM = useMutation({
    mutationFn: (id: number) => rejectSupplierQuote(id),
    onSuccess: () => {
      onChanged();
    },
  });

  const rfq = rfqQ.data;
  const quotes = quotesQ.data?.items ?? [];
  const error = acceptM.error ?? rejectM.error;

  return (
    <Modal open onClose={onClose} title={rfq?.rfq_number ?? "RFQ"} size="lg">
      {rfqQ.isLoading ? (
        <LoadingState />
      ) : rfqQ.isError ? (
        <ErrorState error={rfqQ.error} />
      ) : rfq ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold">{rfq.title}</h3>
            <Badge className={STATUS_STYLES[rfq.status]}>{rfq.status}</Badge>
            {rfq.due_date && (
              <span className="text-xs text-slate-500">Due {rfq.due_date}</span>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <Table>
              <TableHead>
                <Tr>
                  <Th>Stock item</Th>
                  <Th className="text-right">Quantity</Th>
                  <Th className="text-right">Target unit cost</Th>
                </Tr>
              </TableHead>
              <TableBody>
                {rfq.lines.map((l) => (
                  <Tr key={l.id}>
                    <Td className="font-mono text-xs">#{l.stock_item_id}</Td>
                    <Td className="text-right">{l.quantity}</Td>
                    <Td className="text-right">
                      {l.target_unit_cost != null ? l.target_unit_cost.toFixed(2) : "—"}
                    </Td>
                  </Tr>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                Supplier quotes ({quotes.length})
              </h4>
              {canQuoteWrite && rfq.status === "issued" && (
                <Button size="sm" onClick={() => setQuoteOpen(true)}>
                  Record quote
                </Button>
              )}
            </div>

            {!canQuote ? (
              <p className="text-sm text-slate-500">You cannot view supplier quotes.</p>
            ) : quotesQ.isLoading ? (
              <LoadingState />
            ) : quotesQ.isError ? (
              <ErrorState error={quotesQ.error} />
            ) : quotes.length === 0 ? (
              <EmptyState text="No quotes recorded yet." />
            ) : (
              <div className="space-y-3">
                {quotes.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-md border border-slate-200 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{q.supplier_name ?? `#${q.supplier_id}`}</span>
                        <Badge className={QUOTE_STATUS_STYLES[q.status]}>{q.status}</Badge>
                        {q.purchase_order_id && (
                          <Badge className="bg-purple-100 text-purple-700">
                            PO #{q.purchase_order_id}
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-xs text-slate-600">
                        {q.total_amount.toFixed(2)} {q.currency}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {q.lines.map((l) => (
                        <div
                          key={l.id}
                          className="flex flex-wrap items-center justify-between text-xs text-slate-600"
                        >
                          <span>
                            line #{l.rfq_line_id}: {l.quantity} × {l.unit_cost.toFixed(2)} ={" "}
                            {l.line_total.toFixed(2)}
                          </span>
                          {l.over_target && (
                            <span className="text-amber-600">above target</span>
                          )}
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500">
                        <span>
                          subtotal {q.subtotal.toFixed(2)} + tax {q.tax_amount.toFixed(2)}
                        </span>
                        {q.lead_time_days != null && <span>lead {q.lead_time_days} d</span>}
                        {q.valid_until && <span>valid to {q.valid_until}</span>}
                      </div>
                    </div>
                    {canDecide && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {q.status === "received" && (
                          <>
                            <Button
                              size="sm"
                              disabled={acceptM.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Accept the quote from ${q.supplier_name}? Competing quotes will be rejected and the RFQ closed.`,
                                  )
                                ) {
                                  acceptM.mutate(q.id);
                                }
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={rejectM.isPending}
                              onClick={() => rejectM.mutate(q.id)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {q.status === "accepted" && !q.purchase_order_id && (
                          <Button size="sm" onClick={() => setConvertQuote(q)}>
                            Convert to purchase order
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ServerError error={error} />

          {quoteOpen && (
            <QuoteForm
              rfq={rfq}
              onCancel={() => setQuoteOpen(false)}
              onCreated={() => {
                setQuoteOpen(false);
                onChanged();
              }}
            />
          )}
          {convertQuote && (
            <ConvertForm
              quote={convertQuote}
              onCancel={() => setConvertQuote(null)}
              onConverted={() => {
                setConvertQuote(null);
                onChanged();
              }}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function QuoteForm({
  rfq,
  onCancel,
  onCreated,
}: {
  rfq: Rfq;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const suppliersQ = useQuery({
    queryKey: ["procurement-suppliers-active"],
    queryFn: () => listSuppliers({ page: 1, page_size: 500, is_active: true }),
  });
  const [supplierId, setSupplierId] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [leadTime, setLeadTime] = useState("");
  const [costs, setCosts] = useState<Record<number, string>>({});
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  const createM = useMutation({
    mutationFn: createSupplierQuote,
    onSuccess: onCreated,
  });

  const suppliers: Supplier[] = suppliersQ.data?.items ?? [];
  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  const onSubmit = () => {
    const supplier_id = Number(supplierId);
    if (!supplier_id) return;
    const lines = rfq.lines
      .map((l) => ({
        rfq_line_id: l.id,
        quantity: quantities[l.id] === "" || quantities[l.id] === undefined
          ? l.quantity
          : Number(quantities[l.id]),
        unit_cost: Number(costs[l.id] ?? ""),
      }))
      .filter((l) => !Number.isNaN(l.unit_cost) && l.unit_cost > 0);
    if (lines.length === 0) return;

    createM.mutate({
      organization_id: rfq.organization_id,
      rfq_id: rfq.id,
      supplier_id,
      tax_amount: taxAmount === "" ? 0 : Number(taxAmount),
      lead_time_days: leadTime === "" ? null : Number(leadTime),
      lines,
    });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Record quote for ${rfq.rfq_number}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={createM.isPending}>
            {createM.isPending ? "Saving..." : "Record quote"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Supplier">
          <select
            className={selectClass}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">— Select supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500">Bid per line</label>
          {rfq.lines.map((l) => (
            <div key={l.id} className="grid grid-cols-12 items-center gap-2">
              <span className="col-span-5 text-xs text-slate-600">
                line #{l.id} · {l.quantity} units
                {l.target_unit_cost != null && (
                  <span className="block text-slate-400">
                    target {l.target_unit_cost.toFixed(2)}
                  </span>
                )}
              </span>
              <div className="col-span-4">
                <Input
                  inputMode="decimal"
                  placeholder="Unit cost"
                  value={costs[l.id] ?? ""}
                  onChange={(e) => setCosts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                />
              </div>
              <div className="col-span-3">
                <Input
                  inputMode="decimal"
                  placeholder={`Qty (${l.quantity})`}
                  value={quantities[l.id] ?? ""}
                  onChange={(e) =>
                    setQuantities((prev) => ({ ...prev, [l.id]: e.target.value }))
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tax amount" hint="Optional">
            <Input
              inputMode="decimal"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
            />
          </Field>
          <Field label="Lead time (days)" hint="Optional">
            <Input
              inputMode="numeric"
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
            />
          </Field>
        </div>

        <ServerError error={createM.error} />
      </div>
    </Modal>
  );
}

function ConvertForm({
  quote,
  onCancel,
  onConverted,
}: {
  quote: SupplierQuote;
  onCancel: () => void;
  onConverted: () => void;
}) {
  const warehousesQ = useQuery({
    queryKey: ["inventory-warehouses-active"],
    queryFn: () => listWarehouses({ page: 1, page_size: 500, is_active: true }),
  });
  const [warehouseId, setWarehouseId] = useState("");

  const convertM = useMutation({
    mutationFn: () => convertQuoteToPurchaseOrder(quote.id, Number(warehouseId)),
    onSuccess: onConverted,
  });

  const warehouses: Warehouse[] = warehousesQ.data?.items ?? [];
  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title="Convert quote to purchase order"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!warehouseId) return;
              convertM.mutate();
            }}
            disabled={convertM.isPending || !warehouseId}
          >
            {convertM.isPending ? "Converting..." : "Create purchase order"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          A draft purchase order will be created for{" "}
          <span className="font-medium">{quote.supplier_name}</span> totalling{" "}
          <span className="font-mono">
            {quote.total_amount.toFixed(2)} {quote.currency}
          </span>
          . It still needs to go through the approval chain before stock can be
          received.
        </p>
        <Field label="Receiving warehouse">
          <select
            className={selectClass}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">— Select warehouse —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </Field>
        <ServerError error={convertM.error} />
      </div>
    </Modal>
  );
}
