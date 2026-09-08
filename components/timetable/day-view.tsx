"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { amountForSession, sessionMinutes } from "@/lib/billing";
import { hexForColor } from "@/lib/colors";
import { formatDuration, formatVND, initials } from "@/lib/format";
import type { Session, Student } from "@/lib/types";
import { Badge, CheckIcon, ClockIcon } from "@/components/ui/badge";
import { StudentAvatar } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/empty-state";

/**
 * Single-day agenda for small screens.
 *
 * A 7-column grid is unusable at phone width, so below `sm` the timetable
 * becomes a chronological list for one day. It carries the same information
 * as a grid block, just with room to read it.
 */
export function DayView({
  date,
  sessions,
  studentMap,
  onSelectSession,
  onAddSession,
}: {
  date: string;
  sessions: Session[];
  studentMap: Map<string, Student>;
  onSelectSession: (session: Session) => void;
  onAddSession: (date: string) => void;
}) {
  const ordered = useMemo(
    () =>
      sessions
        .filter((s) => s.date === date)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [sessions, date],
  );

  const totals = useMemo(() => {
    let taught = 0;
    let minutes = 0;
    let amount = 0;
    for (const session of ordered) {
      minutes += sessionMinutes(session);
      if (session.taught) {
        taught++;
        amount += amountForSession(session, studentMap.get(session.studentId));
      }
    }
    return { taught, minutes, amount };
  }, [ordered, studentMap]);

  if (ordered.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-5 py-10 text-center">
        <p className="text-base text-fg-muted">Ngày này chưa có buổi học nào.</p>
        <Button intent="secondary" size="sm" onClick={() => onAddSession(date)}>
          <PlusIcon />
          Thêm buổi học
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {ordered.map((session) => {
        const student = studentMap.get(session.studentId);
        const minutes = sessionMinutes(session);
        const amount = amountForSession(session, student);
        const hex = student ? hexForColor(student.color) : null;

        return (
          <button
            key={session.id}
            type="button"
            onClick={() => onSelectSession(session)}
            style={hex ? { ["--sc" as string]: hex } : undefined}
            className={cn(
              "flex min-h-16 items-center gap-3 rounded-lg border border-l-[3px] px-3 py-2.5 text-left",
              "transition-colors duration-(--dur-fast) hover:bg-surface-hover",
              session.taught
                ? "border-line border-l-taught-border bg-taught-bg"
                : hex
                  ? "border-line border-l-(--sc) bg-surface"
                  : // Không chọn màu: viền xám thay vì màu học sinh.
                    "border-line border-l-line-strong bg-surface",
            )}
          >
            {/* Time rail — the primary sort key, so it leads */}
            <div className="flex w-14 shrink-0 flex-col items-start">
              <span className="font-mono tnum text-base font-semibold text-fg">
                {session.startTime}
              </span>
              <span className="font-mono tnum text-2xs text-fg-subtle">
                {session.endTime}
              </span>
            </div>

            <StudentAvatar
              initial={student ? initials(student.name) : "?"}
              color={hex}
              size="sm"
              archived={student?.archived}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-fg">
                {student?.name ?? "Học sinh đã xoá"}
              </p>
              <p className="truncate text-xs text-fg-subtle">
                {formatDuration(minutes)}
                {session.taught && amount > 0 && ` · ${formatVND(amount)}`}
              </p>
            </div>

            {session.taught ? (
              <Badge tone="taught" icon={<CheckIcon />}>
                Đã dạy
              </Badge>
            ) : (
              <Badge tone="neutral" icon={<ClockIcon />}>
                Chưa
              </Badge>
            )}
          </button>
        );
      })}

      {/* Day footer — a running total so the day can be reconciled at a glance */}
      <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-line bg-surface-inset px-3 py-2 text-sm">
        <span className="text-fg-muted">
          {ordered.length} buổi · {totals.taught} đã dạy
        </span>
        <span className="font-mono tnum font-semibold text-fg">
          {formatVND(totals.amount)}
        </span>
      </div>
    </div>
  );
}

/** Day picker strip for the mobile single-day view. */
export function DayStrip({
  dates,
  selected,
  today,
  sessionCounts,
  onSelect,
}: {
  dates: string[];
  selected: string;
  today: string | null;
  sessionCounts: Map<string, number>;
  onSelect: (date: string) => void;
}) {
  const labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  return (
    <div role="tablist" aria-label="Chọn ngày" className="flex gap-1">
      {dates.map((date, index) => {
        const isSelected = date === selected;
        const isToday = date === today;
        const count = sessionCounts.get(date) ?? 0;
        const dayNumber = Number(date.slice(8, 10));

        return (
          <button
            key={date}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(date)}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-md border",
              "transition-colors duration-(--dur-fast)",
              isSelected
                ? "border-primary bg-primary text-primary-fg"
                : isToday
                  ? "border-primary-border bg-primary-bg text-primary"
                  : "border-line bg-surface text-fg-muted hover:bg-surface-hover",
            )}
          >
            <span className="text-2xs font-medium">{labels[index]}</span>
            <span className="font-mono tnum text-base font-semibold">{dayNumber}</span>
            {/* Session count as dots — readable without colour */}
            <span className="flex h-1.5 items-center gap-0.5">
              {count > 0 &&
                Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-1 rounded-full",
                      isSelected ? "bg-primary-fg" : "bg-fg-subtle",
                    )}
                  />
                ))}
            </span>
            <span className="sr-only">
              {count > 0 ? `${count} buổi học` : "không có buổi học"}
              {isToday ? ", hôm nay" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
