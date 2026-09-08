"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "paid" | "unpaid" | "overdue" | "neutral" | "primary" | "taught";

/**
 * Status pills. Every tone pairs a colour with either an icon or distinct
 * border weight, so status never depends on hue alone.
 */
const TONE: Record<Tone, string> = {
  paid: "bg-paid-bg text-paid-fg border-paid-border",
  unpaid: "bg-unpaid-bg text-unpaid-fg border-unpaid-border",
  overdue: "bg-overdue-bg text-overdue-fg border-overdue-border",
  taught: "bg-taught-bg text-paid-fg border-taught-border",
  primary: "bg-primary-bg text-primary border-primary-border",
  neutral: "bg-surface-inset text-fg-muted border-line",
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* Small inline icons used with badges ------------------------------- */

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0", className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0", className)}
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WarnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0", className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 2.5 14.5 13.5H1.5L8 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  );
}
