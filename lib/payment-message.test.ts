import { describe, expect, it } from "vitest";
import { buildPaymentMessage } from "./payment-message";

describe("buildPaymentMessage", () => {
  const base = {
    month: "2026-09",
    studentName: "Gia Như",
    sessionCount: 8,
    amount: 2_400_000,
  };

  it("dựng đúng nội dung tin nhắn mẫu", () => {
    expect(buildPaymentMessage(base)).toBe(
      [
        "Dạ tháng 9 vừa rồi em dạy Gia Như được 8 buổi là 2.400.000",
        "STK: 1016298521",
        "Ngân hàng: Vietcombank",
        "CTK: Võ Nguyễn Ngân Uyên",
        "Em gửi học phí tháng 9 của Gia Như",
      ].join("\n"),
    );
  });

  it("bỏ số 0 ở đầu tháng", () => {
    const text = buildPaymentMessage({ ...base, month: "2026-01" });
    expect(text).toContain("Dạ tháng 1 vừa rồi");
    expect(text).toContain("học phí tháng 1 của");
    expect(text).not.toContain("tháng 01");
  });

  it("giữ nguyên tháng hai chữ số", () => {
    const text = buildPaymentMessage({ ...base, month: "2026-12" });
    expect(text).toContain("Dạ tháng 12 vừa rồi");
  });

  it("ngăn cách nghìn theo kiểu Việt Nam, không kèm ký hiệu đồng", () => {
    expect(buildPaymentMessage({ ...base, amount: 770_000 })).toContain(
      "được 8 buổi là 770.000",
    );
    // Chỉ chặn ký hiệu tiền tệ — chữ "đ" vẫn xuất hiện trong "được", "đồng".
    expect(buildPaymentMessage(base)).not.toContain("₫");
  });

  it("dùng đúng tên học sinh ở cả hai chỗ", () => {
    const text = buildPaymentMessage({ ...base, studentName: "Bi Boy" });
    expect(text).toContain("em dạy Bi Boy được");
    expect(text).toContain("của Bi Boy");
  });

  it("không chèn ký tự định dạng — dán đâu cũng đọc được nguyên văn", () => {
    expect(buildPaymentMessage(base)).not.toContain("*");
    expect(buildPaymentMessage(base)).not.toContain("_");
  });
});
