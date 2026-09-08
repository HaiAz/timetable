"use client";

import { Suspense, useId, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { WarnIcon } from "@/components/ui/badge";

/**
 * Trang nhập mật mã.
 *
 * Mật mã được gửi lên `/api/verify` để máy chủ kiểm tra — trang này không hề
 * biết mật mã đúng là gì, nên xem mã nguồn trình duyệt cũng không lộ.
 *
 * `useSearchParams` (để đọc `?next=`) buộc phần dùng nó phải nằm trong
 * `<Suspense>`, nếu không Next.js không prerender được trang này.
 */
export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyShell />}>
      <VerifyForm />
    </Suspense>
  );
}

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputId = useId();

  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!passcode.trim() || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message ?? "Mật mã không đúng.");
        setPasscode("");
        return;
      }

      // Chốt chặn đọc cookie ở phía máy chủ, nên phải tải lại từ máy chủ chứ
      // không dùng điều hướng phía trình duyệt.
      const next = safeNext(searchParams.get("next"));
      router.replace(next);
      router.refresh();
    } catch {
      setError("Không gửi được yêu cầu. Kiểm tra kết nối mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <VerifyShell>
      <form
        onSubmit={(event) => void submit(event)}
        className="mt-5 rounded-xl border border-line bg-surface p-4 shadow-sm"
      >
          <Field label="Mật mã" htmlFor={inputId} error={error ?? undefined}>
            <Input
              id={inputId}
              type="password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              autoFocus
              autoComplete="current-password"
              // Trình duyệt di động hay tự viết hoa chữ đầu, làm sai mật mã.
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={error !== null}
              placeholder="Nhập mật mã"
            />
          </Field>

        <Button
          type="submit"
          intent="primary"
          className="mt-3 w-full"
          loading={busy}
          disabled={!passcode.trim()}
        >
          Vào ứng dụng
        </Button>
      </form>
    </VerifyShell>
  );
}

/**
 * Khung tĩnh của trang: logo, tiêu đề, ghi chú. Dùng chung cho form và cho
 * `fallback` của Suspense, nên lúc chờ không bị nhảy layout.
 */
function VerifyShell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-inset px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white">
            <LockIcon />
          </span>
          <h1 className="text-lg font-semibold text-fg">Lịch dạy</h1>
          <p className="text-sm text-fg-muted">Nhập mật mã để vào ứng dụng.</p>
        </div>

        {children}

        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-fg-subtle">
          <WarnIcon className="mt-0.5 shrink-0" />
          <span>
            Xác thực một lần, trình duyệt này sẽ được ghi nhớ cho các lần sau.
          </span>
        </p>
      </div>
    </main>
  );
}

/** Chỉ nhận đường dẫn nội bộ — chặn chuyển hướng ra trang ngoài. */
function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <rect
        x="4.25"
        y="8.75"
        width="11.5"
        height="7.5"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 8.5V6.5a3 3 0 1 1 6 0v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
