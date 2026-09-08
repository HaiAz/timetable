"use client";

import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  applyTheme,
  DEFAULT_THEME_ID,
  isValidThemeId,
  THEMES,
  THEME_KEY,
} from "@/lib/themes";

/**
 * Chọn theme màu.
 *
 * Theme đã lưu được gán vào <html data-theme> bởi script inline trong layout,
 * trước lần vẽ đầu tiên, nên không bị nháy màu. Component này chỉ vẽ phần
 * điều khiển; nó đọc giá trị đã lưu qua `useSyncExternalStore` với server
 * snapshot là `null`, để markup lần đầu khớp nhau khi hydrate.
 */

function useStoredTheme(): string | null {
  return useSyncExternalStore(subscribe, getStored, () => null);
}

function subscribe(onChange: () => void) {
  // Tab khác có thể đổi theme.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getStored(): string {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (isValidThemeId(value)) return value;
  } catch {
    // Trình duyệt chặn localStorage — dùng theme mặc định.
  }
  return DEFAULT_THEME_ID;
}

/** Lưới ô màu đầy đủ, dùng trong trang Cài đặt. */
export function ThemePicker() {
  const [override, setOverride] = useState<string | null>(null);
  const stored = useStoredTheme();
  const mounted = stored !== null;
  const current = override ?? stored ?? DEFAULT_THEME_ID;

  function choose(id: string) {
    setOverride(id);
    applyTheme(id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      // Không lưu được thì vẫn áp dụng cho phiên này.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Màu giao diện"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {THEMES.map((theme) => {
        // Trước khi hydrate chưa đánh dấu ô nào, để markup server/client khớp.
        const selected = mounted && current === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(theme.id)}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-md border px-3 py-2 text-left",
              "transition-colors duration-(--dur-fast)",
              selected
                ? "border-primary bg-primary-bg"
                : "border-line bg-surface hover:border-line-strong hover:bg-surface-hover",
            )}
          >
            {/* Ô màu dùng bậc 500 nguyên bản — nhận diện rõ hơn màu nút đã làm đậm */}
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full",
                selected && "ring-2 ring-white/70",
              )}
              style={{ background: theme.swatch }}
              aria-hidden="true"
            >
              {selected && (
                <svg viewBox="0 0 16 16" className="size-4 text-white" fill="none">
                  <path
                    d="m4 8.5 2.5 2.5L12 5.5"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>

            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate text-sm font-medium",
                  selected ? "text-primary" : "text-fg",
                )}
              >
                {theme.name}
              </span>
              <span className="block truncate text-2xs text-fg-subtle">
                {theme.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
