import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "./Button";

interface NavItem {
  label: string;
  to: string;
  permission?: string;
}

const CORE_ITEMS: NavItem[] = [
  { label: "Users", to: "/users", permission: "core:users:read" },
  { label: "Roles", to: "/roles", permission: "core:roles:read" },
  { label: "Organizations", to: "/organizations", permission: "core:organizations:read" },
  { label: "Audit Logs", to: "/audit-logs", permission: "core:audit-logs:read" },
  { label: "Settings", to: "/settings", permission: "core:settings:read" },
];

const FUTURE_GROUPS: { label: string; items: string[] }[] = [
  { label: "HRM", items: ["Employees", "Departments", "Attendance", "Leave", "Shifts"] },
  { label: "Customers", items: ["Customers", "Locations", "Network Relationships"] },
  { label: "Field Service", items: ["Jobs", "Assignments", "Visits"] },
  {
    label: "Network",
    items: ["Map", "OLT", "Fiber", "TJ Boxes", "Enclosures", "Splitters", "Trace"],
  },
  { label: "Inventory", items: ["Products", "Warehouses", "Stock", "Equipment"] },
  { label: "Procurement", items: ["Suppliers", "Purchase Orders", "Receiving"] },
  { label: "Accounting", items: ["Chart of Accounts", "Journal", "Ledger", "Reports"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { hasPermission, user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleCore = CORE_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="px-4 py-5 font-semibold">ISP Operations ERP</div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-6 text-sm">
          <div>
            <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Overview
            </div>
            <ul className="mt-1 space-y-1">
              <li>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    "block rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100 " +
                    (isActive ? "bg-slate-100 font-medium text-brand" : "")
                  }
                >
                  Dashboard
                </NavLink>
              </li>
            </ul>
          </div>

          {visibleCore.length > 0 && (
            <div>
              <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Core ERP
              </div>
              <ul className="mt-1 space-y-1">
                {visibleCore.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        "block rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100 " +
                        (isActive ? "bg-slate-100 font-medium text-brand" : "")
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {FUTURE_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </div>
              <ul className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="cursor-not-allowed select-none rounded px-2 py-1.5 text-slate-300"
                    title="Available in a later phase"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          <span className="font-semibold">ISP Operations ERP</span>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
        {children}
      </main>

      <div className="fixed right-4 top-3 hidden items-center gap-2 md:flex">
        <span className="text-sm text-slate-500">{user?.full_name}</span>
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </div>
  );
}