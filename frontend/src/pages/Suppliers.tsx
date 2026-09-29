import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import { listOrganizations, type Organization } from "../lib/core-api";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
  type Supplier,
  type SupplierCreate,
  type SupplierUpdate,
} from "../lib/procurement-api";
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

interface SupplierFilters {
  organization_id: string;
  category: string;
  is_active: string;
}

const EMPTY_FILTERS: SupplierFilters = { organization_id: "", category: "", is_active: "" };

export function Suppliers() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<SupplierFilters>(EMPTY_FILTERS);
  const [committed, setCommitted] = useState<SupplierFilters>(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const canRead =
    hasPermission("procurement:suppliers:read") ||
    hasPermission("procurement:suppliers:write");
  const canWrite = hasPermission("procurement:suppliers:write");

  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["procurement-suppliers", page, search, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = {
        page,
        page_size: PAGE_SIZE,
        search,
      };
      if (committed.organization_id) p.organization_id = committed.organization_id;
      if (committed.category) p.category = committed.category;
      if (committed.is_active) p.is_active = committed.is_active;
      return listSuppliers(p);
    },
    enabled: canRead,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["procurement-suppliers"] });
  };
  const createM = useMutation({
    mutationFn: (b: SupplierCreate) => createSupplier(b),
    onSuccess: () => {
      invalidate();
      close();
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: SupplierUpdate }) =>
      updateSupplier(id, body),
    onSuccess: () => {
      invalidate();
      close();
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteSupplier(id),
    onSuccess: invalidate,
  });

  const close = () => {
    setModalOpen(false);
    setEditing(null);
  };
  const onDelete = (s: Supplier) => {
    if (window.confirm(`Delete supplier "${s.name}" (${s.code})?`)) deleteM.mutate(s.id);
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

  const orgName = useMemo(
    () => new Map((orgsQ.data?.items ?? []).map((o) => [o.id, o.name])),
    [orgsQ.data],
  );

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Suppliers"
        subtitle="Vendors that can be invited to quote on requests for quotation."
        action={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Create supplier
            </Button>
          ) : undefined
        }
      />

      <Input
        placeholder="Search by code, name, contact or email..."
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
            <Input
              placeholder="e.g. fiber"
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            />
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
                <Th>Contact</Th>
                <Th>Category</Th>
                <Th>Terms</Th>
                <Th>Lead time</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((s) => (
                <Tr key={s.id}>
                  <Td className="text-slate-400">{s.id}</Td>
                  <Td className="font-mono text-xs">{s.code}</Td>
                  <Td className="font-medium">{s.name}</Td>
                  <Td className="text-slate-500">
                    {orgName.get(s.organization_id) ?? `#${s.organization_id}`}
                  </Td>
                  <Td className="text-slate-500">
                    {s.contact_name ?? "—"}
                    {s.email && (
                      <div className="text-xs text-slate-400">{s.email}</div>
                    )}
                  </Td>
                  <Td className="text-slate-500">{s.category ?? "—"}</Td>
                  <Td className="text-slate-500">{s.payment_terms ?? "—"}</Td>
                  <Td className="text-slate-500">
                    {s.lead_time_days != null ? `${s.lead_time_days} d` : "—"}
                  </Td>
                  <Td>
                    <Badge
                      className={
                        s.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-700"
                      }
                    >
                      {s.is_active ? "active" : "inactive"}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {canWrite && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(s);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => onDelete(s)}
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
        <EmptyState text="No suppliers found." />
      )}

      <ServerError error={deleteM.isError ? deleteM.error : null} />

      {modalOpen && (
        <SupplierForm
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

interface SupplierFormValues {
  organization_id: string;
  code: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  payment_terms: string;
  lead_time_days: string;
  tax_id: string;
  bank_account: string;
  notes: string;
  is_active: boolean;
}

function SupplierForm({
  organizations,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  organizations: Organization[];
  editing: Supplier | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: SupplierCreate) => void;
  onSubmitUpdate: (id: number, body: SupplierUpdate) => void;
}) {
  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    defaultValues: isEdit
      ? {
          organization_id: String(editing.organization_id),
          code: editing.code,
          name: editing.name,
          contact_name: editing.contact_name ?? "",
          email: editing.email ?? "",
          phone: editing.phone ?? "",
          address: editing.address ?? "",
          category: editing.category ?? "",
          payment_terms: editing.payment_terms ?? "",
          lead_time_days:
            editing.lead_time_days != null ? String(editing.lead_time_days) : "",
          tax_id: editing.tax_id ?? "",
          bank_account: editing.bank_account ?? "",
          notes: editing.notes ?? "",
          is_active: editing.is_active,
        }
      : {
          organization_id: "",
          code: "",
          name: "",
          contact_name: "",
          email: "",
          phone: "",
          address: "",
          category: "",
          payment_terms: "",
          lead_time_days: "",
          tax_id: "",
          bank_account: "",
          notes: "",
          is_active: true,
        },
  });

  const onSubmit = (values: SupplierFormValues) => {
    const organization_id = Number(values.organization_id);
    if (!organization_id) return;
    const lead_time_days =
      values.lead_time_days === "" ? null : Number(values.lead_time_days);
    if (lead_time_days !== null && Number.isNaN(lead_time_days)) return;

    const shared = {
      code: values.code,
      name: values.name,
      contact_name: values.contact_name || null,
      email: values.email || null,
      phone: values.phone || null,
      address: values.address || null,
      category: values.category || null,
      payment_terms: values.payment_terms || null,
      lead_time_days,
      tax_id: values.tax_id || null,
      bank_account: values.bank_account || null,
      is_active: values.is_active,
      notes: values.notes || null,
    };

    if (isEdit && editing) {
      onSubmitUpdate(editing.id, shared);
    } else {
      onSubmitCreate({ organization_id, ...shared });
    }
  };

  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit supplier" : "Create supplier"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" form="procurement-supplier-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form
        id="procurement-supplier-form"
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
            <Input {...register("code", { required: "Code is required" })} disabled={isEdit} />
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Contact name" hint="Optional">
            <Input {...register("contact_name")} />
          </Field>
          <Field label="Email" hint="Optional">
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Phone" hint="Optional">
            <Input {...register("phone")} />
          </Field>
          <Field label="Category" hint="Optional">
            <Input {...register("category")} />
          </Field>
          <Field label="Payment terms" hint="Optional">
            <Input {...register("payment_terms")} />
          </Field>
          <Field label="Lead time (days)" hint="Optional">
            <Input inputMode="numeric" {...register("lead_time_days")} />
          </Field>
          <Field label="Tax ID" hint="Optional">
            <Input {...register("tax_id")} />
          </Field>
        </div>
        <Field label="Address" hint="Optional">
          <Input {...register("address")} />
        </Field>
        <Field label="Bank account" hint="Optional">
          <Input {...register("bank_account")} />
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
