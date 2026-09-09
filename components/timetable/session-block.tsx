"use client";

import { cn } from "@/lib/cn";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { store } from "@/lib/store";
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

  const { run } = useData();
  const { toast } = useToast();

  async function toggleTaught(event: React.MouseEvent) {
    event.stopPropagation();
    const next = !session.taught;
    await run(() => store.setSessionTaught(session.id, next));
    toast({
      message: next ? "Đã đánh dấu là đã dạy." : "Đã bỏ đánh dấu đã dạy.",
      tone: "success",
      onUndo: () => void run(() => store.setSessionTaught(session.id, !next)),
    });
  }

  // Position within the day column, in hour-height units.
  const top = (startMinutes / 60) * 100;
  const height = ((endMinutes - startMinutes) / 60) * 100;

  // Side-by-side packing for overlapping sessions.
  const width = 100 / columnCount;
  const left = column * width;

  const name = student?.name ?? "Học sinh đã xoá";
  const timeRange = formatTimeRange(session.startTime, session.endTime);

  return (
    <div
      className="group/block absolute z-10 hover:z-20 focus-within:z-20"
      style={{
        top: `calc(${top / 100} * var(--hour-height))`,
        height: `calc(${height / 100} * var(--hour-height) - 2px)`,
        left: `calc(${left}% + 1px)`,
        width: `calc(${width}% - 2px)`,
        ...(hex ? { ["--sc" as string]: hex } : {}),
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(session)}
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-md border-l-[3px] text-left",
          "px-1.5 py-1 transition-[filter,box-shadow] duration-(--dur-fast)",
          "group-hover/block:shadow-md group-hover/block:brightness-[0.98]",
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
          <span className="shrink-0 truncate font-mono tnum text-[0.625rem] leading-tight opacity-80">
            {compact ? timeRange : session.startTime}
            {!compact && <span className="ml-1">{formatDurationShort(minutes)}</span>}
          </span>
        </span>
      </button>

      {student && (
        <button
          type="button"
          onClick={(event) => void toggleTaught(event)}
          title={session.taught ? "Bỏ đánh dấu đã dạy" : "Đánh dấu đã dạy"}
          aria-label={session.taught ? "Bỏ đánh dấu đã dạy" : "Đánh dấu đã dạy"}
          className={cn(
            "absolute right-0.5 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full border",
            "opacity-0 shadow-sm transition-[opacity,transform] duration-(--dur-fast)",
            "group-hover/block:opacity-100 group-focus-within/block:opacity-100",
            "hover:scale-110",
            session.taught
              ? "border-taught-border bg-surface text-fg-subtle"
              : "border-primary bg-primary text-primary-fg",
          )}
        >
          <svg viewBox="0 0 16 16" className="size-2.5" fill="none" aria-hidden="true">
            {session.taught ? (
              <path
                d="M4.5 4.5l7 7m0-7-7 7"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="m3.5 8.5 3 3 6-7"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}
