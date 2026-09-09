"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { store } from "@/lib/store";
import { addDays, formatWeekRange, weekDates } from "@/lib/date";
import { cn } from "@/lib/cn";
import { WarnIcon } from "@/components/ui/badge";

/** Phạm vi tuần cho phép chọn: khoảng 2 tháng trước và sau tuần đang xem. */
const WEEK_OPTIONS_RADIUS = 9;

/**
 * Copies another week's sessions into the viewed week.
 *
 * This is the only repeat mechanism in the app — there are no recurring rules.
 * Every copy is an independent record, so editing one week never touches
 * another.
 */
export function ApplyLastWeekDialog({
  open,
  weekStart,
  onClose,
}: {
  open: boolean;
  weekStart: string;
  onClose: () => void;
}) {
  const { data, run } = useData();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [sourceWeekStart, setSourceWeekStart] = useState(() => addDays(weekStart, -7));

  // Mỗi lần mở lại (hoặc đổi tuần đang xem), quay về mặc định "tuần trước" —
  // dialog không unmount giữa các lần mở nên state cũ vẫn còn nếu không reset.
  useEffect(() => {
    if (open) setSourceWeekStart(addDays(weekStart, -7));
  }, [open, weekStart]);

  const archivedIds = useMemo(
    () => new Set(data.students.filter((s) => s.archived).map((s) => s.id)),
    [data.students],
  );

  /**
   * Session count cho mỗi tuần ứng viên (không tính học sinh đã lưu trữ),
   * sắp xếp từ xa nhất trong quá khứ đến xa nhất trong tương lai. Chỉ trong
   * khoảng ±2 tháng quanh tuần đang xem — xa hơn thì không cần sao chép tới.
   */
  const weekOptions = useMemo(() => {
    const options: { start: string; count: number }[] = [];
    for (let i = -WEEK_OPTIONS_RADIUS; i <= WEEK_OPTIONS_RADIUS; i++) {
      if (i === 0) continue;
      const start = addDays(weekStart, 7 * i);
      const dates = new Set(weekDates(start));
      const count = data.sessions.filter(
        (s) => dates.has(s.date) && !archivedIds.has(s.studentId),
      ).length;
      options.push({ start, count });
    }
    return options;
  }, [weekStart, data.sessions, archivedIds]);

  const { sourceCount, targetCount, archivedCount } = useMemo(() => {
    const sourceDates = new Set(weekDates(sourceWeekStart));
    const targetDates = new Set(weekDates(weekStart));

    const source = data.sessions.filter((s) => sourceDates.has(s.date));
    return {
      sourceCount: source.filter((s) => !archivedIds.has(s.studentId)).length,
      archivedCount: source.filter((s) => archivedIds.has(s.studentId)).length,
      targetCount: data.sessions.filter((s) => targetDates.has(s.date)).length,
    };
  }, [data.sessions, archivedIds, sourceWeekStart, weekStart]);

  async function apply(mode: "append" | "replace") {
    setBusy(true);
    const result = await run(() =>
      store.applyPreviousWeek(weekStart, sourceWeekStart, mode),
    );
    setBusy(false);
    onClose();

    if (!result) return;

    if (result.created === 0) {
      toast({
        message:
          result.skipped > 0
            ? "Tuần này đã có đủ các buổi học đó rồi."
            : "Không có buổi học nào được sao chép.",
        tone: "info",
      });
    } else {
      toast({
        message: `Đã thêm ${result.created} buổi học${
          result.skipped > 0 ? `, bỏ qua ${result.skipped} buổi trùng` : ""
        }.`,
        tone: "success",
      });
    }
  }

  const picker = (
    <WeekPicker
      value={sourceWeekStart}
      options={weekOptions}
      onChange={setSourceWeekStart}
    />
  );

  /* Nothing to copy from the selected week ----------------------------- */
  if (sourceCount === 0) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Tuần đó không có buổi học"
        description={`${formatWeekRange(sourceWeekStart)} chưa có buổi học nào để sao chép.`}
        size="sm"
        footer={
          <Button intent="primary" onClick={onClose} data-autofocus>
            Đã hiểu
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {picker}
          <p className="text-base text-fg-muted">
            {archivedCount > 0
              ? "Tuần đó chỉ có buổi của học sinh đã lưu trữ, những buổi này không được sao chép."
              : "Hãy chọn một tuần khác, hoặc thêm buổi học thủ công cho tuần này."}
          </p>
        </div>
      </Dialog>
    );
  }

  /* The target week is empty — copy straight away, no question needed --- */
  if (targetCount === 0) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Áp dụng lịch tuần khác"
        description={`Sao chép buổi học sang ${formatWeekRange(weekStart)}.`}
        size="sm"
        footer={
          <>
            <Button intent="secondary" onClick={onClose}>
              Huỷ
            </Button>
            <Button
              intent="primary"
              onClick={() => void apply("append")}
              loading={busy}
              data-autofocus
            >
              Sao chép {sourceCount} buổi
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {picker}
          <Notes archivedCount={archivedCount} />
        </div>
      </Dialog>
    );
  }

  /* The target week already has sessions — ask how to merge -------------- */
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tuần này đã có buổi học"
      description={`Tuần ${formatWeekRange(weekStart)} đang có ${targetCount} buổi học. Bạn muốn xử lý thế nào?`}
      footer={
        <Button intent="secondary" onClick={onClose}>
          Huỷ
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        {picker}
        <ChoiceCard
          title="Thêm vào lịch hiện có"
          description={`Giữ ${targetCount} buổi đang có và thêm các buổi của tuần đã chọn. Buổi trùng hoàn toàn (cùng học sinh, cùng thứ, cùng giờ) sẽ được bỏ qua.`}
          actionLabel="Thêm vào"
          onClick={() => void apply("append")}
          busy={busy}
          autoFocus
        />
        <ChoiceCard
          title="Xoá và thay thế"
          description={`Xoá toàn bộ ${targetCount} buổi của tuần này, kể cả buổi đã đánh dấu đã dạy, rồi sao chép ${sourceCount} buổi từ tuần đã chọn.`}
          actionLabel="Xoá và thay thế"
          onClick={() => void apply("replace")}
          busy={busy}
          tone="danger"
        />
        <Notes archivedCount={archivedCount} />
      </div>
    </Dialog>
  );
}

/** Picks which week to copy from; weeks with no sessions are disabled. */
function WeekPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { start: string; count: number }[];
  onChange: (start: string) => void;
}) {
  return (
    <Field label="Sao chép lịch của tuần">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(({ start, count }) => (
          <option key={start} value={start} disabled={count === 0}>
            {formatWeekRange(start)}
            {count === 0 ? " — không có buổi học" : ` — ${count} buổi học`}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function ChoiceCard({
  title,
  description,
  actionLabel,
  onClick,
  busy,
  tone = "default",
  autoFocus = false,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  busy: boolean;
  tone?: "default" | "danger";
  autoFocus?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3",
        tone === "danger"
          ? "border-overdue-border bg-overdue-bg"
          : "border-line bg-surface",
      )}
    >
      <div>
        <p
          className={cn(
            "text-base font-semibold",
            tone === "danger" ? "text-overdue-fg" : "text-fg",
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            "mt-0.5 text-sm leading-relaxed",
            tone === "danger" ? "text-overdue-fg" : "text-fg-muted",
          )}
        >
          {description}
        </p>
      </div>
      <Button
        intent={tone === "danger" ? "danger" : "primary"}
        size="sm"
        onClick={onClick}
        loading={busy}
        className="self-start"
        data-autofocus={autoFocus || undefined}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

function Notes({ archivedCount }: { archivedCount: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-inset px-3 py-2.5 text-sm text-fg-muted">
      <p>Các buổi được sao chép luôn ở trạng thái “chưa dạy”.</p>
      {archivedCount > 0 && (
        <p className="flex gap-1.5 text-unpaid-fg">
          <WarnIcon className="mt-0.5" />
          <span>
            Bỏ qua {archivedCount} buổi của học sinh đã lưu trữ.
          </span>
        </p>
      )}
    </div>
  );
}
