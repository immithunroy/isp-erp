import { type ReactNode } from "react";
import { ApiError } from "../lib/api";
import { Card } from "./Card";
import { Spinner } from "./Spinner";

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const msg = error instanceof ApiError ? error.detail ?? error.title : "Failed to load.";
  return <Card className="p-8 text-center text-sm text-red-600">{msg}</Card>;
}

export function NoAccess() {
  return (
    <div className="mx-auto max-w-2xl p-10 text-center text-sm text-slate-500">
      You don&apos;t have permission to view this page.
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="py-10 text-center text-slate-500">
      <Spinner />
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <Card className="p-8 text-center text-sm text-slate-500">{text}</Card>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function ServerError({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof ApiError ? error.detail ?? error.title : "Something went wrong.";
  return <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{msg}</p>;
}