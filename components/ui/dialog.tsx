"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/**
 * Modal dialog with a real focus trap.
 *
 * Behaviour:
 *  - focus moves into the dialog on open and returns to the trigger on close
 *  - Tab / Shift+Tab cycle within the dialog only
 *  - Escape closes
 *  - background scroll is locked, without the layout shifting
 *  - clicking the backdrop closes; clicking inside never does
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional supporting line under the title. */
  description?: ReactNode;
  children: ReactNode;
  /** Action row pinned to the bottom of the dialog. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Colour accent on the header rule — used by destructive confirmations. */
  tone?: "default" | "danger";
}

const SIZE = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  tone = "default",
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  /* Focus management -------------------------------------------------- */
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Prefer the first field over a close button, so typing can start at once.
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    // Defer past the mount so the element is laid out and focusable.
    const raf = requestAnimationFrame(() => target?.focus());

    return () => {
      cancelAnimationFrame(raf);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  /* Scroll lock ------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    // Compensate for the vanishing scrollbar so the page does not jump.
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  /* Keyboard ---------------------------------------------------------- */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      // Wrap around at both ends to keep focus inside the dialog.
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
      onKeyDown={onKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[oklch(0.21_0.015_258/0.45)] motion-safe:animate-[fadeIn_var(--dur-fast)_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface-raised shadow-dialog",
          // Mobile: a bottom sheet. Desktop: a centred panel.
          "rounded-t-xl sm:rounded-xl",
          "border border-line",
          "motion-safe:animate-[slideUp_var(--dur-base)_var(--ease)] sm:motion-safe:animate-[zoomIn_var(--dur-base)_var(--ease)]",
          SIZE[size],
        )}
      >
        <header
          className={cn(
            "flex items-start gap-3 border-b px-4 py-3.5 sm:px-5",
            tone === "danger" ? "border-overdue-border" : "border-line",
          )}
        >
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-md font-semibold text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>
          <Button
            intent="quiet"
            size="icon"
            onClick={onClose}
            aria-label="Đóng"
            className="-mr-1.5 -mt-1"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
              <path
                d="m4 4 8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Button>
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-inset px-4 py-3 sm:px-5">
            {footer}
          </footer>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8%) } to { opacity: 1; transform: none } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.97) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Confirmation dialog — for destructive or ambiguous actions
 * ------------------------------------------------------------------ */

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Huỷ",
  tone = "default",
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      tone={tone}
      footer={
        <>
          <Button intent="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            intent={tone === "danger" ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            data-autofocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children ?? null}
    </Dialog>
  );
}
