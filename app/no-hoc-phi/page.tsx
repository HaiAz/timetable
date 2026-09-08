"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, StudentAvatar } from "@/components/ui/card";
import { Badge, CheckIcon, WarnIcon } from "@/components/ui/badge";
import {
  LoadingRegion,
  Skeleton,
  SummaryCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";
import { EmptyState, SparkleIcon, WalletIcon } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { store } from "@/lib/store";
import { outstandingDebts, type StudentDebt } from "@/lib/billing";
import { formatDate, formatMonth, monthOf, monthsBetween } from "@/lib/date";
import { useToday } from "@/lib/use-client-date";
import { formatVND, initials, monthCountLabel } from "@/lib/format";
import { hexForColor } from "@/lib/colors";
import { cn } from "@/lib/cn";

type SortMode = "amount" | "oldest";

/**
 * Outstanding debt — months strictly before the current one that are still
 * unpaid. Anyone two or more months behind is highlighted, since that is the
 * point at which a quiet conversation is overdue.
 */
export default function DebtPage() {
  const { data, isLoading, run } = useData();
  const { toast } = useToast();

  // Debt is defined relative to the current month, which depends on the
  // viewer's clock — hence `null` until hydrated.
  const today = useToday();
  const month = today ? monthOf(today) : null;

  const [sort, setSort] = useState<SortMode>("amount");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const debts = useMemo(() => {
    if (!month) return [];
    const list = outstandingDebts(month, data.students, data.sessions, data.bills);
    if (sort === "oldest") {
      return [...list].sort(
        (a, b) => a.oldestMonth.localeCompare(b.oldestMonth) || b.totalOwed - a.totalOwed,
      );
    }
    return list;
  }, [month, data.students, data.sessions, data.bills, sort]);

  const summary = useMemo(() => {
    const total = debts.reduce((sum, d) => sum + d.totalOwed, 0);
    const critical = debts.filter((d) => d.monthsOverdue >= 2).length;
    const oldest = debts.reduce<string | null>(
      (acc, d) => (acc === null || d.oldestMonth < acc ? d.oldestMonth : acc),
      null,
    );
    return { total, critical, oldest, count: debts.length };
  }, [debts]);

  const studentCount = data.students.length;

  function toggleRow(studentId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function payMonth(debt: StudentDebt, debtMonth: string, amount: number) {
    await run(() => store.setBillStatus(debt.student.id, debtMonth, "paid", amount));
    toast({
      message: `Đã thu ${formatVND(amount)} — ${formatMonth(debtMonth)} của ${debt.student.name}.`,
      tone: "success",
      onUndo: () =>
        void run(() => store.setBillStatus(debt.student.id, debtMonth, "unpaid")),
    });
  }

  async function payAll(debt: StudentDebt) {
    // One write per month, so each can be undone independently afterwards.
    for (const m of debt.months) {
      await run(() => store.setBillStatus(debt.student.id, m.month, "paid", m.amount));
    }
    toast({
      message: `Đã thu toàn bộ ${formatVND(debt.totalOwed)} của ${debt.student.name}.`,
      tone: "success",
    });
  }

  /* Loading ----------------------------------------------------------- */
  if (isLoading || !month) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <LoadingRegion label="Đang tính công nợ">
          <SummaryCardsSkeleton count={3} />
          <div className="mt-4">
            <TableSkeleton rows={3} />
          </div>
        </LoadingRegion>
      </div>
    );
  }

  /* Nobody owes anything — a genuinely good outcome, so say so ---------- */
  if (debts.length === 0) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <PageHeader title="Nợ học phí" description="Các tháng trước tháng này" />
        <EmptyState
          tone="positive"
          icon={<SparkleIcon />}
          title="Không ai còn nợ học phí"
          description={
            studentCount === 0
              ? "Chưa có học sinh nào, nên cũng chưa có công nợ. Trang này sẽ liệt kê các tháng đã dạy nhưng chưa thu tiền."
              : "Toàn bộ học phí của các tháng trước đã được thu đủ. Trang này chỉ tính các tháng trước tháng hiện tại — học phí tháng này nằm ở trang Thu học phí."
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Nợ học phí"
        description="Các tháng trước tháng này chưa thu đủ"
        actions={
          <div
            role="radiogroup"
            aria-label="Sắp xếp"
            className="flex items-center gap-0.5 rounded-md border border-line bg-surface-inset p-0.5"
          >
            <SortButton
              active={sort === "amount"}
              onClick={() => setSort("amount")}
              label="Nợ nhiều nhất"
            />
            <SortButton
              active={sort === "oldest"}
              onClick={() => setSort("oldest")}
              label="Nợ lâu nhất"
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Tổng còn nợ"
          value={formatVND(summary.total)}
          tone="overdue"
          icon={<WalletIcon className="size-4" />}
        />
        <StatCard
          label="Học sinh đang nợ"
          value={String(summary.count)}
          tone="unpaid"
        />
        <StatCard
          label="Nợ từ 2 tháng trở lên"
          value={String(summary.critical)}
          tone={summary.critical > 0 ? "overdue" : "neutral"}
          hint={summary.oldest ? `Sớm nhất: ${formatMonth(summary.oldest)}` : undefined}
          icon={summary.critical > 0 ? <WarnIcon /> : undefined}
        />
      </div>

      <ul className="flex flex-col gap-2">
        {debts.map((debt) => (
          <DebtCard
            key={debt.student.id}
            debt={debt}
            currentMonth={month}
            expanded={expanded.has(debt.student.id)}
            onToggle={() => toggleRow(debt.student.id)}
            onPayMonth={(m, amount) => void payMonth(debt, m, amount)}
            onPayAll={() => void payAll(debt)}
          />
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DebtCard({
  debt,
  currentMonth: nowMonth,
  expanded,
  onToggle,
  onPayMonth,
  onPayAll,
}: {
  debt: StudentDebt;
  currentMonth: string;
  expanded: boolean;
  onToggle: () => void;
  onPayMonth: (month: string, amount: number) => void;
  onPayAll: () => void;
}) {
  const { student } = debt;
  // Two or more unpaid months is the escalation threshold.
  const critical = debt.monthsOverdue >= 2;
  const monthsLate = monthsBetween(debt.oldestMonth, nowMonth);
  const panelId = `debt-${student.id}`;

  return (
    <li
      className={cn(
        "overflow-hidden rounded-lg border",
        critical
          ? "border-overdue-border bg-overdue-bg"
          : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center gap-3 p-3">
        <StudentAvatar
          initial={initials(student.name)}
          color={hexForColor(student.color)}
          archived={student.archived}
        />

        <div className="min-w-0 flex-1 basis-44">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-base font-medium text-fg">{student.name}</p>
            {critical && (
              <Badge tone="overdue" icon={<WarnIcon />}>
                Nợ {monthCountLabel(debt.monthsOverdue)}
              </Badge>
            )}
            {student.archived && <Badge tone="neutral">Đã lưu trữ</Badge>}
          </div>
          <p className="truncate text-xs text-fg-subtle">
            {student.contact || "Chưa có liên hệ"} · Nợ từ{" "}
            {formatMonth(debt.oldestMonth)}
            {monthsLate > 1 ? ` (${monthsLate} tháng trước)` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              "font-mono tnum text-lg font-bold",
              critical ? "text-overdue-fg" : "text-fg",
            )}
          >
            {formatVND(debt.totalOwed)}
          </p>
          <p className="text-xs text-fg-subtle">
            {monthCountLabel(debt.monthsOverdue)} chưa thu
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            intent="quiet"
            size="sm"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            {expanded ? "Ẩn" : "Chi tiết"}
          </Button>
          <Button intent="success" size="sm" onClick={onPayAll}>
            <CheckIcon />
            Thu tất cả
          </Button>
        </div>
      </div>

      {/* Per-month breakdown, each payable on its own */}
      <div id={panelId} className={cn(!expanded && "hidden")}>
        <ul className="divide-y divide-line border-t border-line">
          {debt.months.map((m) => (
            <li
              key={m.month}
              className="flex flex-wrap items-center gap-3 bg-surface px-3 py-2.5"
            >
              <div className="min-w-0 flex-1 basis-32">
                <p className="text-base font-medium text-fg">{formatMonth(m.month)}</p>
                <p className="text-xs text-fg-subtle">
                  {m.sessionCount} buổi · {m.totalMinutes} phút
                </p>
              </div>

              <span className="font-mono tnum text-base font-semibold text-fg">
                {formatVND(m.amount)}
              </span>

              <Button
                intent="secondary"
                size="sm"
                onClick={() => onPayMonth(m.month, m.amount)}
              >
                Thu tháng này
              </Button>

              {/* Session-level detail, for reconciling a disputed month */}
              <details className="w-full">
                <summary className="cursor-pointer list-none text-xs text-fg-subtle hover:text-fg">
                  Xem {m.sessionCount} buổi học
                </summary>
                <ul className="mt-1.5 flex flex-col gap-0.5 border-l-2 border-line pl-3">
                  {m.lines.map((line) => (
                    <li
                      key={line.session.id}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="w-20 font-mono tnum text-fg-muted">
                        {formatDate(line.session.date)}
                      </span>
                      <span className="w-24 font-mono tnum text-fg-subtle">
                        {line.session.startTime}–{line.session.endTime}
                      </span>
                      <span className="w-16 text-fg-subtle">{line.minutes} phút</span>
                      <span className="ml-auto font-mono tnum font-medium text-fg">
                        {formatVND(line.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function SortButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-sm px-2.5 text-sm font-medium transition-colors duration-(--dur-fast)",
        active ? "bg-surface text-fg shadow-sm" : "text-fg-subtle hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
