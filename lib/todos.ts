import type { TodoPriority } from "./types";

/** Nhãn hiển thị và tone màu cho từng mức ưu tiên. */
export const TODO_PRIORITY_META: Record<
  TodoPriority,
  { label: string; tone: "urgent" | "unpaid" | "low" }
> = {
  urgent: { label: "Gấp", tone: "urgent" },
  normal: { label: "Bình thường", tone: "unpaid" },
  low: { label: "Không gấp", tone: "low" },
};

/** Thứ tự hiển thị: gấp trước, không gấp sau. */
export const TODO_PRIORITY_ORDER: TodoPriority[] = ["urgent", "normal", "low"];
