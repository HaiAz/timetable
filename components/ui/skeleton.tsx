"use client";

import { cn } from "@/lib/cn";

/**
 * Loading placeholders. These mirror the real content's box model so the
 * layout does not jump when data arrives.
 */

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface-inset",
        "motion-safe:animate-pulse",
        className,
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

/** Wrapper that announces loading to assistive tech exactly once. */
export function LoadingRegion({
  label = "Đang tải dữ liệu",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

/** Skeleton for the 4 summary cards on the payment page. */
export function SummaryCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton rows for a data table. */
export function TableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="border-b border-line bg-surface-inset px-4 py-2.5">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 bg-surface px-4 py-3.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            {Array.from({ length: columns - 1 }).map((_, c) => (
              <Skeleton
                key={c}
                className="h-4 flex-1"
                // Vary widths so it reads as content, not a barcode.
                style={{ maxWidth: `${[7, 5, 4, 6, 5][c % 5]}rem` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the weekly timetable grid. */
export function TimetableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {/* Day header row */}
      <div className="flex border-b border-line bg-surface-inset">
        <div className="w-[var(--time-col-width)] shrink-0 border-r border-line" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-line px-2 py-2.5 last:border-r-0">
            <Skeleton className="mx-auto h-3 w-10" />
            <Skeleton className="mx-auto mt-1.5 h-4 w-6" />
          </div>
        ))}
      </div>
      {/* Hour rows, with a few blocks to hint at real content */}
      {Array.from({ length: 8 }).map((_, r) => (
        <div key={r} className="flex" style={{ height: "var(--hour-height)" }}>
          <div className="flex w-[var(--time-col-width)] shrink-0 justify-end border-r border-line pr-2 pt-1">
            <Skeleton className="h-3 w-8" />
          </div>
          {Array.from({ length: 7 }).map((_, c) => (
            <div key={c} className="flex-1 border-r border-b border-line p-1 last:border-r-0">
              {(r * 7 + c) % 6 === 2 && <Skeleton className="h-full w-full" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the student list cards. */
export function StudentListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3.5"
        >
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-36" />
        </div>
      ))}
    </div>
  );
}
