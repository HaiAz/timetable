"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ *
 * Field wrapper — owns the label/hint/error relationship
 * ------------------------------------------------------------------ */

export interface FieldProps {
  label: string;
  htmlFor?: string;
  /** Explanatory text below the control. */
  hint?: ReactNode;
  /** Validation message. Presence switches the control to its invalid style. */
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
        {required && (
          <span className="ml-0.5 text-overdue" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-overdue-fg" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Field + control wired together: generates the id, links the description and
 * error via aria, and sets aria-invalid. Use this rather than hand-wiring.
 */
export function useFieldIds(error?: string, hint?: ReactNode) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return { id, errorId, hintId, describedBy, invalid: Boolean(error) };
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

const CONTROL_BASE = cn(
  "w-full rounded-md border bg-surface text-fg",
  "min-h-11 sm:min-h-9 px-3 text-base",
  "placeholder:text-fg-subtle",
  "transition-colors duration-(--dur-fast)",
  "disabled:cursor-not-allowed disabled:bg-surface-inset disabled:text-fg-subtle",
  "aria-invalid:border-overdue aria-invalid:bg-overdue-bg",
  "border-line hover:border-line-strong",
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(CONTROL_BASE, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(CONTROL_BASE, "min-h-20 resize-y py-2 leading-relaxed", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            CONTROL_BASE,
            // Room for the chevron; native appearance removed for consistency.
            "cursor-pointer appearance-none pr-9",
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  },
);

/** Time input — accepts arbitrary HH:mm, not snapped to increments. */
export const TimeInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TimeInput({ className, ...rest }, ref) {
    return (
      <Input
        ref={ref}
        type="time"
        // step=60 lets the browser accept any minute value.
        step={60}
        className={cn("font-mono tnum", className)}
        {...rest}
      />
    );
  },
);

/* ------------------------------------------------------------------ *
 * Checkbox / switch
 * ------------------------------------------------------------------ */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  hint?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className, ...rest },
  ref,
) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          "mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm border-line",
          "accent-[var(--primary)]",
        )}
        {...rest}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-base text-fg">
          {label}
        </label>
        {hint && <span className="text-xs text-fg-subtle">{hint}</span>}
      </div>
    </div>
  );
});

/**
 * Ô chọn ngày. Dùng `<input type="date">` của trình duyệt để có lịch bật lên
 * sẵn, giúp chọn ngày ở tháng cũ mà không phải điều hướng thời khoá biểu.
 */
export const DateInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    value: string;
    onChange: (value: string) => void;
  }
>(function DateInput({ value, onChange, className, ...rest }, ref) {
  return (
    <Input
      ref={ref}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("font-mono tnum", className)}
      {...rest}
    />
  );
});
