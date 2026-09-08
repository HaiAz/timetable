"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Surfaces. Cards are reserved for repeated objects, framed tools and summary
 * tiles — not every section on the page.
 */

export function Card({
  children,
  className,
  tone = "plain",
}: {
  children: ReactNode;
  className?: string;
  tone?: "plain" | "raised" | "inset" | "highlighted";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        tone === "plain" && "border-line bg-surface",
        tone === "raised" && "border-line bg-surface-raised shadow-sm",
        tone === "inset" && "border-line bg-surface-inset",
        tone === "highlighted" && "border-primary-border bg-primary-bg",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A single headline figure. The label sits above the value so a row of these
 * scans as a table of contents for the page.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "primary" | "paid" | "unpaid" | "overdue";
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3.5",
        tone === "neutral" && "border-line bg-surface",
        tone === "primary" && "border-primary-border bg-primary-bg",
        tone === "paid" && "border-paid-border bg-paid-bg",
        tone === "unpaid" && "border-unpaid-border bg-unpaid-bg",
        tone === "overdue" && "border-overdue-border bg-overdue-bg",
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon && (
          <span
            className={cn(
              "shrink-0",
              tone === "neutral" && "text-fg-subtle",
              tone === "primary" && "text-primary",
              tone === "paid" && "text-paid-fg",
              tone === "unpaid" && "text-unpaid-fg",
              tone === "overdue" && "text-overdue-fg",
            )}
          >
            {icon}
          </span>
        )}
        <span
          className={cn(
            "text-xs font-medium",
            tone === "neutral" && "text-fg-muted",
            tone === "primary" && "text-primary",
            tone === "paid" && "text-paid-fg",
            tone === "unpaid" && "text-unpaid-fg",
            tone === "overdue" && "text-overdue-fg",
          )}
        >
          {label}
        </span>
      </div>

      <span
        className={cn(
          "font-mono tnum text-xl font-semibold tracking-tight",
          tone === "neutral" && "text-fg",
          tone === "primary" && "text-primary",
          tone === "paid" && "text-paid-fg",
          tone === "unpaid" && "text-unpaid-fg",
          tone === "overdue" && "text-overdue-fg",
        )}
      >
        {value}
      </span>

      {hint && <span className="text-xs text-fg-subtle">{hint}</span>}
    </div>
  );
}

/** Page header: title on the left, actions on the right, wrapping on mobile. */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-1 text-base text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/**
 * Chip màu kèm chữ đầu tên học sinh — nhận diện học sinh xuyên suốt ứng dụng.
 *
 * Không có màu (`color` bỏ trống) thì chip để trắng, viền xám và chữ tối, để
 * vẫn đọc được rõ.
 */
export function StudentAvatar({
  initial,
  color,
  size = "md",
  archived = false,
}: {
  initial: string;
  /** Mã hex, hoặc `null` khi học sinh không chọn màu. */
  color: string | null;
  size?: "sm" | "md" | "lg";
  archived?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" && "size-6 text-2xs",
        size === "md" && "size-9 text-sm",
        size === "lg" && "size-11 text-md",
        color ? "text-white" : "border border-line-strong bg-surface text-fg-muted",
        archived && "opacity-45 grayscale",
      )}
      style={color ? { background: color } : undefined}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
