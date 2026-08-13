import { type ButtonHTMLAttributes, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("border-b border-slate-200 bg-slate-50", className)} {...props} />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-slate-100", className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("hover:bg-slate-50", className)} {...props} />
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-2.5 text-slate-700", className)} {...props} />;
}

export function Pagination({
  page,
  pages,
  onPage,
  total,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
  total?: number;
}) {
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-slate-500">
      <div>
        {total !== undefined && <span>{total} total &middot; </span>}
        <span>
          Page {page}{pages > 0 ? ` of ${pages}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <PaginationButton onClick={() => onPage(page - 1)} disabled={page <= 1}>
          Prev
        </PaginationButton>
        {page > 1 && (
          <PaginationButton onClick={() => onPage(page - 1)}>{page - 1}</PaginationButton>
        )}
        <PaginationButton disabled className="border-brand bg-brand text-white">
          {page}
        </PaginationButton>
        {page < pages && (
          <PaginationButton onClick={() => onPage(page + 1)}>{page + 1}</PaginationButton>
        )}
        <PaginationButton onClick={() => onPage(page + 1)} disabled={page >= pages}>
          Next
        </PaginationButton>
      </div>
    </div>
  );
}

function PaginationButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded border border-slate-300 px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}