import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import {
  traceCore,
  traceCustomerToOlt,
  traceOltToCustomers,
  type TraceNode,
  type TraceResult,
  type TraceResultList,
} from "../lib/trace-api";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/Card";
import { Input } from "../components/Input";
import { Spinner } from "../components/Spinner";
import { ErrorState, NoAccess, PageHeader } from "../components/ui";

type TraceType = "customer" | "olt" | "core";

interface TraceTypeOption {
  value: TraceType;
  label: string;
  idLabel: string;
  placeholder: string;
}

const TRACE_TYPE_OPTIONS: TraceTypeOption[] = [
  {
    value: "customer",
    label: "Customer → OLT",
    idLabel: "Customer ID",
    placeholder: "e.g. 42",
  },
  {
    value: "olt",
    label: "OLT → Customers",
    idLabel: "OLT Asset ID",
    placeholder: "e.g. 7",
  },
  {
    value: "core",
    label: "Core Trace",
    idLabel: "Core ID",
    placeholder: "e.g. 128",
  },
];

const NODE_KIND_CONFIG: Record<string, { label: string; border: string; badge: string }> = {
  customer: {
    label: "Customer",
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700",
  },
  network_asset: {
    label: "Network Asset",
    border: "border-l-purple-500",
    badge: "bg-purple-100 text-purple-700",
  },
  fiber_cable: {
    label: "Fiber Cable",
    border: "border-l-orange-500",
    badge: "bg-orange-100 text-orange-700",
  },
  fiber_core: {
    label: "Fiber Core",
    border: "border-l-yellow-500",
    badge: "bg-yellow-100 text-yellow-800",
  },
  splice: {
    label: "Splice",
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-700",
  },
  splitter_port: {
    label: "Splitter Port",
    border: "border-l-cyan-500",
    badge: "bg-cyan-100 text-cyan-700",
  },
  customer_network_link: {
    label: "Customer Link",
    border: "border-l-indigo-500",
    badge: "bg-indigo-100 text-indigo-700",
  },
};

const OLT_KIND_CONFIG = {
  label: "Network Asset (OLT)",
  border: "border-l-green-500",
  badge: "bg-green-100 text-green-700",
};

function kindConfig(kind: string, detail: Record<string, unknown> | null) {
  const base = NODE_KIND_CONFIG[kind] ?? {
    label: kind,
    border: "border-l-slate-400",
    badge: "bg-slate-100 text-slate-700",
  };
  if (kind === "network_asset" && detail && String(detail.asset_type ?? "") === "olt") {
    return OLT_KIND_CONFIG;
  }
  return base;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function TraceNodeCard({ node, index }: { node: TraceNode; index: number }) {
  const cfg = kindConfig(node.kind, node.detail);
  const entries = node.detail ? Object.entries(node.detail) : [];

  return (
    <div
      className={`rounded-md border border-slate-200 border-l-4 bg-white p-3 shadow-sm ${cfg.border}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
            {index + 1}
          </span>
          <span className="font-medium text-slate-800">{node.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cfg.badge}>{cfg.label}</Badge>
          <span className="font-mono text-xs text-slate-400">#{node.id}</span>
        </div>
      </div>
      {entries.length > 0 && (
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-1">
              <dt className="text-slate-400">{key}:</dt>
              <dd className="break-all text-slate-600">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function ArrowConnector() {
  return (
    <div className="flex justify-center py-1" aria-hidden="true">
      <svg
        className="h-5 w-5 text-slate-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="6 13 12 19 18 13" />
      </svg>
    </div>
  );
}

function TraceResultView({ result }: { result: TraceResult }) {
  if (!result.found) {
    return (
      <Card className="p-6 text-center text-sm text-amber-700">
        {result.error ?? "Trace not found: no path could be resolved for the given ID."}
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Badge className="bg-green-100 text-green-700">Trace complete</Badge>
        <span>{result.nodes.length} node{result.nodes.length === 1 ? "" : "s"}</span>
        {result.direction && <span className="text-slate-400">· {result.direction}</span>}
      </div>
      {result.nodes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">
          No nodes returned for this trace.
        </Card>
      ) : (
        <div>
          {result.nodes.map((node, i) => (
            <div key={`${node.kind}-${node.id}-${i}`}>
              <TraceNodeCard node={node} index={i} />
              {i < result.nodes.length - 1 && <ArrowConnector />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type TraceData = TraceResult | TraceResultList;

function isTraceResultList(data: TraceData): data is TraceResultList {
  return "results" in data;
}

export function NetworkTrace() {
  const { hasPermission } = useAuth();
  const canRead =
    hasPermission("network:map:read") ||
    hasPermission("network:assets:read") ||
    hasPermission("network:fiber:read");

  const [traceType, setTraceType] = useState<TraceType>("customer");
  const [idInput, setIdInput] = useState("");
  const [submitted, setSubmitted] = useState<{ type: TraceType; id: number } | null>(null);

  const option = TRACE_TYPE_OPTIONS.find((o) => o.value === traceType) ?? TRACE_TYPE_OPTIONS[0];

  const traceQ = useQuery<TraceData>({
    queryKey: ["network-trace", submitted?.type, submitted?.id],
    queryFn: () => {
      if (!submitted) throw new Error("No submission");
      if (submitted.type === "customer") return traceCustomerToOlt(submitted.id);
      if (submitted.type === "olt") return traceOltToCustomers(submitted.id);
      return traceCore(submitted.id);
    },
    enabled: submitted !== null,
    retry: false,
  });

  if (!canRead) return <NoAccess />;

  const handleTrace = () => {
    const id = Number(idInput.trim());
    if (!idInput.trim() || Number.isNaN(id) || id <= 0) return;
    setSubmitted({ type: traceType, id });
  };

  const oltResults: TraceResult[] =
    submitted?.type === "olt" && traceQ.data && isTraceResultList(traceQ.data)
      ? traceQ.data.results
      : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <PageHeader
        title="Network Trace"
        subtitle="Trace the fiber path between customers, OLTs, and cores."
      />

      <Card>
        <CardHeader>
          <CardTitle>Trace query</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Trace type</label>
            <div className="flex flex-wrap gap-2">
              {TRACE_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={
                    "cursor-pointer rounded-md border px-3 py-1.5 text-sm " +
                    (traceType === opt.value
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")
                  }
                >
                  <input
                    type="radio"
                    name="trace-type"
                    value={opt.value}
                    checked={traceType === opt.value}
                    onChange={() => {
                      setTraceType(opt.value);
                      setSubmitted(null);
                    }}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">{option.idLabel}</label>
              <Input
                inputMode="numeric"
                placeholder={option.placeholder}
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleTrace();
                  }
                }}
              />
            </div>
            <Button onClick={handleTrace} disabled={!idInput.trim()}>
              Trace
            </Button>
          </div>
        </CardContent>
      </Card>

      {submitted && traceQ.isLoading && (
        <Card className="flex items-center gap-2 p-6 text-sm text-slate-500">
          <Spinner /> Tracing path...
        </Card>
      )}

      {submitted && traceQ.isError && <ErrorState error={traceQ.error} />}

      {submitted && traceQ.data && (
        <Card>
          <CardHeader>
            <CardTitle>Trace results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitted.type === "olt" ? (
              oltResults.length === 0 ? (
                <Card className="p-6 text-center text-sm text-slate-500">
                  No customer paths found from this OLT.
                </Card>
              ) : (
                <div className="space-y-6">
                  {oltResults.map((r, i) => (
                    <div key={i} className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Path {i + 1}
                      </div>
                      <TraceResultView result={r} />
                    </div>
                  ))}
                </div>
              )
            ) : (
              <TraceResultView result={traceQ.data as TraceResult} />
            )}
          </CardContent>
        </Card>
      )}

      {!submitted && (
        <Card className="p-6 text-center text-sm text-slate-500">
          Select a trace type, enter an ID, and click Trace to visualize the path.
        </Card>
      )}
    </div>
  );
}
