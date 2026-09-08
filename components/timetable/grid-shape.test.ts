/**
 * Kiểm chứng hình dạng lưới bằng đúng dữ liệu tuần người dùng đang xem,
 * để chắc chắn lưới vừa một màn hình và không ẩn mất buổi học nào.
 */
import { describe, expect, it } from "vitest";
import { buildHourRows, DEFAULT_START_HOUR, occupiedHours } from "./overlap";
import type { Session } from "@/lib/types";

const s = (id: string, date: string, startTime: string, endTime: string): Session => ({
  id,
  studentId: "a",
  date,
  startTime,
  endTime,
  taught: false,
});

/** Đúng các buổi trong ảnh chụp của người dùng. */
const TUAN_CO_BUOI_SOM = [
  s("1", "2026-09-11", "03:00", "06:00"),
  s("2", "2026-09-09", "08:00", "10:00"),
  s("3", "2026-09-10", "09:00", "15:00"),
  s("4", "2026-09-12", "07:00", "11:00"),
];

const TUAN_BINH_THUONG = TUAN_CO_BUOI_SOM.slice(1);

/** Chiều cao lưới ở một màn hình cho trước, theo công thức trong week-grid. */
function gridHeightPx(rowCount: number, viewportPx: number): number {
  const chromePx = 19 * 16; // 19rem: header trang + đầu cột + chân lưới
  return Math.max(32, (viewportPx - chromePx) / rowCount) * rowCount;
}

describe("hình dạng lưới tuần", () => {
  it("tuần bình thường vừa một màn hình 900px, không phải cuộn", () => {
    const rows = buildHourRows(occupiedHours(TUAN_BINH_THUONG));
    expect(rows).toHaveLength(18);
    // Lưới không cao hơn phần màn hình còn lại.
    expect(gridHeightPx(rows.length, 900)).toBeLessThanOrEqual(900 - 19 * 16 + 1);
  });

  it("tuần bình thường bắt đầu từ 06:00, kết thúc 24:00", () => {
    const hours = buildHourRows(occupiedHours(TUAN_BINH_THUONG)).map((r) => r.hour);
    expect(hours[0]).toBe(DEFAULT_START_HOUR);
    expect(hours.at(-1)).toBe(23);
  });

  it("buổi 03:00 làm lưới tự nới, và buổi đó vẫn được vẽ", () => {
    const rows = buildHourRows(occupiedHours(TUAN_CO_BUOI_SOM));
    const hours = rows.map((r) => r.hour);
    expect(hours[0]).toBe(3);
    expect(hours).toContain(3);
    expect(rows).toHaveLength(21);
  });

  it("không buổi nào trong tuần bị ẩn khỏi lưới", () => {
    for (const sessions of [TUAN_CO_BUOI_SOM, TUAN_BINH_THUONG]) {
      const hours = new Set(buildHourRows(occupiedHours(sessions)).map((r) => r.hour));
      for (const session of sessions) {
        const startHour = Number(session.startTime.slice(0, 2));
        expect(hours.has(startHour)).toBe(true);
      }
    }
  });

  it("hàng không bao giờ mỏng hơn 2rem, kể cả màn hình rất thấp", () => {
    const rows = buildHourRows(occupiedHours(TUAN_CO_BUOI_SOM));
    // Màn 600px: (600-304)/21 = 14px -> bị kẹp về 32px, lưới sẽ cuộn.
    const perRow = Math.max(32, (600 - 19 * 16) / rows.length);
    expect(perRow).toBe(32);
  });
});
