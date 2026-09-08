"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, CheckIcon, ClockIcon } from "@/components/ui/badge";
import { useData } from "@/components/data-provider";
import { amountForSession, sessionMinutes } from "@/lib/billing";
import { formatDate, formatMonth, monthOf } from "@/lib/date";
import { formatDuration, formatVND } from "@/lib/format";
import type { Student } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Per-student session history, grouped by month, newest first.
 * Rendered only when a student is selected, so the inner component can take a
 * non-nullable `student` and keep its memoisation straightforward.
 */
export function StudentHistoryDialog({
  student,
  onClose,
}: {
  student: Student | null;
  onClose: () => void;
}) {
  if (!student) return null;
  return <History student={student} onClose={onClose} />;
}

function History({
  student,
  onClose,
}: {
  student: Student;
  onClose: () => void;
}) {
  const { data } = useData();
  const [showAll, setShowAll] = useState(false);

  const { sessions: allSessions, bills } = data;

  const groups = useMemo(() => {
    const studentId = student.id;

    const sessions = allSessions
      .filter((s) => s.studentId === studentId)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
      );

    const byMonth = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const month = monthOf(session.date);
      const list = byMonth.get(month);
      if (list) list.push(session);
      else byMonth.set(month, [session]);
    }

    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, list]) => {
        const paid = bills.find(
          (b) => b.studentId === student.id && b.month === month && b.status === "paid",
        );
        return {
          month,
          sessions: list,
          taughtCount: list.filter((s) => s.taught).length,
          minutes: list.reduce(
            (sum, s) => (s.taught ? sum + sessionMinutes(s) : sum),
            0,
          ),
          amount: list.reduce((sum, s) => sum + amountForSession(s, student), 0),
          paid: Boolean(paid),
        };
      });
  }, [allSessions, bills, student]);

  const visible = showAll ? groups : groups.slice(0, 3);

  const lifetime = useMemo(
    () => ({
      sessions: groups.reduce((sum, g) => sum + g.taughtCount, 0),
      amount: groups.reduce((sum, g) => sum + g.amount, 0),
    }),
    [groups],
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Lịch sử học — ${student.name}`}
      description={
        groups.length > 0
          ? `${lifetime.sessions} buổi đã dạy · tổng ${formatVND(lifetime.amount)}`
          : undefined
      }
      size="lg"
      footer={
        <Button intent="secondary" onClick={onClose} data-autofocus>
          Đóng
        </Button>
      }
    >
      {groups.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong bg-surface px-4 py-8 text-center text-base text-fg-muted">
          Học sinh này chưa có buổi học nào.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((group) => (
            <section key={group.month}>
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-1.5">
                <h3 className="text-base font-semibold text-fg">
                  {formatMonth(group.month)}
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-fg-subtle">
                    {group.taughtCount}/{group.sessions.length} buổi ·{" "}
                    {formatDuration(group.minutes)}
                  </span>
                  <span className="font-mono tnum font-semibold text-fg">
                    {formatVND(group.amount)}
                  </span>
                  {group.amount > 0 && (
                    <Badge tone={group.paid ? "paid" : "unpaid"}>
                      {group.paid ? "Đã thu" : "Chưa thu"}
                    </Badge>
                  )}
                </div>
              </header>

              <ul className="mt-1.5 flex flex-col">
                {group.sessions.map((session) => {
                  const minutes = sessionMinutes(session);
                  const amount = amountForSession(session, student);
                  return (
                    <li
                      key={session.id}
                      className={cn(
                        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 text-sm last:border-b-0",
                        !session.taught && "opacity-70",
                      )}
                    >
                      <span className="w-20 shrink-0 font-mono tnum text-fg">
                        {formatDate(session.date)}
                      </span>
                      <span className="w-24 shrink-0 font-mono tnum text-fg-muted">
                        {session.startTime}–{session.endTime}
                      </span>
                      <span className="w-20 shrink-0 text-fg-muted">
                        {formatDuration(minutes)}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        {session.taught ? (
                          <>
                            <span className="font-mono tnum font-medium text-fg">
                              {formatVND(amount)}
                            </span>
                            <CheckIcon className="text-paid" />
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-fg-subtle">
                            <ClockIcon />
                            Chưa dạy
                          </span>
                        )}
                      </span>
                      {session.note && (
                        <p className="w-full text-xs text-fg-subtle">{session.note}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {groups.length > visible.length && (
            <Button intent="quiet" onClick={() => setShowAll(true)}>
              Xem thêm {groups.length - visible.length} tháng trước
            </Button>
          )}
        </div>
      )}
    </Dialog>
  );
}
