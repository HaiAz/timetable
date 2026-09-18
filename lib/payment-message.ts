/**
 * Tin nhắn nhắc học phí gửi phụ huynh.
 *
 * Thông tin tài khoản là cố định của chủ lớp nên để thẳng ở đây; ảnh QR nằm
 * trong `public/` và được copy kèm khi trình duyệt cho phép.
 */

export const BANK_ACCOUNT = {
  number: "1016298521",
  bank: "Vietcombank",
  holder: "Võ Nguyễn Ngân Uyên",
} as const;

/** "2026-09" -> "9" — tháng trần, dùng trong câu tin nhắn. */
function monthNumber(month: string): string {
  const [, m] = month.split("-");
  return String(Number(m));
}

/** Số tiền dạng "1.200.000" — không kèm ký hiệu đơn vị. */
function plainAmount(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

export function buildPaymentMessage({
  month,
  studentName,
  sessionCount,
  amount,
}: {
  /** YYYY-MM */
  month: string;
  studentName: string;
  sessionCount: number;
  amount: number;
}): string {
  const m = monthNumber(month);
  return [
    `Dạ tháng ${m} vừa rồi em dạy ${studentName} được ${sessionCount} buổi là ${plainAmount(amount)}`,
    `STK: ${BANK_ACCOUNT.number}`,
    `Ngân hàng: ${BANK_ACCOUNT.bank}`,
    `CTK: ${BANK_ACCOUNT.holder}`,
    `Em gửi học phí tháng ${m} của ${studentName}`,
  ].join("\n");
}
