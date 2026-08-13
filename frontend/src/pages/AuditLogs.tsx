import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { listAuditLogs } from "../lib/core-api";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, LoadingState, NoAccess, PageHeader } from "../components/ui";

const PAGE_SIZE = 25;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function AuditLogs() {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    user_id: "",
    action: "",
    entity_type: "",
    entity_id: "",
  });
  const [committed, setCommitted] = useState(filters);

  const canRead = hasPermission("core:audit-logs:read");

  const logsQ = useQuery({
    queryKey: ["audit-logs", page, committed],
    queryFn: () => {
      const p: Record<string, string | number | undefined> = { page, page_size: PAGE_SIZE };
      if (committed.user_id) p.user_id = committed.user_id;
      if (committed.action) p.action = committed.action;
      if (committed.entity_type) p.entity_type = committed.entity_type;
      if (committed.entity_id) p.entity_id = committed.entity_id;
      return listAuditLogs(p);
    },
    enabled: canRead,
  });

  if (!canRead) return <NoAccess />;

  const applyFilters = () => {
    setCommitted(filters);
    setPage(1);
  };
  const resetFilters = () => {
    const empty = { user_id: "", action: "", entity_type: "", entity_id: "" };
    setFilters(empty);
    setCommitted(empty);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader title="Audit Logs" subtitle="Immutable record of user actions across the system." />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">User ID</label>
            <Input
              value={filters.user_id}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Action</label>
            <Input
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="h-9"
              placeholder="e.g. create"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Entity type</label>
            <Input
              value={filters.entity_type}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              className="h-9"
              placeholder="e.g. user"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Entity ID</label>
            <Input
              value={filters.entity_id}
              onChange={(e) => setFilters({ ...filters, entity_id: e.target.value })}
              className="h-9"
            />
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

      {logsQ.isLoading ? (
        <LoadingState />
      ) : logsQ.isError ? (
        <ErrorState error={logsQ.error} />
      ) : logsQ.data && logsQ.data.items.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>Created at</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Entity ID</Th>
                <Th>User ID</Th>
                <Th>IP</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {logsQ.data.items.map((log) => (
                <Tr key={log.id}>
                  <Td className="whitespace-nowrap text-slate-500">{fmtDate(log.created_at)}</Td>
                  <Td><Badge>{log.action}</Badge></Td>
                  <Td>{log.entity_type ?? "—"}</Td>
                  <Td>{log.entity_id ?? "—"}</Td>
                  <Td>{log.user_id ?? "—"}</Td>
                  <Td className="font-mono text-xs">{log.ip ?? "—"}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={logsQ.data.page} pages={logsQ.data.pages} total={logsQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No audit log entries match the current filters." />
      )}
    </div>
  );
}