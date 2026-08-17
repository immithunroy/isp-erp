import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  listBranches,
  listOrganizations,
  type Organization,
} from "../lib/core-api";
import { listEmployees, type Employee } from "../lib/hrm-api";
import {
  type Customer,
  type CustomerLocation,
  type CustomerLocationCreate,
  type CustomerUpdate,
  type CustomerVisit,
  type CustomerVisitCreate,
  addCustomerLocation,
  createCustomerVisit,
  getCustomer,
  listCustomerLocations,
  listCustomerVisits,
  updateCustomer,
} from "../lib/customers-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

const PAGE_SIZE = 20;

const CUSTOMER_STATUSES: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending_installation", label: "Pending Installation" },
  { value: "suspended", label: "Suspended" },
  { value: "disconnected", label: "Disconnected" },
  { value: "terminated", label: "Terminated" },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active": return "bg-green-100 text-green-700";
    case "pending_installation": return "bg-amber-100 text-amber-700";
    case "suspended": return "bg-orange-100 text-orange-700";
    case "disconnected": return "bg-red-100 text-red-700";
    case "terminated": return "bg-slate-300 text-slate-800";
    default: return "bg-slate-100 text-slate-600";
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type DetailTab = "locations" | "visits";

export function CustomerDetail() {
  const { hasPermission } = useAuth();
  const params = useParams();
  const navigate = useNavigate();
  const customerId = Number(params.id);

  const canRead = hasPermission("customers:read") || hasPermission("customers:write");
  const canWrite = hasPermission("customers:write");

  const [tab, setTab] = useState<DetailTab>("locations");
  const [editOpen, setEditOpen] = useState(false);

  const custQ = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => getCustomer(customerId),
    enabled: canRead && !Number.isNaN(customerId),
  });

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Customer detail"
        subtitle="Customer profile, location history and visits."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/customers")}>Back</Button>
            {canWrite && custQ.data && (
              <Button onClick={() => setEditOpen(true)}>Edit customer</Button>
            )}
          </div>
        }
      />

      {custQ.isLoading ? (
        <LoadingState />
      ) : custQ.isError ? (
        <ErrorState error={custQ.error} />
      ) : custQ.data ? (
        <>
          <CustomerInfoCard customer={custQ.data} />
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-1 border-b border-slate-200 px-3 pt-2">
              <TabButton active={tab === "locations"} onClick={() => setTab("locations")}>Location History</TabButton>
              <TabButton active={tab === "visits"} onClick={() => setTab("visits")}>Visits</TabButton>
            </div>
            <div className="p-4">
              {tab === "locations" && <LocationsSection customerId={custQ.data.id} canWrite={canWrite} />}
              {tab === "visits" && <VisitsSection customerId={custQ.data.id} canWrite={canWrite} />}
            </div>
          </div>
        </>
      ) : (
        <EmptyState text="Customer not found." />
      )}

      {editOpen && custQ.data && (
        <EditCustomerModal
          customer={custQ.data}
          onCancel={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-t border-b-2 px-3 py-2 text-sm font-medium " +
        (active ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700")
      }
    >
      {children}
    </button>
  );
}

function CustomerInfoCard({ customer }: { customer: Customer }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Code", value: <span className="font-mono text-xs">{customer.customer_code}</span> },
    { label: "Name", value: customer.name },
    { label: "Phone", value: customer.phone ?? "—" },
    { label: "Email", value: customer.email ?? "—" },
    { label: "Address", value: customer.address ?? "—" },
    { label: "Status", value: <Badge className={statusBadgeClass(customer.status)}>{customer.status}</Badge> },
    { label: "Installation date", value: fmtDate(customer.installation_date) },
    { label: "Organization", value: `#${customer.organization_id}` },
    { label: "Branch", value: customer.branch_id ? `#${customer.branch_id}` : "—" },
    { label: "Assigned technician", value: customer.assigned_technician_id ? `#${customer.assigned_technician_id}` : "—" },
    { label: "Active", value: customer.is_active ? "Yes" : "No" },
    { label: "Notes", value: customer.notes ?? "—" },
  ];
  return (
    <Card className="p-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="space-y-0.5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{r.label}</div>
            <div className="text-sm text-slate-800">{r.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- Edit customer modal ----------
interface CustomerEditFormValues {
  organization_id: string;
  branch_id: string;
  customer_code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  installation_date: string;
  status: string;
  assigned_technician_id: string;
  notes: string;
  is_active: boolean;
}

function EditCustomerModal({ customer, onCancel }: { customer: Customer; onCancel: () => void }) {
  const qc = useQueryClient();
  const updateM = useMutation({
    mutationFn: (b: CustomerUpdate) => updateCustomer(customer.id, b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customer.id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onCancel();
    },
  });

  const techniciansQ = useQuery({
    queryKey: ["employees", "technicians-all"],
    queryFn: () => listEmployees({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });
  const orgsQ = useQuery({
    queryKey: ["organizations-all"],
    queryFn: () => listOrganizations({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<CustomerEditFormValues>({
    defaultValues: {
      organization_id: String(customer.organization_id),
      branch_id: customer.branch_id ? String(customer.branch_id) : "",
      customer_code: customer.customer_code,
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      installation_date: customer.installation_date ?? "",
      status: customer.status,
      assigned_technician_id: customer.assigned_technician_id ? String(customer.assigned_technician_id) : "",
      notes: customer.notes ?? "",
      is_active: customer.is_active,
    },
  });

  const orgIdStr = watch("organization_id");
  const orgId = orgIdStr ? Number(orgIdStr) : undefined;

  const branchesQ = useQuery({
    queryKey: ["branches", orgId, "cust-edit"],
    queryFn: () => listBranches({ organization_id: orgId as number, page: 1, page_size: 1000 }),
    enabled: !!orgId,
  });

  const onSubmit = (values: CustomerEditFormValues) => {
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      setError("email", { message: "Enter a valid email" });
      return;
    }
    if (values.installation_date && Number.isNaN(new Date(values.installation_date).getTime())) {
      setError("installation_date", { message: "Enter a valid date" });
      return;
    }
    const body: CustomerUpdate = {
      branch_id: values.branch_id ? Number(values.branch_id) : null,
      customer_code: values.customer_code,
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      installation_date: values.installation_date || null,
      status: values.status,
      assigned_technician_id: values.assigned_technician_id ? Number(values.assigned_technician_id) : null,
      notes: values.notes || null,
      is_active: values.is_active,
    };
    updateM.mutate(body);
  };

  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";
  const technicians = techniciansQ.data?.items ?? [];
  const branches = branchesQ.data?.items ?? [];

  return (
    <Modal
      open
      onClose={onCancel}
      title="Edit customer"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="customer-edit-form" disabled={updateM.isPending}>
            {updateM.isPending ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="customer-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Organization" error={errors.organization_id?.message}>
            <select className={selectClass} {...register("organization_id", { required: "Organization is required" })} disabled>
              <option value="">— Select —</option>
              {(orgsQ.data?.items ?? []).map((o: Organization) => (
                <option key={o.id} value={String(o.id)}>{o.name} ({o.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Branch" hint="Optional">
            <select className={selectClass} {...register("branch_id")} disabled={!orgId || branchesQ.isLoading}>
              <option value="">— None —</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name} ({b.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Customer code" error={errors.customer_code?.message}>
            <Input {...register("customer_code", { required: "Customer code is required" })} />
          </Field>
          <Field label="Name" error={errors.name?.message}>
            <Input {...register("name", { required: "Name is required" })} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Installation date" error={errors.installation_date?.message}>
            <Input type="date" {...register("installation_date")} />
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <select className={selectClass} {...register("status", { required: "Status is required" })}>
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned technician" hint="Optional">
            <select className={selectClass} {...register("assigned_technician_id")}>
              <option value="">— None —</option>
              {technicians.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.full_name} ({t.employee_code})</option>
              ))}
            </select>
          </Field>
          <Field label="Address" error={errors.address?.message}>
            <Input {...register("address")} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            className="h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("notes")}
            spellCheck={false}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("is_active")} /> Active
        </label>
        <ServerError error={updateM.error} />
      </form>
    </Modal>
  );
}

// ---------- Locations section ----------
interface LocationFormValues {
  latitude: string;
  longitude: string;
  accuracy: string;
  address: string;
  collection_method: string;
  notes: string;
}

function LocationsSection({ customerId, canWrite }: { customerId: number; canWrite: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const listQ = useQuery({
    queryKey: ["customer-locations", customerId, page],
    queryFn: () => listCustomerLocations({ customer_id: customerId, page, page_size: PAGE_SIZE }),
  });

  const createM = useMutation({
    mutationFn: (b: CustomerLocationCreate) => addCustomerLocation(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-locations", customerId] });
      setModalOpen(false);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Location history</h3>
        {canWrite && <Button size="sm" onClick={() => setModalOpen(true)}>Add location</Button>}
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
                <Th>Latitude</Th>
                <Th>Longitude</Th>
                <Th>Accuracy</Th>
                <Th>Address</Th>
                <Th>Source</Th>
                <Th>Method</Th>
                <Th>Recorded at</Th>
                <Th>Current</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((loc: CustomerLocation) => (
                <Tr key={loc.id}>
                  <Td className="text-slate-400">{loc.id}</Td>
                  <Td className="font-mono text-xs">{loc.latitude.toFixed(6)}</Td>
                  <Td className="font-mono text-xs">{loc.longitude.toFixed(6)}</Td>
                  <Td>{loc.accuracy ?? "—"}</Td>
                  <Td className="max-w-xs truncate" title={loc.address ?? ""}>{loc.address ?? "—"}</Td>
                  <Td>{loc.source}</Td>
                  <Td>{loc.collection_method ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{fmtDateTime(loc.recorded_at)}</Td>
                  <Td>
                    {loc.is_current ? (
                      <Badge className="bg-green-100 text-green-700">Current</Badge>
                    ) : (
                      <Badge>—</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={listQ.data.page} pages={listQ.data.pages} total={listQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No locations recorded for this customer." />
      )}

      {modalOpen && (
        <LocationForm
          customerId={customerId}
          submitting={createM.isPending}
          serverError={createM.error}
          onCancel={() => setModalOpen(false)}
          onSubmit={(b) => createM.mutate(b)}
        />
      )}
    </div>
  );
}

function LocationForm({
  customerId,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  customerId: number;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: CustomerLocationCreate) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LocationFormValues>({
    defaultValues: {
      latitude: "",
      longitude: "",
      accuracy: "",
      address: "",
      collection_method: "",
      notes: "",
    },
  });

  const onSubmitForm = (values: LocationFormValues) => {
    const lat = Number(values.latitude);
    const lon = Number(values.longitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      setError("latitude", { message: "Enter a valid latitude (-90 to 90)" });
      return;
    }
    if (Number.isNaN(lon) || lon < -180 || lon > 180) {
      setError("longitude", { message: "Enter a valid longitude (-180 to 180)" });
      return;
    }
    const body: CustomerLocationCreate = {
      customer_id: customerId,
      latitude: lat,
      longitude: lon,
      accuracy: values.accuracy ? Number(values.accuracy) : undefined,
      address: values.address || undefined,
      collection_method: values.collection_method || undefined,
      notes: values.notes || undefined,
    };
    onSubmit(body);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Add location"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="location-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="location-form" onSubmit={handleSubmit(onSubmitForm)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude" error={errors.latitude?.message} hint="Decimal degrees (-90 to 90)">
            <Input type="number" step="any" {...register("latitude", { required: "Latitude is required" })} />
          </Field>
          <Field label="Longitude" error={errors.longitude?.message} hint="Decimal degrees (-180 to 180)">
            <Input type="number" step="any" {...register("longitude", { required: "Longitude is required" })} />
          </Field>
          <Field label="Accuracy (meters)" error={errors.accuracy?.message}>
            <Input type="number" step="any" min={0} {...register("accuracy")} />
          </Field>
          <Field label="Collection method" hint="Optional, e.g. gps, manual, map">
            <Input {...register("collection_method")} />
          </Field>
        </div>
        <Field label="Address" error={errors.address?.message}>
          <Input {...register("address")} />
        </Field>
        <Field label="Notes">
          <textarea
            className="h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("notes")}
            spellCheck={false}
          />
        </Field>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}

// ---------- Visits section ----------
interface VisitFormValues {
  employee_id: string;
  purpose: string;
  visited_at: string;
  notes: string;
}

function VisitsSection({ customerId, canWrite }: { customerId: number; canWrite: boolean }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const employeesQ = useQuery({
    queryKey: ["employees", "all"],
    queryFn: () => listEmployees({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const listQ = useQuery({
    queryKey: ["customer-visits", customerId, page],
    queryFn: () => listCustomerVisits({ customer_id: customerId, page, page_size: PAGE_SIZE }),
  });

  const createM = useMutation({
    mutationFn: (b: CustomerVisitCreate) => createCustomerVisit(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-visits", customerId] });
      setModalOpen(false);
    },
  });

  const employeeName = useMemo(
    () => new Map((employeesQ.data?.items ?? []).map((e) => [e.id, `${e.full_name} (${e.employee_code})`])),
    [employeesQ.data],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Visit history</h3>
        {canWrite && <Button size="sm" onClick={() => setModalOpen(true)}>Add visit</Button>}
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
                <Th>Visited at</Th>
                <Th>Employee</Th>
                <Th>Purpose</Th>
                <Th>Notes</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((v: CustomerVisit) => (
                <Tr key={v.id}>
                  <Td className="text-slate-400">{v.id}</Td>
                  <Td className="whitespace-nowrap text-slate-700">{fmtDateTime(v.visited_at)}</Td>
                  <Td>{employeeName.get(v.employee_id) ?? `#${v.employee_id}`}</Td>
                  <Td>{v.purpose ?? "—"}</Td>
                  <Td className="max-w-xs truncate" title={v.notes ?? ""}>{v.notes ?? "—"}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={listQ.data.page} pages={listQ.data.pages} total={listQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No visits recorded for this customer." />
      )}

      {modalOpen && (
        <VisitForm
          customerId={customerId}
          employees={employeesQ.data?.items ?? []}
          submitting={createM.isPending}
          serverError={createM.error}
          onCancel={() => setModalOpen(false)}
          onSubmit={(b) => createM.mutate(b)}
        />
      )}
    </div>
  );
}

function VisitForm({
  customerId,
  employees,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  customerId: number;
  employees: Employee[];
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: CustomerVisitCreate) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VisitFormValues>({
    defaultValues: {
      employee_id: "",
      purpose: "",
      visited_at: new Date().toISOString().slice(0, 16),
      notes: "",
    },
  });

  const onSubmitForm = (values: VisitFormValues) => {
    const empId = Number(values.employee_id);
    if (!empId) {
      setError("employee_id", { message: "Employee is required" });
      return;
    }
    if (!values.visited_at) {
      setError("visited_at", { message: "Visited at is required" });
      return;
    }
    const body: CustomerVisitCreate = {
      customer_id: customerId,
      employee_id: empId,
      purpose: values.purpose || undefined,
      visited_at: new Date(values.visited_at).toISOString(),
      notes: values.notes || undefined,
    };
    onSubmit(body);
  };

  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title="Add visit"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="visit-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="visit-form" onSubmit={handleSubmit(onSubmitForm)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employee" error={errors.employee_id?.message}>
            <select className={selectClass} {...register("employee_id", { required: "Employee is required" })}>
              <option value="">— Select —</option>
              {employees.map((e) => (
                <option key={e.id} value={String(e.id)}>{e.full_name} ({e.employee_code})</option>
              ))}
            </select>
          </Field>
          <Field label="Visited at" error={errors.visited_at?.message}>
            <Input type="datetime-local" {...register("visited_at", { required: "Visited at is required" })} />
          </Field>
        </div>
        <Field label="Purpose">
          <Input {...register("purpose")} />
        </Field>
        <Field label="Notes">
          <textarea
            className="h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            {...register("notes")}
            spellCheck={false}
          />
        </Field>
        <ServerError error={serverError} />
      </form>
    </Modal>
  );
}
