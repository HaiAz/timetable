"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { WEEKDAY_LABELS, formatDayMonth, weekDates } from "@/lib/date";
import type { Session, Student } from "@/lib/types";
import { SessionBlock } from "./session-block";
import {
  buildHourRows,
  DEFAULT_END_HOUR,
  DEFAULT_START_HOUR,
  earliestHour,
  latestHour,
  occupiedHours,
  placeSessions,
} from "./overlap";
import { Button } from "@/components/ui/button";

/**
 * The weekly grid: 7 day columns × 24 hours.
 *
 * Desktop shows all seven days. Below `lg` the grid scrolls horizontally with
 * a sticky hour column; below `sm` the parent switches to a single-day view
 * instead (see `DayColumn` usage in the page).
 *
 * Lưới hiện khung 06:00–24:00 và co chiều cao hàng để cả tuần vừa một màn
 * hình, không phải cuộn dọc. Nếu tuần đang xem có buổi trước 6h thì tự nới
 * xuống, nên không bao giờ ẩn mất buổi học.
 */
export function WeekGrid({
  weekStart,
  sessions,
  studentMap,
  today,
  onSelectSession,
  onSelectSlot,
}: {
  weekStart: string;
  sessions: Session[];
  studentMap: Map<string, Student>;
  /** Today's date as YYYY-MM-DD, or null before hydration. Owned by the page. */
  today: string | null;
  onSelectSession: (session: Session) => void;
  onSelectSlot: (date: string, startTime: string) => void;
}) {
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const [expanded, setExpanded] = useState(false);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const date of dates) map.set(date, []);
    for (const session of sessions) {
      map.get(session.date)?.push(session);
    }
    return map;
  }, [dates, sessions]);

  const occupied = useMemo(() => occupiedHours(sessions), [sessions]);
  const rows = useMemo(() => buildHourRows(occupied, { expanded }), [occupied, expanded]);

  // Tuần này có buổi ngoài khung mặc định không — để giải thích vì sao lưới
  // đang cao hơn bình thường.
  const firstHour = useMemo(() => earliestHour(sessions), [sessions]);
  const lastHour = useMemo(() => latestHour(sessions), [sessions]);
  const hasEarlySession = firstHour !== null && firstHour < DEFAULT_START_HOUR;
  const hasLateSession = lastHour !== null && lastHour >= DEFAULT_END_HOUR;

  // Chiều cao mỗi hàng co lại để cả dải giờ vừa một màn hình, không phải cuộn.
  // Càng nhiều hàng thì hàng càng thấp, nhưng không dưới 2rem để còn đọc được.
  const rowHeight = `max(2rem, (100dvh - 17rem) / ${rows.length})`;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      {/* Day headers — sticky so they survive vertical scrolling */}
      <div className="flex shrink-0 border-b border-line bg-surface-inset">
        <div
          className="shrink-0 border-r border-line"
          style={{ width: "var(--time-col-width)" }}
          aria-hidden="true"
        />
        {dates.map((date, index) => {
          const isToday = date === today;
          return (
            <div
              key={date}
              className={cn(
                "flex min-w-0 flex-1 items-baseline justify-center gap-1 border-r border-line px-1 py-1 text-center last:border-r-0",
                isToday && "bg-primary-bg",
              )}
            >
              <p
                className={cn(
                  "truncate text-2xs font-medium",
                  isToday ? "text-primary" : "text-fg-muted",
                )}
              >
                {WEEKDAY_LABELS[index]}
              </p>
              <p
                className={cn(
                  "font-mono tnum text-xs font-semibold",
                  isToday ? "text-primary" : "text-fg",
                )}
              >
                {formatDayMonth(date)}
                {isToday && <span className="sr-only"> (hôm nay)</span>}
              </p>
            </div>
          );
        })}
      </div>

      {/* Các hàng giờ. Bình thường cả dải vừa màn hình nên không có thanh cuộn;
          khi lưới nới rộng (buổi sớm) hoặc màn hình quá thấp thì cuộn được. */}
      <div
        className="scrollbar-thin relative overflow-y-auto"
        style={{ ["--hour-height" as string]: rowHeight }}
      >
        {rows.map((row) => (
          <div key={row.hour} className="flex">
            {/* Nhãn giờ — dính bên trái khi cuộn ngang trên máy nhỏ */}
            <div
              className="sticky left-0 z-30 flex shrink-0 items-start justify-end border-r border-line bg-surface pr-1.5 pt-0.5"
              style={{ width: "var(--time-col-width)", height: "var(--hour-height)" }}
            >
              <span className="font-mono tnum text-2xs text-fg-subtle">
                {String(row.hour).padStart(2, "0")}:00
              </span>
            </div>

            {dates.map((date) => (
              <HourCell
                key={`${date}-${row.hour}`}
                date={date}
                hour={row.hour}
                isToday={date === today}
                onSelectSlot={onSelectSlot}
                blocks={
                  <HourBlocks
                    hour={row.hour}
                    sessions={sessionsByDate.get(date) ?? []}
                    studentMap={studentMap}
                    onSelectSession={onSelectSession}
                  />
                }
              />
            ))}
          </div>
        ))}
      </div>

      {/* Chân lưới: khung giờ đang hiện + nút xem đủ 24 giờ */}
      <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-inset px-3 py-1.5">
        <span className="text-2xs text-fg-subtle">
          {expanded
            ? "Đang hiện đủ 24 giờ"
            : hasEarlySession && hasLateSession
              ? `Đã nới khung ${String(firstHour).padStart(2, "0")}:00 – ${String(
                  (lastHour ?? DEFAULT_END_HOUR) + 1,
                ).padStart(2, "0")}:00 vì có buổi học ngoài giờ`
              : hasEarlySession
                ? `Đã nới xuống ${String(firstHour).padStart(2, "0")}:00 vì có buổi học sớm`
                : hasLateSession
                  ? `Đã nới lên ${String((lastHour ?? DEFAULT_END_HOUR) + 1).padStart(2, "0")}:00 vì có buổi học muộn`
                  : `Khung giờ ${String(DEFAULT_START_HOUR).padStart(2, "0")}:00 – ${String(DEFAULT_END_HOUR).padStart(2, "0")}:00`}
        </span>
        <Button intent="quiet" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded
            ? `Về khung ${DEFAULT_START_HOUR}:00 – ${DEFAULT_END_HOUR}:00`
            : "Hiện đủ 24 giờ"}
        </Button>
      </div>
    </div>
  );
}

/**
 * The session blocks that *start* within one hour of one day.
 *
 * Vẽ trong đúng hàng giờ của nó (thay vì một lớp phủ cho cả ngày) nên vị trí
 * luôn đúng dù lưới bắt đầu từ giờ nào. Khối dài hơn một giờ sẽ tràn xuống các
 * hàng dưới nhờ `overflow-visible` trên ô.
 */
function HourBlocks({
  hour,
  sessions,
  studentMap,
  onSelectSession,
}: {
  hour: number;
  sessions: Session[];
  studentMap: Map<string, Student>;
  onSelectSession: (session: Session) => void;
}) {
  // Pack the whole day so overlap columns are consistent across hours, then
  // draw only the blocks beginning in this hour.
  const placed = useMemo(() => placeSessions(sessions), [sessions]);
  const startingHere = placed.filter(
    (item) => Math.floor(item.startMinutes / 60) === hour,
  );

  if (startingHere.length === 0) return null;

  return (
    <>
      {startingHere.map((item) => {
        const minuteOffset = item.startMinutes - hour * 60;
        return (
          <SessionBlock
            key={item.session.id}
            // Re-base to this row: 0 = the top of this hour cell.
            placed={{
              ...item,
              startMinutes: minuteOffset,
              endMinutes: item.endMinutes - hour * 60,
            }}
            student={studentMap.get(item.session.studentId)}
            onSelect={onSelectSession}
          />
        );
      })}
    </>
  );
}

function HourCell({
  date,
  hour,
  isToday,
  onSelectSlot,
  blocks,
}: {
  date: string;
  hour: number;
  isToday: boolean;
  onSelectSlot: (date: string, startTime: string) => void;
  blocks?: React.ReactNode;
}) {
  const label = `${String(hour).padStart(2, "0")}:00`;
  return (
    <div
      className={cn(
        "relative min-w-0 flex-1 border-r border-b border-line last:border-r-0",
        // Blocks longer than an hour spill into the rows below.
        "overflow-visible",
        isToday && "bg-primary-bg/25",
      )}
      style={{ height: "var(--hour-height)" }}
    >
      {/* The empty-slot target sits beneath any blocks. */}
      <button
        type="button"
        onClick={() => onSelectSlot(date, label)}
        className={cn(
          "group absolute inset-0 h-full w-full",
          "transition-colors duration-(--dur-fast) hover:bg-primary-bg/60",
        )}
        aria-label={`Thêm buổi học ${label} ngày ${formatDayMonth(date)}`}
      >
        <span className="flex h-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <svg viewBox="0 0 16 16" className="size-3.5 text-primary" fill="none" aria-hidden="true">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {blocks}
    </div>
  );
}

