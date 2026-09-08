"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Empty and error states. Both explain *why* the view is empty and offer the
 * next action, rather than just saying "no data".
 */

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary and secondary actions. */
  actions?: ReactNode;
  tone?: "neutral" | "positive" | "error";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        tone === "positive" && "border-paid-border bg-paid-bg",
        tone === "error" && "border-overdue-border bg-overdue-bg",
        tone === "neutral" && "border-line-strong bg-surface",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-full",
            tone === "positive" && "bg-paid-border text-paid-fg",
            tone === "error" && "bg-overdue-border text-overdue-fg",
            tone === "neutral" && "bg-surface-inset text-fg-subtle",
          )}
        >
          {icon}
        </div>
      )}

      <div className="max-w-md">
        <h3
          className={cn(
            "text-md font-semibold",
            tone === "positive" && "text-paid-fg",
            tone === "error" && "text-overdue-fg",
            tone === "neutral" && "text-fg",
          )}
        >
          {title}
        </h3>
        {description && (
          <p
            className={cn(
              "mt-1.5 text-base leading-relaxed",
              tone === "positive" && "text-paid-fg",
              tone === "error" && "text-overdue-fg",
              tone === "neutral" && "text-fg-muted",
            )}
          >
            {description}
          </p>
        )}
      </div>

      {actions && <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

/* Icons for the empty states -------------------------------------- */

export function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 5.6M18 14.5a6.5 6.5 0 0 1 3.5 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} fill="none" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M2.5 10.5h19" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="15.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} fill="none" aria-hidden="true">
      <path
        d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.25" r="1" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4", className)} fill="none" aria-hidden="true">
      <path
        d="M8 3.25v9.5M3.25 8h9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
