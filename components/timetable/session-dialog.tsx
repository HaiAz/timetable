"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateInput, Field, Select, Textarea, TimeInput } from "@/components/ui/field";
import { Badge, CheckIcon, ClockIcon, WarnIcon } from "@/components/ui/badge";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { store } from "@/lib/store";
import { amountForSession, minutesBetween, projectedAmount } from "@/lib/billing";
import { formatDateLong, monthOf, todayISO } from "@/lib/date";
import {
  formatDuration as fmtDuration,
  formatRate,
  formatTimestamp,
  formatVND,
  initials,
} from "@/lib/format";
import { findOverlaps } from "./overlap";
import type { Session, Student } from "@/lib/types";
import { hexForColor } from "@/lib/colors";
import { StudentAvatar } from "@/components/ui/card";

/**
 * Create / view / edit a session.
 *
 * Two modes in one dialog:
 *  - `create`: an empty slot was clicked. Pick student + times; the duration
 *    and projected amount update live as they are typed.
 *  - `edit`: an existing session was clicked. Shows details, allows editing,
 *    toggling "taught" both directions, and deleting.
 */

export type SessionDialogMode =
  | { kind: "create"; date: string; startTime: string; endTime: string }
  | { kind: "edit"; session: Session };

export function SessionDialog({
  mode,
  onClose,
}: {
  mode: SessionDialogMode;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data, run } = useData();
  const { toast } = useToast();

  const activeStudents = useMemo(
    () =>
      data.students
        .filter((s) => !s.archived)
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [data.students],
  );

  const editing = mode.kind === "edit" ? mode.session : null;

  /* Form state — initialised straight from `mode`.
   * The parent mounts this component only while open and keys it by target,
   * so there is no effect resetting state on open. */
  const initial =
    mode.kind === "edit"
      ? {
          studentId: mode.session.studentId,
          date: mode.session.date,
          startTime: mode.session.startTime,
          endTime: mode.session.endTime,
          note: mode.session.note ?? "",
        }
      : {
          studentId: activeStudents[0]?.id ?? "",
          date: mode.date,
          startTime: mode.startTime,
          endTime: mode.endTime,
          note: "",
        };

  const [studentId, setStudentId] = useState(initial.studentId);
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [note, setNote] = useState(initial.note);
  const [isEditingFields, setIsEditingFields] = useState(mode.kind === "create");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const student = data.students.find((s) => s.id === studentId);
  const minutes = startTime && endTime ? minutesBetween(startTime, endTime) : 0;

  // For an already-taught session the frozen rate governs, not the current one.
  const liveAmount = editing?.taught
    ? amountForSession({ ...editing, startTime, endTime }, student)
    : projectedAmount(startTime, endTime, student);

  const overlaps = useMemo(() => {
    if (!date || !startTime || !endTime || minutes <= 0) return [];
    return findOverlaps(data.sessions, date, startTime, endTime, editing?.id);
  }, [data.sessions, date, startTime, endTime, minutes, editing?.id]);

  /* Validation -------------------------------------------------------- */
  const errors = {
    studentId: !studentId ? "Hãy chọn học sinh." : undefined,
    endTime:
      minutes <= 0 && startTime && endTime
        ? "Giờ kết thúc phải sau giờ bắt đầu."
        : undefined,
  };
  const isValid = !errors.studentId && !errors.endTime && minutes > 0;

  // Nói rõ ngày đang chọn là thứ mấy, và cảnh báo khi nó không thuộc tháng
  // hiện tại — thêm buổi tháng cũ là hợp lệ, nhưng dễ nhầm nếu không để ý.
  const dateHint = useMemo(() => {
    if (!date) return undefined;
    const label = formatDateLong(date);
    const thisMonth = monthOf(todayISO());
    const sessionMonth = monthOf(date);
    if (sessionMonth === thisMonth) return label;
    return sessionMonth < thisMonth
      ? `${label} — thuộc tháng trước, sẽ tính vào học phí tháng đó.`
      : `${label} — thuộc tháng sau.`;
  }, [date]);

  /* Actions ----------------------------------------------------------- */

  async function save() {
    if (!isValid) return;
    setSaving(true);

    if (mode.kind === "create") {
      await run(() =>
        store.addSession({ studentId, date, startTime, endTime, note }),
      );
      toast({ message: "Đã thêm buổi học.", tone: "success" });
    } else {
      await run(() =>
        store.updateSession(editing!.id, { studentId, date, startTime, endTime, note }),
      );
      toast({ message: "Đã lưu thay đổi.", tone: "success" });
    }

    setSaving(false);
    onClose();
  }

  async function toggleTaught() {
    if (!editing) return;
    const next = !editing.taught;
    await run(() => store.setSessionTaught(editing.id, next));
    toast({
      message: next ? "Đã đánh dấu là đã dạy." : "Đã bỏ đánh dấu đã dạy.",
      tone: "success",
      onUndo: () => void run(() => store.setSessionTaught(editing.id, !next)),
    });
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await run(() => store.deleteSession(editing.id));
    toast({ message: "Đã xoá buổi học.", tone: "success" });
    onClose();
  }

  /* No students yet — creating a session is impossible ---------------- */
  if (mode.kind === "create" && activeStudents.length === 0) {
    return (
      <Dialog
        open
        onClose={onClose}
        title="Chưa có học sinh"
        description="Cần có ít nhất một học sinh đang học trước khi thêm buổi dạy."
        size="sm"
        footer={
          <>
            <Button intent="secondary" onClick={onClose}>
              Đóng
            </Button>
            <Button
              intent="primary"
              onClick={() => {
                onClose();
                router.push("/hoc-sinh");
              }}
              data-autofocus
            >
              Thêm học sinh
            </Button>
          </>
        }
      >
        <p className="text-base text-fg-muted">
          Học phí được tính theo đơn giá của từng học sinh, nên hãy thêm học sinh trước.
        </p>
      </Dialog>
    );
  }

  const isCreate = mode.kind === "create";
  const showForm = isCreate || isEditingFields;

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={isCreate ? "Thêm buổi học" : "Chi tiết buổi học"}
        description={date ? formatDateLong(date) : undefined}
        footer={
          showForm ? (
            <>
              {!isCreate && (
                <Button intent="quiet" onClick={() => setIsEditingFields(false)}>
                  Huỷ sửa
                </Button>
              )}
              {isCreate && (
                <Button intent="secondary" onClick={onClose}>
                  Huỷ
                </Button>
              )}
              <Button
                intent="primary"
                onClick={() => void save()}
                disabled={!isValid}
                loading={saving}
              >
                {isCreate ? "Thêm buổi học" : "Lưu thay đổi"}
              </Button>
            </>
          ) : (
            <>
              <Button
                intent="danger"
                onClick={() => setConfirmDelete(true)}
                className="mr-auto"
              >
                Xoá
              </Button>
              <Button intent="secondary" onClick={() => setIsEditingFields(true)}>
                Sửa
              </Button>
              <Button
                intent={editing?.taught ? "secondary" : "primary"}
                onClick={() => void toggleTaught()}
                data-autofocus
              >
                {editing?.taught ? "Bỏ đánh dấu đã dạy" : "Đánh dấu đã dạy"}
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {/* Status of an existing session */}
          {editing && (
            <div className="flex flex-wrap items-center gap-2">
              {editing.taught ? (
                <Badge tone="taught" icon={<CheckIcon />}>
                  Đã dạy
                </Badge>
              ) : (
                <Badge tone="neutral" icon={<ClockIcon />}>
                  Chưa dạy
                </Badge>
              )}
              {editing.taughtAt && (
                <span className="text-xs text-fg-subtle">
                  Đánh dấu lúc {formatTimestamp(editing.taughtAt)}
                </span>
              )}
            </div>
          )}

          {showForm ? (
            <>
              <Field label="Học sinh" required error={errors.studentId}>
                <Select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  aria-invalid={Boolean(errors.studentId)}
                  data-autofocus={isCreate ? true : undefined}
                >
                  <option value="">— Chọn học sinh —</option>
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatRate(s.baseMinutes, s.basePrice)}
                    </option>
                  ))}
                  {/* An archived student stays selectable while editing. */}
                  {editing &&
                    student?.archived && (
                      <option value={student.id}>{student.name} (đã lưu trữ)</option>
                    )}
                </Select>
              </Field>

              {/* Ngày đứng trước giờ — thứ tự tự nhiên khi nhập, và cho phép
                  thêm buổi của tháng cũ mà không cần điều hướng lịch. */}
              <Field
                label="Ngày"
                required
                hint={dateHint}
              >
                <DateInput value={date} onChange={setDate} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Giờ bắt đầu" required>
                  <TimeInput
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </Field>
                <Field label="Giờ kết thúc" required error={errors.endTime}>
                  <TimeInput
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    aria-invalid={Boolean(errors.endTime)}
                  />
                </Field>
              </div>

              <Field label="Ghi chú" hint="Không bắt buộc.">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nội dung đã dạy, bài tập về nhà…"
                  rows={2}
                />
              </Field>
            </>
          ) : (
            /* Read-only detail view */
            <div className="flex flex-col gap-3">
              {student && (
                <div className="flex items-center gap-2.5">
                  <StudentAvatar
                    initial={initials(student.name)}
                    color={hexForColor(student.color)}
                    archived={student.archived}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-fg">
                      {student.name}
                      {student.archived && (
                        <span className="ml-1.5 text-xs text-fg-subtle">(đã lưu trữ)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-fg-subtle">
                      {formatRate(student.baseMinutes, student.basePrice)}
                    </p>
                  </div>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-md border border-line bg-surface-inset px-3 py-2.5">
                <Detail label="Thời gian">
                  {startTime} – {endTime}
                </Detail>
                <Detail label="Thời lượng">{fmtDuration(minutes)}</Detail>
              </dl>

              {editing?.note && (
                <div>
                  <p className="text-xs font-medium text-fg-muted">Ghi chú</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-base text-fg">
                    {editing.note}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Live duration + amount — the reason to trust the number */}
          <AmountPreview
            minutes={minutes}
            amount={liveAmount}
            student={student}
            taught={Boolean(editing?.taught)}
          />

          {/* Overlap warning — informational, never blocking */}
          {overlaps.length > 0 && (
            <div
              role="status"
              className="flex gap-2 rounded-md border border-unpaid-border bg-unpaid-bg px-3 py-2.5 text-unpaid-fg"
            >
              <WarnIcon className="mt-0.5" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  Trùng giờ với {overlaps.length} buổi học khác
                </p>
                <ul className="mt-1 space-y-0.5">
                  {overlaps.slice(0, 3).map((o) => {
                    const other = data.students.find((s) => s.id === o.studentId);
                    return (
                      <li key={o.id} className="truncate font-mono tnum text-xs">
                        {o.startTime}–{o.endTime} · {other?.name ?? "?"}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-xs opacity-80">
                  Vẫn có thể lưu — bạn có thể dạy nhóm hoặc sẽ sửa lại sau.
                </p>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        title="Xoá buổi học này?"
        description={
          editing?.taught
            ? "Buổi học đã được đánh dấu là đã dạy. Xoá sẽ làm giảm học phí của tháng."
            : "Hành động này không thể hoàn tác."
        }
        confirmLabel="Xoá buổi học"
        tone="danger"
      />
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="truncate font-mono tnum text-base font-medium text-fg">{children}</dd>
    </div>
  );
}

/** The live calculation panel — duration and money, updating as you type. */
function AmountPreview({
  minutes,
  amount,
  student,
  taught,
}: {
  minutes: number;
  amount: number;
  student: Student | undefined;
  taught: boolean;
}) {
  const invalid = minutes <= 0;

  return (
    <div
      className={cnPreview(taught)}
      // Announce the recalculated total to screen readers as it changes.
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-fg-muted">Thời lượng</span>
        <span className="font-mono tnum text-base font-semibold text-fg">
          {invalid ? "—" : fmtDuration(minutes)}
        </span>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-fg-muted">
          {taught ? "Học phí" : "Học phí dự kiến"}
        </span>
        <span
          className={
            taught
              ? "font-mono tnum text-lg font-bold text-paid-fg"
              : "font-mono tnum text-lg font-bold text-fg"
          }
        >
          {invalid || !student ? "—" : formatVND(amount)}
        </span>
      </div>
    </div>
  );
}

function cnPreview(taught: boolean): string {
  return [
    "rounded-md border px-3 py-2.5",
    taught
      ? "border-taught-border bg-taught-bg"
      : "border-primary-border bg-primary-bg",
  ].join(" ");
}
