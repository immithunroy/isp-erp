import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Users } from "./pages/Users";
import { Roles } from "./pages/Roles";
import { Organizations } from "./pages/Organizations";
import { AuditLogs } from "./pages/AuditLogs";
import { Settings } from "./pages/Settings";
import { Employees } from "./pages/Employees";
import { Designations } from "./pages/Designations";
import { Shifts } from "./pages/Shifts";
import { Holidays } from "./pages/Holidays";
import { Leave } from "./pages/Leave";
import { Attendance } from "./pages/Attendance";
import { AppShell } from "./components/AppShell";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell>
              <Dashboard />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/users"
        element={
          <Protected>
            <AppShell>
              <Users />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/roles"
        element={
          <Protected>
            <AppShell>
              <Roles />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/organizations"
        element={
          <Protected>
            <AppShell>
              <Organizations />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <Protected>
            <AppShell>
              <AuditLogs />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <AppShell>
              <Settings />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/employees"
        element={
          <Protected>
            <AppShell>
              <Employees />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/designations"
        element={
          <Protected>
            <AppShell>
              <Designations />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/shifts"
        element={
          <Protected>
            <AppShell>
              <Shifts />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/holidays"
        element={
          <Protected>
            <AppShell>
              <Holidays />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/leave"
        element={
          <Protected>
            <AppShell>
              <Leave />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path="/attendance"
        element={
          <Protected>
            <AppShell>
              <Attendance />
            </AppShell>
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}