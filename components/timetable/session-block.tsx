"use client";

import { cn } from "@/lib/cn";
import { formatDurationShort, formatNumber, formatTimeRange } from "@/lib/format";
import { hexForColor } from "@/lib/colors";
import { amountForSession, sessionMinutes } from "@/lib/billing";
import type { Session, Student } from "@/lib/types";
import type { PlacedSession } from "./overlap";

/**
 * One session on the weekly grid.
 *
 * A taught session is distinguished three ways at once — a checkmark, a solid
 * left rule, and a tinted background — so it never depends on colour alone.
 */
export function SessionBlock({
  placed,
  student,
  onSelect,
  compact = false,
}: {
  placed: PlacedSession;
  student: Student | undefined;
  onSelect: (session: Session) => void;
  /** Mobile single-day view has more width; the grid needs terser text. */
  compact?: boolean;
}) {
  const { session, startMinutes, endMinutes, column, columnCount } = placed;
  const minutes = sessionMinutes(session);
  const amount = amountForSession(session, student);
  // Không chọn màu -> khối để trắng, chỉ dùng viền để phân định.
  const hex = student ? hexForColor(student.color) : null;

  // Position within the day column, in hour-height units.
  const top = (startMinutes / 60) * 100;
  const height = ((endMinutes - startMinutes) / 60) * 100;

  // Side-by-side packing for overlapping sessions.
  const width = 100 / columnCount;
  const left = column * width;

  const name = student?.name ?? "Học sinh đã xoá";
  const timeRange = formatTimeRange(session.startTime, session.endTime);

  // Very short sessions cannot fit three lines of text.
  const tight = endMinutes - startMinutes < 50;

  return (
    <button
      type="button"
      onClick={() => onSelect(session)}
      style={{
        top: `calc(${top / 100} * var(--hour-height))`,
        height: `calc(${height / 100} * var(--hour-height) - 2px)`,
        left: `calc(${left}% + 1px)`,
        width: `calc(${width}% - 2px)`,
        ...(hex ? { ["--sc" as string]: hex } : {}),
      }}
      className={cn(
        "absolute z-10 flex flex-col overflow-hidden rounded-md border-l-[3px] text-left",
        "px-1.5 py-1 transition-[filter,box-shadow] duration-(--dur-fast)",
        "hover:z-20 hover:shadow-md hover:brightness-[0.98]",
        "focus-visible:z-20",
        session.taught
          ? // Đã dạy: nền xanh nhạt + viền đậm + dấu ✓ bên dưới.
            "border-l-taught-border bg-taught-bg text-paid-fg"
          : hex
            ? // Đã xếp lịch, có màu: sắc của học sinh pha rất nhạt làm nền.
              "border-l-(--sc) bg-[color-mix(in_oklch,var(--sc)_12%,var(--surface))] text-fg"
            : // Không chọn màu: nền trắng, viền xám.
              "border-l-line-strong bg-surface text-fg",
        !student && "opacity-60",
      )}
      aria-label={`${name}, ${timeRange}, ${formatDurationShort(minutes)}${
        session.taught ? `, đã dạy, ${formatNumber(amount)} đồng` : ", chưa dạy"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1">
        {session.taught && (
          <svg
            viewBox="0 0 16 16"
            className="size-3 shrink-0"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m3.5 8.5 3 3 6-7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className="min-w-0 flex-1 truncate text-2xs font-semibold leading-tight">
          {name}
        </span>
      </span>

      {!tight && (
        <span className="truncate font-mono tnum text-[0.625rem] leading-tight opacity-80">
          {compact ? timeRange : session.startTime}
          {!compact && <span className="ml-1">{formatDurationShort(minutes)}</span>}
        </span>
      )}

      {!tight && session.taught && amount > 0 && (
        <span className="mt-auto truncate font-mono tnum text-[0.625rem] font-semibold leading-tight">
          {formatNumber(amount)}
        </span>
      )}
    </button>
  );
}
