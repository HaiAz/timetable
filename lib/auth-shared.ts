/**
 * Hằng số của cổng mật mã dùng được ở cả hai phía.
 *
 * Tách khỏi `lib/auth.ts` vì tệp đó import `node:crypto` — chỉ chạy được trên
 * máy chủ. Client component cần biết đường dẫn trang xác thực thì lấy ở đây.
 */

/** Đường dẫn tới trang nhập mật mã. */
export const VERIFY_PATH = "/verify";

/** Tên cookie lưu chữ ký đã xác thực. */
export const AUTH_COOKIE = "timetable_auth";
