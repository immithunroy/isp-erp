export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand " +
        (className ?? "")
      }
    />
  );
}