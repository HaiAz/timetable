/**
 * Cổng mật mã — lớp chặn người lạ ở cửa trước.
 *
 * ⚠️ GIỚI HẠN: đây KHÔNG phải bảo mật dữ liệu. Cổng này chỉ chặn ở tầng
 * Next.js. Firestore vẫn mở theo `firestore.rules`, nên ai biết `projectId`
 * (nằm sẵn trong bundle trình duyệt) vẫn đọc/ghi thẳng vào cơ sở dữ liệu được,
 * bỏ qua hoàn toàn trang /verify. Muốn bảo vệ thật thì phải bật Firebase Auth
 * và siết security rules — xem hướng dẫn trong `firestore.rules`.
 *
 * Cách hoạt động: mật mã chỉ tồn tại trên máy chủ. Người dùng gửi mật mã lên
 * Route Handler; nếu đúng, máy chủ đặt một cookie chứa CHỮ KÝ HMAC chứ không
 * chứa mật mã. Nhờ vậy xem được cookie cũng không suy ra được mật mã, và không
 * thể tự chế cookie hợp lệ nếu không biết khoá bí mật.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// Đường dẫn và tên cookie sống ở `auth-shared` để client component dùng được
// mà không kéo theo `node:crypto`; re-export ở đây cho phía máy chủ tiện dùng.
export { AUTH_COOKIE, VERIFY_PATH } from "./auth-shared";

/**
 * Thời hạn cookie — đặt dài nhất có thể, xác thực một lần rồi thôi.
 *
 * 400 ngày là trần mà trình duyệt thực sự chấp nhận (RFC 6265bis); khai lớn
 * hơn thì Chrome/Safari tự cắt xuống mức này, nên đây đã là "vĩnh viễn" trên
 * thực tế. Muốn thu hồi mọi phiên thì đổi `AUTH_SECRET`.
 */
export const AUTH_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * Mật mã và khoá ký, đọc từ biến môi trường phía máy chủ.
 *
 * Cả hai đều KHÔNG có tiền tố `NEXT_PUBLIC_`, nên Next.js không nhúng chúng
 * vào bundle trình duyệt — chúng chỉ tồn tại trên máy chủ.
 */
function passcode(): string {
  return process.env.APP_PASSCODE ?? "";
}

/**
 * Khoá dùng để ký cookie. Nếu không đặt riêng thì suy ra từ chính mật mã —
 * tiện khi chạy cục bộ, và có tác dụng phụ hợp lý: đổi mật mã thì mọi phiên cũ
 * hết hiệu lực.
 */
function signingKey(): string {
  return process.env.AUTH_SECRET || `derived:${passcode()}`;
}

/** Cổng chỉ bật khi đã cấu hình mật mã. Bỏ trống nghĩa là không khoá. */
export function isAuthEnabled(): boolean {
  return passcode().length > 0;
}

/**
 * Chữ ký hợp lệ cho phiên đã xác thực.
 *
 * Chỉ phụ thuộc vào khoá bí mật, nên mọi thiết bị đã xác thực dùng chung một
 * giá trị — đủ dùng cho ứng dụng một người, và đổi mật mã là mọi cookie cũ
 * lập tức vô hiệu.
 */
export function expectedToken(): string {
  return createHmac("sha256", signingKey()).update("verified").digest("hex");
}

/** So sánh hai chuỗi theo thời gian hằng số, tránh rò rỉ qua thời gian phản hồi. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // `timingSafeEqual` ném lỗi nếu độ dài khác nhau, nên phải chặn trước — và
  // chính việc độ dài khác nhau đã đủ kết luận là không khớp.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Mật mã người dùng nhập có đúng không. */
export function isPasscodeCorrect(input: string): boolean {
  const expected = passcode();
  if (!expected) return false;
  return safeEqual(input.trim(), expected);
}

/** Giá trị cookie có phải chữ ký hợp lệ không. */
export function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  return safeEqual(token, expectedToken());
}
