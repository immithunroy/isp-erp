export function nowISO(): string {
  return new Date().toISOString();
}

export function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString();
}