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
  /**
   * Khi có, toast thành hộp xác nhận: hiện nút "Đồng ý" và không tự tắt, nên
   * thao tác chỉ thực sự được lưu khi người dùng bấm đồng ý.
   */
  onConfirm?: () => void;
  /** Nhãn nút xác nhận, mặc định "Đồng ý". */
  confirmLabel?: string;
  /** Nhãn nút hoàn tác, mặc định "Hoàn tác". */
  undoLabel?: string;
  duration: number;
  /** Toast xác nhận không tự tắt — người dùng phải chọn một trong hai. */
  sticky: boolean;
}

interface ToastContextValue {
  toast: (options: {
    message: string;
    tone?: ToastTone;
    onUndo?: () => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    undoLabel?: string;
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
    ({ message, tone = "info", onUndo, onConfirm, confirmLabel, undoLabel, duration }) => {
      const id = nextId.current++;
      setToasts((current) => [
        // Cap the stack so a burst of actions cannot cover the page.
        ...current.slice(-2),
        {
          id,
          message,
          tone,
          onUndo,
          onConfirm,
          confirmLabel,
          undoLabel,
          // Undoable toasts linger longer — there is a decision to make.
          duration: duration ?? (onUndo ? 8000 : 4000),
          sticky: Boolean(onConfirm),
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
          // Giữa màn hình theo chiều ngang, nằm dưới — chỗ mắt dễ bắt được
          // nhất khi vừa bấm xong. Trên mobile phải né thanh tab dưới cùng.
          "bottom-20 sm:bottom-8",
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
    // Toast xác nhận chờ người dùng quyết định, không tự tắt.
    if (paused || toast.sticky) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [paused, toast.sticky, toast.id, toast.duration, onDismiss]);

  return (
    <div
      // Hovering or focusing keeps an undoable toast on screen.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3.5 shadow-lg",
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

      <p className="min-w-0 flex-1 text-base" role="status" aria-live="polite">
        {toast.message}
      </p>

      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onDismiss(toast.id);
          }}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-base font-semibold underline decoration-current/40 underline-offset-2 hover:decoration-current"
        >
          {toast.undoLabel ?? "Hoàn tác"}
        </button>
      )}

      {toast.onConfirm && (
        <button
          type="button"
          onClick={() => {
            toast.onConfirm?.();
            onDismiss(toast.id);
          }}
          className="shrink-0 rounded-md bg-primary px-3.5 py-1.5 text-base font-semibold text-primary-fg shadow-sm hover:bg-primary-hover"
        >
          {toast.confirmLabel ?? "Đồng ý"}
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          // Đóng một toast xác nhận = từ chối, nếu không thay đổi đang chờ sẽ
          // bị bỏ lửng mà không ai hoàn tác.
          if (toast.onConfirm) toast.onUndo?.();
          onDismiss(toast.id);
        }}
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
