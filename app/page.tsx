"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData, useStudentMap } from "@/components/data-provider";
import { WeekGrid } from "@/components/timetable/week-grid";
import { DayStrip, DayView } from "@/components/timetable/day-view";
import {
  SessionDialog,
  type SessionDialogMode,
} from "@/components/timetable/session-dialog";
import { ApplyLastWeekDialog } from "@/components/timetable/apply-last-week-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { TimetableSkeleton } from "@/components/ui/skeleton";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import {
  CalendarIcon,
  EmptyState,
  PlusIcon,
  UsersIcon,
} from "@/components/ui/empty-state";
import {
  addDays,
  formatWeekRange,
  startOfWeek,
  weekDates,
} from "@/lib/date";
import { amountForSession, sessionMinutes, toTimeString, toMinutes } from "@/lib/billing";
import { formatDuration, formatVND } from "@/lib/format";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useToday } from "@/lib/use-client-date";
import { resolveSelectedDay } from "@/lib/selected-day";

/**
 * Timetable — the main page.
 *
 * Desktop: a 7-day × 24-hour grid.
 * Mobile: a single-day agenda with a day-picker strip, because a 7-column
 * grid is not usable at phone width.
 */
export default function TimetablePage() {
  const { data, isLoading } = useData();
  const studentMap = useStudentMap();

  // `null` during SSR and the first client render — the viewer's local date is
  // not knowable on the server, so it must not influence the initial markup.
  const today = useToday();

  // Week and day overrides. Until the user navigates, both follow `today`.
  const [weekOverride, setWeekOverride] = useState<string | null>(null);
  const [dayOverride, setDayOverride] = useState<string | null>(null);

  const [dialog, setDialog] = useState<SessionDialogMode | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const weekStart = weekOverride ?? (today ? startOfWeek(today) : null);

  // Ngày đang chọn luôn nằm trong tuần đang xem — xem lib/selected-day.ts.
  const selectedDay = resolveSelectedDay(weekStart, today, dayOverride);

  const dates = useMemo(
    () => (weekStart ? weekDates(weekStart) : []),
    [weekStart],
  );

  const weekSessions = useMemo(() => {
    if (!weekStart) return [];
    const set = new Set(dates);
    return data.sessions.filter((s) => set.has(s.date));
  }, [data.sessions, dates, weekStart]);

  const sessionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of weekSessions) {
      map.set(session.date, (map.get(session.date) ?? 0) + 1);
    }
    return map;
  }, [weekSessions]);

  const weekTotals = useMemo(() => {
    let taught = 0;
    let minutes = 0;
    let amount = 0;
    for (const session of weekSessions) {
      minutes += sessionMinutes(session);
      if (session.taught) {
        taught++;
        amount += amountForSession(session, studentMap.get(session.studentId));
      }
    }
    return { count: weekSessions.length, taught, minutes, amount };
  }, [weekSessions, studentMap]);

  const activeStudentCount = data.students.filter((s) => !s.archived).length;
  const isThisWeek = Boolean(today && weekStart && startOfWeek(today) === weekStart);

  /* Handlers ---------------------------------------------------------- */

  function openSlot(date: string, startTime: string) {
    // Default a new session to the student's usual length where possible;
    // 60 minutes is a safe generic default.
    const end = toTimeString(Math.min(toMinutes(startTime) + 60, 23 * 60 + 59));
    setDialog({ kind: "create", date, startTime, endTime: end });
  }

  function openSession(session: Session) {
    setDialog({ kind: "edit", session });
  }

  /* Loading ----------------------------------------------------------- */
  if (isLoading || !weekStart || !selectedDay) {
    return (
      <div className="mx-auto flex max-w-[100rem] flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-52" />
        </div>
        <LoadingRegion label="Đang tải thời khoá biểu">
          <TimetableSkeleton />
        </LoadingRegion>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-4">
      <PageHeader
        title="Thời khoá biểu"
        description={
          <span className="font-mono tnum">{formatWeekRange(weekStart)}</span>
        }
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-line bg-surface p-0.5">
              <Button
                intent="quiet"
                size="icon"
                onClick={() => setWeekOverride(addDays(weekStart, -7))}
                aria-label="Tuần trước"
              >
                <ChevronLeft />
              </Button>
              <Button
                intent="quiet"
                size="sm"
                onClick={() => {
                  // Clearing both overrides snaps back to following today.
                  setWeekOverride(null);
                  setDayOverride(null);
                }}
                disabled={isThisWeek}
                className="min-w-16"
              >
                Tuần này
              </Button>
              <Button
                intent="quiet"
                size="icon"
                onClick={() => setWeekOverride(addDays(weekStart, 7))}
                aria-label="Tuần sau"
              >
                <ChevronRight />
              </Button>
            </div>

            <Button intent="secondary" onClick={() => setApplyOpen(true)}>
              <CopyIcon />
              <span className="hidden sm:inline">Áp dụng lịch tuần khác</span>
              <span className="sm:hidden">Lịch tuần khác</span>
            </Button>

            <Button
              intent="primary"
              onClick={() => openSlot(selectedDay, "18:00")}
              disabled={activeStudentCount === 0}
            >
              <PlusIcon />
              Thêm buổi
            </Button>
          </>
        }
      >
        {/* Week summary — the money question, answered without leaving the page */}
        {weekTotals.count > 0 && (
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Stat label="Buổi học" value={`${weekTotals.count}`} />
            <Stat
              label="Đã dạy"
              value={`${weekTotals.taught}/${weekTotals.count}`}
            />
            <Stat label="Thời lượng" value={formatDuration(weekTotals.minutes)} />
            <Stat
              label="Học phí đã dạy"
              value={formatVND(weekTotals.amount)}
              emphasis
            />
          </dl>
        )}
      </PageHeader>

      {/* ---------------- Empty states ---------------- */}
      {activeStudentCount === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="Chưa có học sinh nào"
          description="Học phí được tính theo đơn giá riêng của từng học sinh, nên hãy thêm học sinh đầu tiên trước khi xếp lịch dạy."
          actions={
            <Link
              href="/hoc-sinh"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-fg shadow-sm transition-colors duration-(--dur-fast) hover:bg-primary-hover sm:min-h-9"
            >
              <PlusIcon />
              Thêm học sinh đầu tiên
            </Link>
          }
        />
      ) : weekSessions.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon />}
          title="Tuần này chưa có buổi học"
          description={
            <>
              Tuần {formatWeekRange(weekStart)} đang trống. Bạn có thể thêm buổi học
              thủ công, hoặc sao chép lại lịch của một tuần khác.
            </>
          }
          actions={
            <>
              <Button intent="primary" onClick={() => openSlot(selectedDay, "18:00")}>
                <PlusIcon />
                Thêm buổi học
              </Button>
              <Button intent="secondary" onClick={() => setApplyOpen(true)}>
                <CopyIcon />
                Áp dụng lịch tuần khác
              </Button>
            </>
          }
        />
      ) : (
        <>
          {/* ---------------- Mobile: single-day view ---------------- */}
          <div className="flex flex-col gap-3 sm:hidden">
            <DayStrip
              dates={dates}
              selected={selectedDay}
              today={today}
              sessionCounts={sessionCounts}
              onSelect={setDayOverride}
            />
            <DayView
              date={selectedDay}
              sessions={weekSessions}
              studentMap={studentMap}
              onSelectSession={openSession}
              onAddSession={(date) => openSlot(date, "18:00")}
            />
          </div>

          {/* ---------------- Tablet & desktop: the grid ---------------- */}
          {/* Horizontal scroll lives here, never on the page body. */}
          <div className="hidden sm:block">
            <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
              <div className="min-w-[44rem]">
                <WeekGrid
                  weekStart={weekStart}
                  sessions={weekSessions}
                  studentMap={studentMap}
                  today={today}
                  onSelectSession={openSession}
                  onSelectSlot={openSlot}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-fg-subtle">
              Bấm vào ô trống để thêm buổi học, bấm vào buổi học để xem chi tiết.
            </p>
          </div>
        </>
      )}

      {/* Keyed by target so each open starts from fresh form state. */}
      {dialog && (
        <SessionDialog
          key={
            dialog.kind === "edit"
              ? dialog.session.id
              : `${dialog.date}-${dialog.startTime}`
          }
          mode={dialog}
          onClose={() => setDialog(null)}
        />
      )}
      <ApplyLastWeekDialog
        open={applyOpen}
        weekStart={weekStart}
        onClose={() => setApplyOpen(false)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-fg-subtle">{label}</dt>
      <dd
        className={cn(
          "font-mono tnum font-semibold",
          emphasis ? "text-primary" : "text-fg",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 5.5v-1a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 11h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
