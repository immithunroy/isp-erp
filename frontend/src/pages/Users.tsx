import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../lib/auth";
import {
  type RoleDetail,
  type UserCreate,
  type UserDetail,
  type UserUpdate,
  createUser,
  deleteUser,
  listRoles,
  listUsers,
  updateUser,
} from "../lib/core-api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Spinner } from "../components/Spinner";
import { Pagination, Table, TableBody, TableHead, Tr, Th, Td } from "../components/Table";
import { ErrorState, Field, NoAccess, LoadingState, EmptyState, PageHeader, ServerError } from "../components/ui";

const userSchema = z.object({
  email: z.string().email("Enter a valid email"),
  full_name: z.string().min(1, "Full name is required"),
  password: z.string().optional(),
  phone: z.string().optional(),
  is_superuser: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type UserFormValues = z.infer<typeof userSchema>;

const PAGE_SIZE = 20;

export function Users() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserDetail | null>(null);

  const usersQ = useQuery({
    queryKey: ["users", page, search],
    queryFn: () => listUsers({ page, page_size: PAGE_SIZE, search }),
    enabled: hasPermission("core:users:read") || hasPermission("core:users:write"),
  });

  const rolesQ = useQuery({
    queryKey: ["roles-all"],
    queryFn: () => listRoles({ page: 1, page_size: 1000 }),
    staleTime: 60_000,
  });

  const createM = useMutation({
    mutationFn: (b: UserCreate) => createUser(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setModalOpen(false);
    },
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UserUpdate }) => updateUser(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setModalOpen(false);
      setEditing(null);
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (u: UserDetail) => {
    setEditing(u);
    setModalOpen(true);
  };
  const onDelete = (u: UserDetail) => {
    if (window.confirm(`Delete user "${u.email}"? This cannot be undone.`)) {
      deleteM.mutate(u.id);
    }
  };

  if (!hasPermission("core:users:read") && !hasPermission("core:users:write")) {
    return <NoAccess />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <PageHeader
        title="Users"
        subtitle="Manage user accounts and access."
        action={hasPermission("core:users:write") ? <Button onClick={openCreate}>Create user</Button> : undefined}
      />

      <div className="flex">
        <Input
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

      {usersQ.isLoading ? (
        <LoadingState />
      ) : usersQ.isError ? (
        <ErrorState error={usersQ.error} />
      ) : usersQ.data && usersQ.data.items.length > 0 ? (
        <div className="space-y-2">
          <Table>
            <TableHead>
              <Tr>
                <Th>ID</Th>
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Roles</Th>
                <Th>Superuser</Th>
                <Th>Active</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </TableHead>
            <TableBody>
              {usersQ.data.items.map((u) => (
                <Tr key={u.id}>
                  <Td className="text-slate-400">{u.id}</Td>
                  <Td className="font-medium">{u.email}</Td>
                  <Td>{u.full_name}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-slate-400">&mdash;</span>
                      ) : (
                        u.roles.map((r) => <Badge key={r.id}>{r.code}</Badge>)
                      )}
                    </div>
                  </Td>
                  <Td>{u.is_superuser ? "Yes" : "No"}</Td>
                  <Td>
                    <Badge className={u.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}>
                      {u.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {hasPermission("core:users:write") && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(u)}>
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
            page={usersQ.data.page}
            pages={usersQ.data.pages}
            total={usersQ.data.total}
            onPage={setPage}
          />
        </div>
      ) : (
        <EmptyState text="No users found." />
      )}

      {modalOpen && (
        <UserForm
          roles={rolesQ.data?.items ?? []}
          loadingRoles={rolesQ.isLoading}
          editing={editing}
          submitting={createM.isPending || updateM.isPending}
          serverError={createM.error ?? updateM.error}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSubmitCreate={(body) => createM.mutate(body)}
          onSubmitUpdate={(id, body) => updateM.mutate({ id, body })}
        />
      )}
    </div>
  );
}

function UserForm({
  roles,
  loadingRoles,
  editing,
  submitting,
  serverError,
  onCancel,
  onSubmitCreate,
  onSubmitUpdate,
}: {
  roles: RoleDetail[];
  loadingRoles: boolean;
  editing: UserDetail | null;
  submitting: boolean;
  serverError: unknown;
  onCancel: () => void;
  onSubmitCreate: (body: UserCreate) => void;
  onSubmitUpdate: (id: number, body: UserUpdate) => void;
}) {
  const isEdit = editing !== null;

  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>(
    editing ? editing.roles.map((r) => r.id) : [],
  );

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: isEdit
      ? {
          email: editing.email,
          full_name: editing.full_name,
          phone: editing.phone ?? "",
          password: "",
          is_superuser: editing.is_superuser,
          is_active: editing.is_active,
        }
      : { email: "", full_name: "", password: "", phone: "", is_superuser: false, is_active: true },
  });

  const isSuperuser = watch("is_superuser");

  const toggleRole = (id: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const onSubmit = (values: UserFormValues) => {
    if (isEdit && editing) {
      const body: UserUpdate = {
        email: values.email,
        full_name: values.full_name,
        phone: values.phone || null,
        is_superuser: values.is_superuser,
        is_active: values.is_active,
        role_ids: selectedRoleIds,
        permission_ids: [],
      };
      if (values.password && values.password.length > 0) body.password = values.password;
      onSubmitUpdate(editing.id, body);
    } else {
      if (!values.password || values.password.length < 8) {
        setError("password", { message: "Password must be at least 8 characters" });
        return;
      }
      const body: UserCreate = {
        email: values.email,
        full_name: values.full_name,
        password: values.password,
        phone: values.phone || undefined,
        is_superuser: values.is_superuser,
        role_ids: selectedRoleIds,
        permission_ids: [],
      };
      onSubmitCreate(body);
    }
  };

  const watchActive = watch("is_active");

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? "Edit user" : "Create user"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form="user-form" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Full name" error={errors.full_name?.message}>
            <Input {...register("full_name")} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <Input
              type="password"
              placeholder={isEdit ? "Leave blank to keep current" : ""}
              {...register("password")}
            />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register("phone")} />
          </Field>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_superuser")} />
            Superuser (bypasses all permissions)
          </label>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("is_active")} />
              Active
            </label>
          )}
        </div>

        {!isSuperuser && (
          <Field label="Roles">
            {loadingRoles ? (
              <Spinner />
            ) : roles.length === 0 ? (
              <p className="text-sm text-slate-500">No roles available.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(r.id)}
                      onChange={() => toggleRole(r.id)}
                    />
                    <span>{r.name} <span className="text-slate-400">({r.code})</span></span>
                  </label>
                ))}
              </div>
            )}
          </Field>
        )}

        <ServerError error={serverError} />
        {watchActive === false && (
          <p className="text-xs text-amber-600">This user account is currently disabled.</p>
        )}
      </form>
    </Modal>
  );
}