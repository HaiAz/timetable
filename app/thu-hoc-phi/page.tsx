"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, StudentAvatar } from "@/components/ui/card";
import { Badge, CheckIcon, ClockIcon, WarnIcon } from "@/components/ui/badge";
import {
  LoadingRegion,
  Skeleton,
  SummaryCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";
import { CalendarIcon, EmptyState, WalletIcon } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { store } from "@/lib/store";
import { monthSummary, monthTotals, type StudentMonthTotal } from "@/lib/billing";
import { addMonths, formatDate, formatMonth, monthOf } from "@/lib/date";
import { useToday } from "@/lib/use-client-date";
import { formatDuration, formatVND, initials } from "@/lib/format";
import { hexForColor } from "@/lib/colors";
import type { Student } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Collect payment.
 *
 * Defaults to the current month. Rows expand to show the individual sessions
 * behind each total, which is what makes a bill defensible when a parent
 * questions it.
 */
export default function CollectPaymentPage() {
  const { data, isLoading, run } = useData();
  const { toast } = useToast();

  // `null` during SSR and the first client render — "this month" depends on the
  // viewer's clock, so it must not appear in the server markup.
  const today = useToday();
  const thisMonth = today ? monthOf(today) : null;

  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const month = monthOverride ?? thisMonth;

  const totals = useMemo(
    () => (month ? monthTotals(month, data.students, data.sessions, data.bills) : []),
    [month, data.students, data.sessions, data.bills],
  );

  const summary = useMemo(() => monthSummary(totals), [totals]);

  const studentMap = useMemo(
    () => new Map(data.students.map((s) => [s.id, s])),
    [data.students],
  );

  const isCurrentMonth = month !== null && month === thisMonth;

  function toggleRow(studentId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function markPaid(total: StudentMonthTotal, student: Student) {
    if (!month) return;
    await run(() =>
      store.setBillStatus(total.studentId, month, "paid", total.totalAmount),
    );
    toast({
      message: `Đã thu ${formatVND(total.totalAmount)} của ${student.name}.`,
      tone: "success",
      onUndo: () =>
        void run(() => store.setBillStatus(total.studentId, month, "unpaid")),
    });
  }

  async function markUnpaid(total: StudentMonthTotal, student: Student) {
    if (!month) return;
    await run(() => store.setBillStatus(total.studentId, month, "unpaid"));
    toast({
      message: `Đã bỏ đánh dấu đã thu của ${student.name}.`,
      tone: "success",
      onUndo: () =>
        void run(() =>
          store.setBillStatus(total.studentId, month, "paid", total.totalAmount),
        ),
    });
  }

  /* Loading ----------------------------------------------------------- */
  if (isLoading || !month) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Skeleton className="h-7 w-36" />
            <Skeleton className="mt-2 h-4 w-28" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <LoadingRegion label="Đang tính học phí">
          <SummaryCardsSkeleton />
          <div className="mt-4">
            <TableSkeleton rows={4} />
          </div>
        </LoadingRegion>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Thu học phí"
        description={formatMonth(month)}
        actions={
          <div className="flex items-center gap-1 rounded-md border border-line bg-surface p-0.5">
            <Button
              intent="quiet"
              size="icon"
              onClick={() => setMonthOverride(addMonths(month, -1))}
              aria-label="Tháng trước"
            >
              <Chevron dir="left" />
            </Button>
            <Button
              intent="quiet"
              size="sm"
              onClick={() => setMonthOverride(null)}
              disabled={isCurrentMonth}
              className="min-w-20"
            >
              Tháng này
            </Button>
            <Button
              intent="quiet"
              size="icon"
              onClick={() => setMonthOverride(addMonths(month, 1))}
              aria-label="Tháng sau"
            >
              <Chevron dir="right" />
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tổng tháng này"
          value={formatVND(summary.total)}
          icon={<WalletIcon className="size-4" />}
        />
        <StatCard
          label="Đã thu"
          value={formatVND(summary.collected)}
          tone={summary.collected > 0 ? "paid" : "neutral"}
          icon={<CheckIcon />}
        />
        <StatCard
          label="Còn phải thu"
          value={formatVND(summary.outstanding)}
          tone={summary.outstanding > 0 ? "unpaid" : "paid"}
          icon={<ClockIcon />}
        />
        <StatCard
          label="Học sinh"
          value={String(summary.studentCount)}
          hint={summary.studentCount > 0 ? "có buổi đã dạy" : undefined}
        />
      </div>

      {/* Table / empty state */}
      {totals.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon />}
          title={`Tháng ${formatMonth(month).toLowerCase()} chưa có buổi nào được đánh dấu đã dạy`}
          description="Học phí chỉ được tính sau khi bạn đánh dấu buổi học là “đã dạy” trên thời khoá biểu. Buổi đã xếp lịch nhưng chưa dạy không được tính tiền."
          actions={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-base font-medium text-primary-fg shadow-sm transition-colors duration-(--dur-fast) hover:bg-primary-hover sm:min-h-9"
            >
              Mở thời khoá biểu
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          {/* Column headers — desktop only; mobile rows are self-labelling */}
          <div className="hidden border-b border-line bg-surface-inset px-3 py-2 text-xs font-medium text-fg-muted md:flex md:items-center md:gap-3">
            <span className="w-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">Học sinh</span>
            <span className="w-16 shrink-0 text-right">Buổi</span>
            <span className="w-24 shrink-0 text-right">Thời lượng</span>
            <span className="w-28 shrink-0 text-right">Học phí</span>
            <span className="w-32 shrink-0 text-right">Tình trạng</span>
          </div>

          <ul className="divide-y divide-line">
            {totals.map((total) => {
              const student = studentMap.get(total.studentId);
              if (!student) return null;
              return (
                <PaymentRow
                  key={total.studentId}
                  total={total}
                  student={student}
                  expanded={expanded.has(total.studentId)}
                  onToggle={() => toggleRow(total.studentId)}
                  onMarkPaid={() => void markPaid(total, student)}
                  onMarkUnpaid={() => void markUnpaid(total, student)}
                />
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PaymentRow({
  total,
  student,
  expanded,
  onToggle,
  onMarkPaid,
  onMarkUnpaid,
}: {
  total: StudentMonthTotal;
  student: Student;
  expanded: boolean;
  onToggle: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
}) {
  const paid = total.status === "paid";
  const short = total.shortfall > 0;
  const panelId = `sessions-${total.studentId}`;

  return (
    <li className={cn(paid && !short && "bg-paid-bg/40")}>
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 md:flex-nowrap">
        {/* Expander */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-subtle hover:bg-surface-hover hover:text-fg"
          aria-label={
            expanded
              ? `Ẩn chi tiết buổi học của ${student.name}`
              : `Xem chi tiết buổi học của ${student.name}`
          }
        >
          <svg
            viewBox="0 0 16 16"
            className={cn(
              "size-3.5 transition-transform duration-(--dur-fast)",
              expanded && "rotate-90",
            )}
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Student */}
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
          <StudentAvatar
            initial={initials(student.name)}
            color={hexForColor(student.color)}
            size="sm"
            archived={student.archived}
          />
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-fg">{student.name}</p>
            <p className="truncate text-xs text-fg-subtle">
              {student.contact || "Chưa có liên hệ"}
            </p>
          </div>
        </div>

        {/* Figures */}
        <div className="flex w-16 shrink-0 flex-col items-end md:block">
          <span className="text-2xs text-fg-subtle md:hidden">Buổi</span>
          <span className="font-mono tnum text-base text-fg">{total.sessionCount}</span>
        </div>

        <div className="hidden w-24 shrink-0 text-right md:block">
          <span className="font-mono tnum text-sm text-fg-muted">
            {formatDuration(total.totalMinutes)}
          </span>
        </div>

        <div className="w-28 shrink-0 text-right">
          <span className="font-mono tnum text-base font-semibold text-fg">
            {formatVND(total.totalAmount)}
          </span>
          {short && (
            <span className="block font-mono tnum text-2xs text-unpaid-fg">
              đã thu {formatVND(total.paidAmount ?? 0)}
            </span>
          )}
        </div>

        {/* Status + action */}
        <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-32">
          {paid ? (
            short ? (
              <div className="flex flex-col items-end gap-1">
                <Badge tone="unpaid" icon={<WarnIcon />}>
                  Thiếu {formatVND(total.shortfall)}
                </Badge>
                <Button intent="quiet" size="sm" onClick={onMarkPaid}>
                  Thu phần thêm
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <Badge tone="paid" icon={<CheckIcon />}>
                  Đã thu
                </Badge>
                <Button intent="quiet" size="sm" onClick={onMarkUnpaid}>
                  Bỏ đánh dấu
                </Button>
              </div>
            )
          ) : (
            <Button intent="primary" size="sm" onClick={onMarkPaid}>
              Đánh dấu đã thu
            </Button>
          )}
        </div>
      </div>

      {/* Session breakdown — the reconciliation view */}
      {expanded && (
        <div id={panelId} className="border-t border-line bg-surface-inset px-3 py-2.5">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Chi tiết các buổi đã dạy của {student.name}
            </caption>
            <thead>
              <tr className="text-xs text-fg-muted">
                <th scope="col" className="pb-1 text-left font-medium">Ngày</th>
                <th scope="col" className="pb-1 text-left font-medium">Giờ</th>
                <th scope="col" className="pb-1 text-right font-medium">Thời lượng</th>
                <th scope="col" className="pb-1 text-right font-medium">Học phí</th>
              </tr>
            </thead>
            <tbody>
              {total.lines.map((line) => (
                <tr key={line.session.id} className="border-t border-line">
                  <td className="py-1.5 font-mono tnum text-fg">
                    {formatDate(line.session.date)}
                  </td>
                  <td className="py-1.5 font-mono tnum text-fg-muted">
                    {line.session.startTime}–{line.session.endTime}
                  </td>
                  <td className="py-1.5 text-right font-mono tnum text-fg-muted">
                    {line.minutes} phút
                  </td>
                  <td className="py-1.5 text-right font-mono tnum font-medium text-fg">
                    {formatVND(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-strong font-semibold">
                <td className="pt-1.5 text-fg" colSpan={2}>
                  Tổng {total.sessionCount} buổi
                </td>
                <td className="pt-1.5 text-right font-mono tnum text-fg">
                  {total.totalMinutes} phút
                </td>
                <td className="pt-1.5 text-right font-mono tnum text-fg">
                  {formatVND(total.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* How the number was produced — so it can be defended */}
          <p className="mt-2 border-t border-line pt-1.5 font-mono text-2xs text-fg-subtle">
            Mỗi buổi: số phút × {formatVND(student.basePrice)} ÷ {student.baseMinutes} phút,
            làm tròn đến nghìn. Buổi đã dạy dùng đơn giá tại thời điểm đánh dấu.
          </p>
        </div>
      )}
    </li>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
