"use client";

import { cn } from "@/lib/cn";
import { COLOR_FAMILIES, hexForColor } from "@/lib/colors";

/**
 * Bảng chọn màu học sinh: 8 sắc × 5 độ đậm.
 *
 * "Không chọn" là một lựa chọn hợp lệ, không phải trạng thái thiếu — khối buổi
 * học sẽ để trắng. Vì vậy ô trắng đứng ngay đầu bảng, ngang hàng với các màu
 * khác, thay vì phải bỏ chọn màu đang có.
 *
 * Màu đã có học sinh khác dùng vẫn chọn được (bạn có thể muốn hai em cùng màu),
 * nhưng được đánh dấu để tránh trùng ngoài ý muốn.
 */
export function ColorGrid({
  value,
  onChange,
  /** Mã màu -> tên học sinh đang dùng, để cảnh báo trùng. */
  usedBy,
}: {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
  usedBy?: Map<string, string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Ô "không chọn" — mặc định, để trắng trên lịch */}
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-pressed={value === undefined}
        className={cn(
          "flex min-h-11 items-center gap-2.5 rounded-md border px-2.5 text-left sm:min-h-10",
          "transition-colors duration-(--dur-fast)",
          value === undefined
            ? "border-primary bg-primary-bg"
            : "border-line bg-surface hover:border-line-strong hover:bg-surface-hover",
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border",
            value === undefined ? "border-primary bg-surface" : "border-line-strong bg-surface",
          )}
        >
          {value === undefined && (
            <svg viewBox="0 0 16 16" className="size-4 text-primary" fill="none" aria-hidden="true">
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
              "block text-sm font-medium",
              value === undefined ? "text-primary" : "text-fg",
            )}
          >
            Không chọn màu
          </span>
          <span className="block text-2xs text-fg-subtle">
            Buổi học hiển thị nền trắng
          </span>
        </span>
      </button>

      {/* Lưới màu: mỗi hàng là một sắc, 5 bậc từ nhạt tới đậm */}
      <div className="flex flex-col gap-1">
        {COLOR_FAMILIES.map((family) => (
          <div key={family.id} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-2xs text-fg-subtle">
              {family.name}
            </span>
            <div className="flex flex-1 gap-1">
              {family.steps.map(({ step, hex }) => {
                const code = `${family.id}-${step}`;
                const selected = value === code;
                const takenBy = usedBy?.get(code);

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onChange(code)}
                    aria-pressed={selected}
                    aria-label={
                      takenBy
                        ? `${family.name} ${step}, đang dùng cho ${takenBy}`
                        : `${family.name} ${step}`
                    }
                    title={takenBy ? `${family.name} ${step} — ${takenBy} đang dùng` : `${family.name} ${step}`}
                    className={cn(
                      "relative flex h-9 flex-1 items-center justify-center rounded-md border-2",
                      "transition-transform duration-(--dur-fast) hover:scale-105",
                      selected ? "border-fg" : "border-transparent",
                    )}
                    style={{ background: hex }}
                  >
                    {selected && (
                      <svg
                        viewBox="0 0 16 16"
                        className="size-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="m4 8.5 2.5 2.5L12 5.5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    {/* Dấu chấm trắng = màu này đã có người dùng */}
                    {!selected && takenBy && (
                      <span
                        className="size-1.5 rounded-full bg-white/90 shadow-sm"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cảnh báo trùng — không chặn, chỉ báo */}
      {value && usedBy?.get(value) && (
        <p
          className="rounded-md border border-unpaid-border bg-unpaid-bg px-2.5 py-1.5 text-xs text-unpaid-fg"
          role="status"
        >
          Màu này {usedBy.get(value)} đang dùng. Hai học sinh cùng màu vẫn được,
          nhưng sẽ khó phân biệt trên thời khoá biểu.
        </p>
      )}

      {/* Xem trước màu đã chọn */}
      {value && !usedBy?.get(value) && (
        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <span
            className="size-3 rounded-full"
            style={{ background: hexForColor(value) ?? undefined }}
            aria-hidden="true"
          />
          Màu này chưa có học sinh nào dùng.
        </p>
      )}
    </div>
  );
}
