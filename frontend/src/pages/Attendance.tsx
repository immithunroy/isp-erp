import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "../lib/auth";
import {
  type Attendance,
  type AttendanceCreate,
  createAttendance,
  listAttendance,
} from "../lib/hrm-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, EmptyState, Field, LoadingState, NoAccess, PageHeader, ServerError } from "../components/ui";

interface AttendanceFormValues {
  employee_id: string;
  attendance_type: string;
  date: string;
  local_ts: string;
  notes: string;
}

interface AttendanceFilters {
  employee_id: string;
  date_from: string;
  date_to: string;
}

const ATTENDANCE_TYPES: { value: string; label: string }[] = [
  { value: "check_in", label: "Check In" },
  { value: "check_out", label: "Check Out" },
  { value: "break_resume", label: "Break Resume" },
  { value: "break_end", label: "Break End" },
  { value: "field", label: "Field" },
];

const PAGE_SIZE = 25;

function fmtTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function Attendance() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AttendanceFilters>({ employee_id: "", date_from: "", date_to: "" });
  const [committed, setCommitted] = useState<AttendanceFilters>({ employee_id: "", date_from: "", date_to: "" });
  const [modalOpen, setModalOpen] = useState(false);

  const canRead = hasPermission("hrm:attendance:read") || hasPermission("hrm:attendance:write");
  const canWrite = hasPermission("hrm:attendance:write");

  const listQ = useQuery({
    queryKey: ["attendance", page, committed],
    queryFn: () => {
      const p: Record<string, string | number | boolean | undefined> = { page, page_size: PAGE_SIZE };
      if (committed.employee_id) p.employee_id = Number(committed.employee_id);
      if (committed.date_from) p.date_from = committed.date_from;
      if (committed.date_to) p.date_to = committed.date_to;
      return listAttendance(p);
    },
    enabled: canRead,
  });

  const createM = useMutation({
    mutationFn: (b: AttendanceCreate) => createAttendance(b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); setModalOpen(false); },
  });

  const applyFilters = () => { setCommitted(filters); setPage(1); };
  const resetFilters = () => {
    const empty = { employee_id: "", date_from: "", date_to: "" };
    setFilters(empty);
    setCommitted(empty);
    setPage(1);
  };

  if (!canRead) return <NoAccess />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Attendance"
        subtitle="Employee attendance records and manual entries."
        action={canWrite ? <Button onClick={() => setModalOpen(true)}>Manual entry</Button> : undefined}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Employee ID</label>
            <Input
              type="number"
              value={filters.employee_id}
              onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))}
              className="h-9"
              placeholder="e.g. 12"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Date from</label>
            <Input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Date to</label>
            <Input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
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
                <Th>Employee</Th>
                <Th>Type</Th>
                <Th>Date</Th>
                <Th>Time</Th>
                <Th>Source</Th>
                <Th>GPS acc.</Th>
                <Th>Corrected</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {listQ.data.items.map((a: Attendance) => (
                <Tr key={a.id}>
                  <Td className="text-slate-400">{a.id}</Td>
                  <Td>#{a.employee_id}</Td>
                  <Td><Badge>{a.attendance_type}</Badge></Td>
                  <Td className="whitespace-nowrap">{a.date}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{fmtTs(a.local_ts)}</Td>
                  <Td className="font-mono text-xs">{a.source}</Td>
                  <Td>
                    {a.gps_accuracy != null ? (
                      <span>{Math.round(a.gps_accuracy)}m</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>{a.is_corrected ? <Badge className="bg-amber-100 text-amber-700">corrected</Badge> : "—"}</Td>
                </Tr>
              ))}
            </TableBody>
          </Table>
          <Pagination page={listQ.data.page} pages={listQ.data.pages} total={listQ.data.total} onPage={setPage} />
        </div>
      ) : (
        <EmptyState text="No attendance records match the current filters." />
      )}

      {modalOpen && (
        <AttendanceForm
          submitting={createM.isPending}
          serverError={createM.error}
          onCancel={() => setModalOpen(false)}
          onSubmit={(b) => createM.mutate(b)}
        />
      )}
    </div>
  );
}

function AttendanceForm({
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: {
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmit: (body: AttendanceCreate) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AttendanceFormValues>({
    defaultValues: {
      employee_id: "",
      attendance_type: "check_in",
      date: new Date().toISOString().slice(0, 10),
      local_ts: "",
      notes: "",
    },
  });

  const handleSave = (values: AttendanceFormValues) => {
    const employeeId = Number(values.employee_id);
    if (!employeeId) {
      setError("employee_id", { message: "Employee ID is required" });
      return;
    }
    if (values.local_ts && Number.isNaN(new Date(values.local_ts).getTime())) {
      setError("local_ts", { message: "Enter a valid timestamp" });
      return;
    }
    const localTs = values.local_ts
      ? new Date(values.local_ts).toISOString()
      : new Date().toISOString();
    const body: AttendanceCreate = {
      employee_id: employeeId,
      attendance_type: values.attendance_type,
      date: values.date,
      local_ts: localTs,
      source: "manual",
      notes: values.notes || undefined,
    };
    onSubmit(body);
  };

  const selectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <Modal
      open
      onClose={onCancel}
      title="Manual attendance entry"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="attendance-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="attendance-form" onSubmit={handleSubmit(handleSave)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employee ID" error={errors.employee_id?.message}>
            <Input type="number" min={1} {...register("employee_id", { required: "Employee ID is required" })} />
          </Field>
          <Field label="Attendance type" error={errors.attendance_type?.message}>
            <select className={selectClass} {...register("attendance_type", { required: "Required" })}>
              {ATTENDANCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Date" error={errors.date?.message}>
            <Input type="date" {...register("date", { required: "Date is required" })} />
          </Field>
          <Field label="Local timestamp" hint="Leave blank to use now">
            <Input type="datetime-local" {...register("local_ts")} />
          </Field>
        </div>
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