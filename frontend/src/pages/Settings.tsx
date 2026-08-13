import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import {
  type SystemSetting,
  type SystemSettingCreate,
  type SystemSettingUpdate,
  createSystemSetting,
  deleteSystemSetting,
  listSystemSettings,
  updateSystemSetting,
} from "../lib/core-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

const PAGE_SIZE = 20;

export function Settings() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SystemSetting | null>(null);

  const canRead = hasPermission("core:settings:read") || hasPermission("core:settings:write");
  const canWrite = hasPermission("core:settings:write");

  const settingsQ = useQuery({
    queryKey: ["settings", page, search],
    queryFn: () => listSystemSettings({ page, page_size: PAGE_SIZE, search }),
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: SystemSettingCreate) => createSystemSetting(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); close(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: SystemSettingUpdate }) => updateSystemSetting(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); close(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteSystemSetting(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  const close = () => { setModalOpen(false); setEditing(null); };
  const onDelete = (s: SystemSetting) => {
    if (window.confirm(`Delete setting "${s.key}"?`)) deleteM.mutate(s.id);
  };

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="System Settings"
        subtitle="Application-wide configuration values."
        action={canWrite ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Add setting</Button> : undefined}
      />

      <Input
        placeholder="Search by key or category..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-xs"
      />

      {settingsQ.isLoading ? (
        <LoadingState />
      ) : settingsQ.isError ? (
        <ErrorState error={settingsQ.error} />
      ) : settingsQ.data && settingsQ.data.items.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>ID</Th>
                <Th>Key</Th>
                <Th>Category</Th>
                <Th>Value</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {settingsQ.data.items.map((s) => (
                <Tr key={s.id}>
                  <Td className="text-slate-400">{s.id}</Td>
                  <Td className="font-mono text-xs font-medium">{s.key}</Td>
                  <Td>{s.category ? <Badge>{s.category}</Badge> : <span className="text-slate-400">—</span>}</Td>
                  <Td className="max-w-md truncate font-mono text-xs text-slate-600" title={JSON.stringify(s.value)}>
                    {JSON.stringify(s.value)}
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setModalOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(s)}>Delete</Button>
                      </>
                    )}
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={settingsQ.data.page} pages={settingsQ.data.pages} total={settingsQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No settings defined." />
      )}

      {modalOpen && (
        <SettingForm
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

function SettingForm({
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  editing: SystemSetting | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: SystemSettingCreate) => void;
  onSubmitUpdate: (id: number, body: SystemSettingUpdate) => void;
}) {
  const isEdit = editing !== null;

  const [key, setKey] = useState(editing?.key ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [valueText, setValueText] = useState(editing ? JSON.stringify(editing.value, null, 2) : "{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) return;
    try {
      const parsed = JSON.parse(valueText);
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
        setJsonError("Value must be a JSON object, e.g. {\"enabled\": true}");
      } else {
        setJsonError(null);
      }
    } catch {
      setJsonError("Invalid JSON");
    }
  }, [valueText, touched]);

  const onSubmit = () => {
    setTouched(true);
    let parsed: Record<string, unknown>;
    try {
      const v = JSON.parse(valueText);
      if (typeof v !== "object" || Array.isArray(v) || v === null) {
        setJsonError("Value must be a JSON object");
        return;
      }
      parsed = v as Record<string, unknown>;
    } catch {
      setJsonError("Invalid JSON");
      return;
    }
    if (!key.trim()) return;

    const body: SystemSettingCreate = {
      key: key.trim(),
      value: parsed,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (isEdit && editing) onSubmitUpdate(editing.id, body);
    else onSubmitCreate(body);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit setting" : "Add setting"}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Key" error={key.trim() ? undefined : touched ? "Key is required" : undefined}>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. billing.default_currency" />
        </Field>
        <Field label="Category">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. billing" />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Value (JSON object)" error={jsonError ?? undefined}>
          <textarea
            className="h-32 w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            value={valueText}
            onChange={(e) => { setValueText(e.target.value); setTouched(true); }}
            spellCheck={false}
          />
          {isEdit && (
            <p className="pt-1 text-xs text-slate-500">
              Editing existing value — this replaces the entire JSON object.
            </p>
          )}
        </Field>
        <ServerError error={serverError} />
      </div>
    </Modal>
  );
}