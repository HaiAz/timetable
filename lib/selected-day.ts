import { startOfWeek } from "./date";

/**
 * Ngày được chọn trên thời khoá biểu, luôn nằm trong tuần đang xem.
 *
 * Tách khỏi component để kiểm thử được: đây là chỗ từng gây lỗi "đang xem tuần
 * 20/7 nhưng Thêm buổi lại mở ra ngày hôm nay 8/9".
 *
 * Thứ tự ưu tiên:
 *  1. Ngày người dùng tự chọn, nếu nó thuộc tuần đang xem
 *  2. Hôm nay, nếu hôm nay thuộc tuần đang xem
 *  3. Thứ 2 của tuần đang xem
 */
export function resolveSelectedDay(
  weekStart: string | null,
  today: string | null,
  dayOverride: string | null,
): string | null {
  if (!weekStart) return null;

  if (dayOverride && startOfWeek(dayOverride) === weekStart) {
    return dayOverride;
  }
  if (today && startOfWeek(today) === weekStart) {
    return today;
  }
  return weekStart;
}
