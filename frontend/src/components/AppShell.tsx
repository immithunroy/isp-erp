import { type ReactNode } from "react";

const NAV: { label: string; items: string[] }[] = [
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
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="px-4 py-5 font-semibold">ISP Operations ERP</div>
        <nav className="space-y-4 px-2 pb-6 text-sm">
          {NAV.map((group) => (
            <div key={group.label}>
              <div className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </div>
              <ul className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="cursor-not-list-item select-none rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100"
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
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}