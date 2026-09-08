"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Intent = "primary" | "secondary" | "quiet" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const INTENT: Record<Intent, string> = {
  primary:
    "bg-primary text-primary-fg border border-transparent hover:bg-primary-hover active:bg-primary-active shadow-sm",
  secondary:
    "bg-surface text-fg border border-line hover:bg-surface-hover hover:border-line-strong",
  quiet:
    "bg-transparent text-fg-muted border border-transparent hover:bg-surface-hover hover:text-fg",
  danger:
    "bg-transparent text-overdue-fg border border-overdue-border hover:bg-overdue-bg",
  success:
    "bg-transparent text-paid-fg border border-paid-border hover:bg-paid-bg",
};

/**
 * Touch targets are 44px on mobile and tighten on desktop, where a mouse is
 * precise and vertical space is worth more.
 */
const SIZE: Record<Size, string> = {
  sm: "min-h-11 sm:min-h-8 px-3 text-sm gap-1.5",
  md: "min-h-11 sm:min-h-9 px-3.5 text-base gap-2",
  lg: "min-h-12 sm:min-h-10 px-5 text-md gap-2",
  icon: "min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: Intent;
  size?: Size;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  /** Renders as visually active/selected — e.g. a segmented control. */
  selected?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    intent = "secondary",
    size = "md",
    loading = false,
    selected = false,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      data-selected={selected || undefined}
      data-loading={loading || undefined}
      className={cn(
        "inline-flex items-center rounded-md font-medium",
        "transition-colors duration-(--dur-fast)",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-selected:bg-primary-bg data-selected:text-primary data-selected:border-primary-border",
        INTENT[intent],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="size-3.5 shrink-0 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
