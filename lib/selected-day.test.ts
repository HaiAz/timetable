/**
 * Ngày mặc định khi mở "Thêm buổi học".
 *
 * Từng có lỗi: đang xem tuần 20/7 nhưng dialog mở ra ngày hôm nay (8/9), nên
 * không nhập được buổi của tháng cũ.
 */
import { describe, expect, it } from "vitest";
import { resolveSelectedDay } from "./selected-day";

// 2026-09-07 là Thứ 2; tuần đó là 07/9 – 13/9.
const TUAN_NAY = "2026-09-07";
const HOM_NAY = "2026-09-08"; // Thứ 3

// 2026-07-20 là Thứ 2; tuần cũ 20/7 – 26/7.
const TUAN_CU = "2026-07-20";

describe("resolveSelectedDay", () => {
  it("lấy hôm nay khi đang xem tuần này", () => {
    expect(resolveSelectedDay(TUAN_NAY, HOM_NAY, null)).toBe(HOM_NAY);
  });

  it("lấy Thứ 2 của tuần cũ, KHÔNG lấy hôm nay", () => {
    // Đây là lỗi cũ: trước đây trả về HOM_NAY.
    expect(resolveSelectedDay(TUAN_CU, HOM_NAY, null)).toBe(TUAN_CU);
  });

  it("lấy Thứ 2 của tuần tương lai", () => {
    const tuanSau = "2026-10-05";
    expect(resolveSelectedDay(tuanSau, HOM_NAY, null)).toBe(tuanSau);
  });

  it("tôn trọng ngày người dùng tự chọn trong tuần đang xem", () => {
    const thuSau = "2026-09-11";
    expect(resolveSelectedDay(TUAN_NAY, HOM_NAY, thuSau)).toBe(thuSau);
  });

  it("bỏ qua ngày đã chọn nếu nó thuộc tuần khác", () => {
    // Người dùng chọn Thứ 6 tuần này rồi chuyển sang tuần cũ.
    const thuSauTuanNay = "2026-09-11";
    expect(resolveSelectedDay(TUAN_CU, HOM_NAY, thuSauTuanNay)).toBe(TUAN_CU);
  });

  it("ngày đã chọn ở tuần cũ vẫn được giữ khi xem chính tuần đó", () => {
    const thuTuTuanCu = "2026-07-22";
    expect(resolveSelectedDay(TUAN_CU, HOM_NAY, thuTuTuanCu)).toBe(thuTuTuanCu);
  });

  it("trả null khi chưa biết tuần (trước lúc hydrate)", () => {
    expect(resolveSelectedDay(null, null, null)).toBeNull();
    expect(resolveSelectedDay(null, HOM_NAY, null)).toBeNull();
  });

  it("vẫn hoạt động khi chưa biết hôm nay", () => {
    expect(resolveSelectedDay(TUAN_CU, null, null)).toBe(TUAN_CU);
  });

  it("kết quả luôn nằm trong tuần đang xem", () => {
    const cases: Array<[string, string | null, string | null]> = [
      [TUAN_NAY, HOM_NAY, null],
      [TUAN_CU, HOM_NAY, null],
      [TUAN_CU, HOM_NAY, "2026-09-11"],
      [TUAN_NAY, HOM_NAY, "2026-07-22"],
      ["2026-12-28", HOM_NAY, null], // tuần vắt qua năm mới
    ];
    for (const [weekStart, today, override] of cases) {
      const result = resolveSelectedDay(weekStart, today, override)!;
      // Ngày trả về phải thuộc đúng tuần đó.
      const diff =
        (new Date(result).getTime() - new Date(weekStart).getTime()) / 86_400_000;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(6);
    }
  });
});
