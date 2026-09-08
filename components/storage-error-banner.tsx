"use client";

import { useState } from "react";
import { useData } from "./data-provider";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";
import { AlertIcon } from "./ui/empty-state";
import { store } from "@/lib/store";
import { downloadBackup, downloadRaw } from "@/lib/backup";

/**
 * Surfaces storage failures with a recovery path, never a dead end.
 *
 *  - corrupt data: offer to download the unreadable raw data as a backup
 *    *before* resetting, so nothing is lost irretrievably
 *  - quota exceeded: hạn mức Firebase trong ngày đã hết
 *  - unavailable: mất mạng, sai cấu hình, hoặc security rules từ chối
 */
export function StorageErrorBanner() {
  const { error, refresh, clearError } = useData();
  const [confirmReset, setConfirmReset] = useState(false);
  const [savedBackup, setSavedBackup] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!error) return null;

  async function retry() {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }

  async function saveRawBackup() {
    const raw = await store.readRawUnsafe();
    downloadRaw(raw ?? "", "loi-du-lieu");
    setSavedBackup(true);
  }

  async function saveNormalBackup() {
    try {
      downloadBackup(await store.exportJSON());
    } catch {
      // If even export fails, fall back to the raw string.
      await saveRawBackup();
    }
  }

  async function reset() {
    await store.reset();
    clearError();
    await refresh();
  }

  return (
    <div
      role="alert"
      className="border-b border-overdue-border bg-overdue-bg px-4 py-3"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2.5 sm:flex-row sm:items-start">
        <span className="shrink-0 text-overdue-fg">
          <AlertIcon />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-overdue-fg">
            {error.kind === "corrupt" && "Dữ liệu đã lưu bị lỗi"}
            {error.kind === "quota" && "Đã hết hạn mức Firebase"}
            {error.kind === "unavailable" && "Không kết nối được tới Firebase"}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-overdue-fg">
            {error.message}
            {error.kind === "corrupt" &&
              " Hãy tải bản sao lưu về máy trước khi đặt lại, để không mất dữ liệu."}
            {error.kind === "quota" &&
              " Hạn mức đọc/ghi miễn phí được cấp lại vào đầu ngày hôm sau."}
            {error.kind === "unavailable" &&
              " Dữ liệu trên máy chủ vẫn an toàn, nhưng thay đổi bạn thực hiện lúc này sẽ không được lưu."}
          </p>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {error.kind === "corrupt" && (
              <>
                <Button intent="secondary" size="sm" onClick={saveRawBackup}>
                  {savedBackup ? "Đã tải bản sao lưu ✓" : "Tải bản sao lưu"}
                </Button>
                <Button
                  intent="danger"
                  size="sm"
                  onClick={() => setConfirmReset(true)}
                >
                  Đặt lại dữ liệu
                </Button>
              </>
            )}

            {error.kind === "quota" && (
              <>
                <Button intent="secondary" size="sm" onClick={saveNormalBackup}>
                  Xuất dữ liệu
                </Button>
                <Button intent="quiet" size="sm" onClick={clearError}>
                  Đã hiểu
                </Button>
              </>
            )}

            {error.kind === "unavailable" && (
              <>
                <Button
                  intent="secondary"
                  size="sm"
                  onClick={() => void retry()}
                  loading={retrying}
                >
                  Thử lại
                </Button>
                <Button intent="quiet" size="sm" onClick={clearError}>
                  Đã hiểu
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void reset()}
        title="Đặt lại toàn bộ dữ liệu?"
        description="Toàn bộ học sinh, buổi học và hoá đơn sẽ bị xoá khỏi Firebase, trên mọi thiết bị. Không thể hoàn tác."
        confirmLabel="Xoá và bắt đầu lại"
        tone="danger"
      >
        {!savedBackup && (
          <p className="rounded-md border border-unpaid-border bg-unpaid-bg px-3 py-2 text-sm text-unpaid-fg">
            Bạn chưa tải bản sao lưu. Nên tải về trước khi đặt lại.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
