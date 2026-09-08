"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/data-provider";
import { StudentDialog } from "@/components/students/student-dialog";
import { StudentHistoryDialog } from "@/components/students/student-history-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader, StudentAvatar } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { LoadingRegion, StudentListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PlusIcon, UsersIcon } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { store } from "@/lib/store";
import { currentMonth, monthOf } from "@/lib/date";
import { formatRate, initials, sessionCountLabel } from "@/lib/format";
import { hexForColor } from "@/lib/colors";
import type { Student } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Students.
 *
 * Deleting a student who has history is deliberately made harder than
 * archiving: their sessions carry the debt record, so destroying them loses
 * money owed.
 */
export default function StudentsPage() {
  const { data, isLoading, run } = useData();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | undefined>(undefined);
  const [history, setHistory] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const month = currentMonth();

  /** Session counts for this month, plus a lifetime total per student. */
  const stats = useMemo(() => {
    const map = new Map<string, { thisMonth: number; total: number }>();
    for (const student of data.students) {
      map.set(student.id, { thisMonth: 0, total: 0 });
    }
    for (const session of data.sessions) {
      const entry = map.get(session.studentId);
      if (!entry) continue;
      entry.total++;
      if (monthOf(session.date) === month) entry.thisMonth++;
    }
    return map;
  }, [data.students, data.sessions, month]);

  const active = useMemo(
    () =>
      data.students
        .filter((s) => !s.archived)
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [data.students],
  );

  const archived = useMemo(
    () =>
      data.students
        .filter((s) => s.archived)
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [data.students],
  );

  /* Actions ----------------------------------------------------------- */

  function openAdd() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(student: Student) {
    setEditing(student);
    setDialogOpen(true);
  }

  async function archive(student: Student) {
    await run(() => store.setStudentArchived(student.id, true));
    toast({
      message: `Đã lưu trữ ${student.name}.`,
      tone: "success",
      onUndo: () => void run(() => store.setStudentArchived(student.id, false)),
    });
  }

  async function unarchive(student: Student) {
    await run(() => store.setStudentArchived(student.id, false));
    toast({
      message: `${student.name} đã học lại.`,
      tone: "success",
      onUndo: () => void run(() => store.setStudentArchived(student.id, true)),
    });
  }

  async function remove(student: Student) {
    await run(() => store.deleteStudent(student.id));
    setDeleting(null);
    toast({ message: `Đã xoá ${student.name} và toàn bộ dữ liệu liên quan.`, tone: "success" });
  }

  /* Loading ----------------------------------------------------------- */
  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <LoadingRegion label="Đang tải danh sách học sinh">
          <StudentListSkeleton />
        </LoadingRegion>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Học sinh"
        description={
          data.students.length > 0
            ? `${active.length} đang học${archived.length > 0 ? ` · ${archived.length} đã lưu trữ` : ""}`
            : undefined
        }
        actions={
          data.students.length > 0 ? (
            <Button intent="primary" onClick={openAdd}>
              <PlusIcon />
              Thêm học sinh
            </Button>
          ) : undefined
        }
      />

      {data.students.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="Chưa có học sinh nào"
          description="Mỗi học sinh có đơn giá riêng — ví dụ 45 phút 100.000 ₫. Học phí từng buổi được tính theo đơn giá đó, nên hãy thêm học sinh trước khi xếp lịch."
          actions={
            <Button intent="primary" onClick={openAdd}>
              <PlusIcon />
              Thêm học sinh đầu tiên
            </Button>
          }
        />
      ) : (
        <>
          {/* Active students */}
          {active.length === 0 ? (
            <EmptyState
              title="Không còn học sinh nào đang học"
              description="Tất cả học sinh đã được lưu trữ. Bạn có thể cho học lại hoặc thêm học sinh mới."
              actions={
                <Button intent="primary" onClick={openAdd}>
                  <PlusIcon />
                  Thêm học sinh
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {active.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  stats={stats.get(student.id)}
                  onEdit={() => openEdit(student)}
                  onHistory={() => setHistory(student)}
                  onArchive={() => void archive(student)}
                  onDelete={() => setDeleting(student)}
                />
              ))}
            </ul>
          )}

          {/* Archived students, behind a disclosure */}
          {archived.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-expanded={showArchived}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 text-left text-sm font-medium text-fg-muted hover:text-fg sm:min-h-9"
              >
                <svg
                  viewBox="0 0 16 16"
                  className={cn(
                    "size-3.5 transition-transform duration-(--dur-fast)",
                    showArchived && "rotate-90",
                  )}
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Đã lưu trữ ({archived.length})
              </button>

              {showArchived && (
                <ul className="mt-2 flex flex-col gap-2">
                  {archived.map((student) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      stats={stats.get(student.id)}
                      onEdit={() => openEdit(student)}
                      onHistory={() => setHistory(student)}
                      onUnarchive={() => void unarchive(student)}
                      onDelete={() => setDeleting(student)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {/* Keyed so switching between add/edit remounts with fresh form state. */}
      {dialogOpen && (
        <StudentDialog
          key={editing?.id ?? "new"}
          student={editing}
          onClose={() => setDialogOpen(false)}
        />
      )}
      <StudentHistoryDialog student={history} onClose={() => setHistory(null)} />
      <DeleteStudentDialog
        student={deleting}
        sessionCount={deleting ? (stats.get(deleting.id)?.total ?? 0) : 0}
        onClose={() => setDeleting(null)}
        onArchive={(student) => {
          setDeleting(null);
          void archive(student);
        }}
        onConfirm={(student) => void remove(student)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StudentRow({
  student,
  stats,
  onEdit,
  onHistory,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  student: Student;
  stats?: { thisMonth: number; total: number };
  onEdit: () => void;
  onHistory: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3",
        student.archived && "bg-surface-inset",
      )}
    >
      <StudentAvatar
        initial={initials(student.name)}
        color={hexForColor(student.color)}
        archived={student.archived}
      />

      <div className="min-w-0 flex-1 basis-40">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-base font-medium text-fg">{student.name}</p>
          {student.archived && <Badge tone="neutral">Đã lưu trữ</Badge>}
        </div>
        <p className="truncate text-xs text-fg-subtle">
          {student.contact || "Chưa có liên hệ"}
          {student.note ? ` · ${student.note}` : ""}
        </p>
      </div>

      {/* Rate — the number that drives every calculation */}
      <div className="shrink-0 text-right">
        <p className="font-mono tnum text-sm font-medium text-fg">
          {formatRate(student.baseMinutes, student.basePrice)}
        </p>
        <p className="text-xs text-fg-subtle">
          {stats && stats.thisMonth > 0
            ? `${sessionCountLabel(stats.thisMonth)} tháng này`
            : "Chưa có buổi tháng này"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button intent="quiet" size="sm" onClick={onHistory}>
          Lịch sử
        </Button>
        <Button intent="quiet" size="sm" onClick={onEdit}>
          Sửa
        </Button>
        {onArchive && (
          <Button intent="quiet" size="sm" onClick={onArchive}>
            Lưu trữ
          </Button>
        )}
        {onUnarchive && (
          <Button intent="quiet" size="sm" onClick={onUnarchive}>
            Học lại
          </Button>
        )}
        <Button
          intent="quiet"
          size="icon"
          onClick={onDelete}
          aria-label={`Xoá ${student.name}`}
          className="text-fg-subtle hover:text-overdue-fg"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
            <path
              d="M3 5h10M6.5 5V3.5h3V5M4.5 5l.5 8h6l.5-8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      </div>
    </li>
  );
}

/**
 * Deleting a student with history is destructive — it removes the sessions
 * that prove what is owed. Archiving is offered as the primary action.
 */
function DeleteStudentDialog({
  student,
  sessionCount,
  onClose,
  onArchive,
  onConfirm,
}: {
  student: Student | null;
  sessionCount: number;
  onClose: () => void;
  onArchive: (student: Student) => void;
  onConfirm: (student: Student) => void;
}) {
  if (!student) return null;

  const hasHistory = sessionCount > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={hasHistory ? `Xoá ${student.name}?` : `Xoá ${student.name}?`}
      description={
        hasHistory
          ? `Học sinh này có ${sessionCountLabel(sessionCount)} trong lịch sử.`
          : "Học sinh này chưa có buổi học nào."
      }
      size="sm"
      tone="danger"
      footer={
        hasHistory ? (
          <>
            <Button intent="quiet" onClick={onClose}>
              Huỷ
            </Button>
            <Button intent="danger" onClick={() => onConfirm(student)}>
              Vẫn xoá vĩnh viễn
            </Button>
            <Button
              intent="primary"
              onClick={() => onArchive(student)}
              data-autofocus
            >
              Lưu trữ thay vì xoá
            </Button>
          </>
        ) : (
          <>
            <Button intent="secondary" onClick={onClose}>
              Huỷ
            </Button>
            <Button intent="danger" onClick={() => onConfirm(student)} data-autofocus>
              Xoá học sinh
            </Button>
          </>
        )
      }
    >
      {hasHistory ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-overdue-border bg-overdue-bg px-3 py-2.5 text-sm text-overdue-fg">
            <p className="font-semibold">Xoá sẽ mất vĩnh viễn:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>{sessionCountLabel(sessionCount)} trong lịch sử dạy</li>
              <li>Toàn bộ học phí đã tính và tình trạng đã thu / còn nợ</li>
            </ul>
          </div>
          <div className="rounded-md border border-paid-border bg-paid-bg px-3 py-2.5 text-sm text-paid-fg">
            <p className="font-semibold">Nên lưu trữ:</p>
            <p className="mt-0.5">
              Học sinh sẽ không còn hiện khi thêm buổi học mới, nhưng vẫn giữ lịch sử và
              vẫn xuất hiện ở trang nợ học phí nếu còn nợ.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-base text-fg-muted">Hành động này không thể hoàn tác.</p>
      )}
    </Dialog>
  );
}
