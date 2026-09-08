"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WarnIcon } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ThemePicker } from "@/components/theme-picker";
import { store, StoreError, type ImportResult } from "@/lib/store";
import { downloadBackup, readFileAsText } from "@/lib/backup";
import { formatBytes, studentCountLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Settings — mainly backup. Dữ liệu nằm trên Firebase nên không còn mất khi xoá
 * dữ liệu trình duyệt, nhưng xuất tệp vẫn cần: một thao tác xoá nhầm sẽ đồng bộ
 * ngay sang mọi thiết bị, và Firestore không có nút hoàn tác.
 */
export default function SettingsPage() {
  const { data, isLoading, refresh } = useData();
  const { toast } = useToast();

  const fileInput = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState<number | null>(null);
  const [pending, setPending] = useState<{ json: string; result: ImportResult } | null>(
    null,
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void store.storageSize().then(setSize);
  }, [data]);

  /* Export ------------------------------------------------------------ */
  async function exportData() {
    try {
      downloadBackup(await store.exportJSON());
      toast({ message: "Đã tải tệp sao lưu về máy.", tone: "success" });
    } catch (error) {
      toast({
        message:
          error instanceof StoreError ? error.message : "Không xuất được dữ liệu.",
        tone: "error",
      });
    }
  }

  /* Import ------------------------------------------------------------ */
  async function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-picking the same file later.
    event.target.value = "";
    if (!file) return;

    setImportError(null);
    setBusy(true);

    try {
      const json = await readFileAsText(file);

      // Validate *before* offering to overwrite — a bad file must never
      // touch existing data.
      const parsed = JSON.parse(json) as unknown;
      const validated = validateShape(parsed);

      setPending({ json, result: validated });
    } catch (error) {
      setImportError(
        error instanceof SyntaxError
          ? `Tệp không phải JSON hợp lệ: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Không đọc được tệp.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await store.importJSON(pending.json);
      await refresh();
      toast({
        message: `Đã nhập ${result.students} học sinh, ${result.sessions} buổi học.`,
        tone: "success",
      });
      setPending(null);
    } catch (error) {
      setImportError(
        error instanceof StoreError ? error.message : "Không nhập được dữ liệu.",
      );
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  /* Reset ------------------------------------------------------------- */
  async function reset() {
    await store.reset();
    await refresh();
    setConfirmReset(false);
    toast({ message: "Đã xoá toàn bộ dữ liệu.", tone: "success" });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title="Cài đặt" />

      {/* ---------------- Backup ---------------- */}
      <Card className="p-4">
        <h2 className="text-md font-semibold text-fg">Sao lưu dữ liệu</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">
          Dữ liệu được lưu trên Firebase và tự đồng bộ giữa các thiết bị, nên đổi
          máy hay xoá dữ liệu trình duyệt đều không làm mất. Vẫn nên xuất tệp sao
          lưu định kỳ: xoá nhầm sẽ lan sang mọi thiết bị và không hoàn tác được.
        </p>

        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-md border border-line bg-surface-inset px-3 py-2 text-sm">
          <Stat label="Học sinh" value={isLoading ? null : String(data.students.length)} />
          <Stat label="Buổi học" value={isLoading ? null : String(data.sessions.length)} />
          <Stat label="Việc cần làm" value={isLoading ? null : String(data.todos.length)} />
          <Stat label="Dung lượng" value={size === null ? null : formatBytes(size)} />
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button intent="primary" onClick={() => void exportData()} disabled={isLoading}>
            <DownloadIcon />
            Xuất dữ liệu
          </Button>
          <Button
            intent="secondary"
            onClick={() => fileInput.current?.click()}
            loading={busy && !pending}
          >
            <UploadIcon />
            Nhập dữ liệu
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void pickFile(e)}
            className="sr-only"
            aria-label="Chọn tệp sao lưu để nhập"
          />
        </div>

        {importError && (
          <div
            role="alert"
            className="mt-3 flex gap-2 rounded-md border border-overdue-border bg-overdue-bg px-3 py-2.5 text-sm text-overdue-fg"
          >
            <WarnIcon className="mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold">Không nhập được tệp</p>
              <p className="mt-0.5 wrap-break-word">{importError}</p>
              <p className="mt-1 text-xs opacity-80">
                Dữ liệu hiện tại của bạn chưa bị thay đổi.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ---------------- Appearance ---------------- */}
      <Card className="p-4">
        <h2 className="text-md font-semibold text-fg">Màu giao diện</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">
          Chọn màu chủ đạo cho ứng dụng. Màu áp dụng ngay và được ghi nhớ riêng
          trên trình duyệt này, không đồng bộ sang thiết bị khác.
        </p>
        <div className="mt-3">
          <ThemePicker />
        </div>
        <p className="mt-3 border-t border-line pt-2.5 text-xs text-fg-subtle">
          Màu thể hiện tình trạng học phí — đã thu, chưa thu, quá hạn — giữ
          nguyên ở mọi theme, để bạn luôn nhận ra ngay mà không phải nhớ lại.
        </p>
      </Card>

      {/* ---------------- How billing works ---------------- */}
      <Card className="p-4" tone="inset">
        <h2 className="text-md font-semibold text-fg">Cách tính học phí</h2>
        <p className="mt-1.5 font-mono text-xs leading-relaxed text-fg-muted">
          Học phí buổi = làm tròn( số phút × đơn giá ÷ đơn vị thời lượng ÷ 1.000 ) × 1.000
        </p>
        <ul className="mt-2 flex list-inside list-disc flex-col gap-1 text-sm text-fg-muted">
          <li>Tính theo tỉ lệ thời gian, làm tròn đến nghìn đồng gần nhất.</li>
          <li>Chỉ buổi đã đánh dấu “đã dạy” mới được tính tiền.</li>
          <li>
            Khi đánh dấu đã dạy, đơn giá được ghi lại — tăng giá về sau không làm
            thay đổi học phí các buổi đã dạy.
          </li>
        </ul>
      </Card>

      {/* ---------------- Danger zone ---------------- */}
      <Card className="border-overdue-border p-4">
        <h2 className="text-md font-semibold text-overdue-fg">
          Xoá toàn bộ dữ liệu
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Xoá tất cả học sinh, buổi học và hoá đơn khỏi Firebase, trên mọi thiết
          bị. Không thể hoàn tác.
        </p>
        <Button
          intent="danger"
          className="mt-3"
          onClick={() => setConfirmReset(true)}
          disabled={isLoading || data.students.length + data.sessions.length === 0}
        >
          Xoá toàn bộ dữ liệu
        </Button>
      </Card>

      {/* ---------------- Import confirmation ---------------- */}
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Ghi đè dữ liệu hiện tại?"
        description="Nhập tệp sao lưu sẽ thay thế toàn bộ dữ liệu trên Firebase, áp dụng cho mọi thiết bị."
        size="sm"
        tone="danger"
        footer={
          <>
            <Button intent="secondary" onClick={() => setPending(null)}>
              Huỷ
            </Button>
            <Button
              intent="danger"
              onClick={() => void confirmImport()}
              loading={busy}
              data-autofocus
            >
              Ghi đè và nhập
            </Button>
          </>
        }
      >
        {pending && (
          <div className="flex flex-col gap-2.5">
            <Compare
              label="Dữ liệu hiện tại"
              students={data.students.length}
              sessions={data.sessions.length}
            />
            <div className="flex justify-center text-fg-subtle" aria-hidden="true">
              <svg viewBox="0 0 16 16" className="size-4" fill="none">
                <path d="M8 3v10M4.5 9.5 8 13l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <Compare
              label="Dữ liệu trong tệp"
              students={pending.result.students}
              sessions={pending.result.sessions}
              highlighted
            />
            <p className="text-xs text-fg-subtle">
              Nên xuất dữ liệu hiện tại trước, để có thể quay lại nếu cần.
            </p>
          </div>
        )}
      </Dialog>

      {/* ---------------- Reset confirmation ---------------- */}
      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Xoá toàn bộ dữ liệu?"
        description={`Sẽ xoá ${studentCountLabel(data.students.length)} và ${data.sessions.length} buổi học. Không thể hoàn tác.`}
        size="sm"
        tone="danger"
        footer={
          <>
            <Button intent="secondary" onClick={() => setConfirmReset(false)}>
              Huỷ
            </Button>
            <Button intent="danger" onClick={() => void reset()}>
              Xoá tất cả
            </Button>
          </>
        }
      >
        <Button
          intent="secondary"
          onClick={() => void exportData()}
          className="w-full"
          data-autofocus
        >
          <DownloadIcon />
          Xuất dữ liệu trước khi xoá
        </Button>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Shallow shape check for the import preview. The authoritative validation
 * lives in `store.importJSON`; this only produces the counts shown in the
 * confirmation dialog.
 */
function validateShape(parsed: unknown): ImportResult {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Tệp phải chứa một đối tượng JSON.");
  }
  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.students) || !Array.isArray(value.sessions)) {
    throw new Error(
      "Tệp không đúng định dạng sao lưu: thiếu danh sách “students” hoặc “sessions”.",
    );
  }
  return {
    students: value.students.length,
    sessions: value.sessions.length,
    bills: Array.isArray(value.bills) ? value.bills.length : 0,
    todos: Array.isArray(value.todos) ? value.todos.length : 0,
  };
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="font-mono tnum font-medium text-fg">
        {value === null ? <Skeleton className="inline-block h-3.5 w-8 align-middle" /> : value}
      </dd>
    </div>
  );
}

function Compare({
  label,
  students,
  sessions,
  highlighted = false,
}: {
  label: string;
  students: number;
  sessions: number;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        highlighted ? "border-primary-border bg-primary-bg" : "border-line bg-surface-inset",
      )}
    >
      <p className={cn("text-xs font-medium", highlighted ? "text-primary" : "text-fg-muted")}>
        {label}
      </p>
      <p className="mt-0.5 font-mono tnum text-sm text-fg">
        {students} học sinh · {sessions} buổi học
      </p>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path d="M8 2.5v7.5M4.5 7 8 10.5 11.5 7M2.75 13.25h10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path d="M8 10.5V3M4.5 6.5 8 3l3.5 3.5M2.75 13.25h10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
