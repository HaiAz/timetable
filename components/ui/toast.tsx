"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { CheckIcon, WarnIcon } from "./badge";

/**
 * Toasts, primarily to carry the Undo affordance for actions like marking a
 * month as paid. Rendered in a polite live region so the message is announced
 * without stealing focus; the Undo button remains reachable by Tab.
 */

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** When set, an "Hoàn tác" button appears and runs this on click. */
  onUndo?: () => void;
  duration: number;
}

interface ToastContextValue {
  toast: (options: {
    message: string;
    tone?: ToastTone;
    onUndo?: () => void;
    duration?: number;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ message, tone = "info", onUndo, duration }) => {
      const id = nextId.current++;
      setToasts((current) => [
        // Cap the stack so a burst of actions cannot cover the page.
        ...current.slice(-2),
        {
          id,
          message,
          tone,
          onUndo,
          // Undoable toasts linger longer — there is a decision to make.
          duration: duration ?? (onUndo ? 8000 : 4000),
        },
      ]);
    },
    [],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4",
          // Above the mobile tab bar; bottom-right on desktop.
          "bottom-20 sm:bottom-4 sm:items-end sm:px-4",
        )}
        role="region"
        aria-label="Thông báo"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [paused, toast.id, toast.duration, onDismiss]);

  return (
    <div
      // Hovering or focusing keeps an undoable toast on screen.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-lg border px-3.5 py-2.5 shadow-md",
        "motion-safe:animate-[toastIn_var(--dur-base)_var(--ease)]",
        toast.tone === "success" &&
          "border-paid-border bg-paid-bg text-paid-fg",
        toast.tone === "error" &&
          "border-overdue-border bg-overdue-bg text-overdue-fg",
        toast.tone === "info" && "border-line bg-surface-raised text-fg",
      )}
    >
      {toast.tone === "success" && <CheckIcon />}
      {toast.tone === "error" && <WarnIcon />}

      <p className="min-w-0 flex-1 text-sm" role="status" aria-live="polite">
        {toast.message}
      </p>

      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onDismiss(toast.id);
          }}
          className="shrink-0 rounded-sm px-2 py-1 text-sm font-semibold underline decoration-current/40 underline-offset-2 hover:decoration-current"
        >
          Hoàn tác
        </button>
      )}

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Đóng thông báo"
        className="shrink-0 rounded-sm p-1 opacity-60 hover:opacity-100"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98) }
          to { opacity: 1; transform: none }
        }
      `}</style>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast phải được dùng bên trong <ToastProvider>.");
  }
  return context;
}
