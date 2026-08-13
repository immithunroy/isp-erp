import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "../components/Card";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";

interface ReadyResponse {
  status: string;
  checks: { name: string; status: string; detail?: string }[];
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const health = useQuery<ReadyResponse>({
    queryKey: ["health-ready"],
    queryFn: () => apiFetch("/health/ready", { auth: false }),
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome, <span className="font-medium">{user?.full_name}</span> ({user?.email})
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => logout()}>
          Sign out
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>System health</CardTitle>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <p className="text-sm text-slate-500">Checking services...</p>
          ) : health.isError ? (
            <p className="text-sm text-red-600">Unable to reach backend health endpoint.</p>
          ) : (
            <ul className="space-y-2">
              {health.data?.checks.map((c) => (
                <li key={c.name} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{c.name}</span>
                  <Badge
                    className={c.status === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
                  >
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">User ID</dt>
            <dd>{user?.id}</dd>
            <dt className="text-slate-500">Superuser</dt>
            <dd>{user?.is_superuser ? "Yes" : "No"}</dd>
            <dt className="text-slate-500">Roles</dt>
            <dd>{user?.roles.map((r) => r.code).join(", ") || "—"}</dd>
            <dt className="text-slate-500">Permissions</dt>
            <dd>{user?.permissions.length ?? 0}</dd>
          </dl>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Phase 1 foundation only. HRM, Network GIS, Inventory, Procurement and Accounting modules
        arrive in later phases.
      </p>
    </div>
  );
}