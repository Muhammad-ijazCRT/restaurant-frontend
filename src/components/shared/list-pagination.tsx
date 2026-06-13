"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const LIST_PAGE_SIZE = 10;

export function paginateList<T>(items: T[], page: number, pageSize = LIST_PAGE_SIZE) {
  if (items.length <= pageSize) {
    return {
      pageItems: items,
      page: 1,
      totalPages: 1,
      showPagination: false,
      totalItems: items.length,
    };
  }

  const totalPages = Math.ceil(items.length / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    showPagination: true,
    totalItems: items.length,
  };
}

export function ListPagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t px-5 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <span>
        Showing {(page - 1) * LIST_PAGE_SIZE + 1}–{Math.min(page * LIST_PAGE_SIZE, totalItems)} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="min-w-[5.5rem] text-center">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function PaginatedSlice<T>({
  items,
  children,
  paginationClassName,
  resetKey,
}: {
  items: T[];
  children: (pageItems: T[]) => ReactNode;
  paginationClassName?: string;
  resetKey?: string | number;
}) {
  const [page, setPage] = useState(1);
  const { pageItems, page: safePage, totalPages, showPagination, totalItems } = paginateList(items, page);

  useEffect(() => {
    setPage(1);
  }, [items.length, resetKey]);

  return (
    <>
      {children(pageItems)}
      {showPagination ? (
        <ListPagination
          page={safePage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          className={paginationClassName}
        />
      ) : null}
    </>
  );
}

export function PortalTableScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("portal-table-scroll", className)}>{children}</div>;
}
