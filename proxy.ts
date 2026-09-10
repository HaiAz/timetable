/**
 * Chốt chặn mật mã.
 *
 * Chạy trước khi bất kỳ trang nào được render: chưa xác thực thì chuyển hướng
 * sang /verify. Trong Next.js 16 tệp này tên là `proxy.ts` — `middleware.ts`
 * đã bị deprecated và đổi tên.
 *
 * Xem `lib/auth.ts` để biết giới hạn: cổng này chặn ở tầng Next.js, không chặn
 * truy cập thẳng vào Firestore.
 */

import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, VERIFY_PATH, isAuthEnabled, isTokenValid } from "@/lib/auth";

export function proxy(request: NextRequest) {
  // Không đặt APP_PASSCODE thì không khoá gì cả — tiện cho lúc phát triển.
  if (!isAuthEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const verified = isTokenValid(request.cookies.get(AUTH_COOKIE)?.value);

  if (pathname === VERIFY_PATH) {
    // Đã xác thực rồi mà còn vào /verify thì đưa thẳng về trang chủ, hoặc về
    // đúng trang họ định tới trước đó.
    if (verified) {
      const next = request.nextUrl.searchParams.get("next");
      return NextResponse.redirect(new URL(safeNext(next), request.url));
    }
    return NextResponse.next();
  }

  if (verified) return NextResponse.next();

  // Nhớ nơi người dùng định tới, để xác thực xong đưa họ về đúng chỗ.
  const target = new URL(VERIFY_PATH, request.url);
  const intended = `${pathname}${search}`;
  if (intended !== "/") target.searchParams.set("next", intended);

  return NextResponse.redirect(target);
}

/**
 * Chỉ chấp nhận đường dẫn nội bộ.
 *
 * Nếu tin thẳng tham số `next`, kẻ xấu có thể gửi link dạng
 * `/verify?next=https://trang-gia-mao` và biến trang xác thực thành bàn đạp
 * chuyển hướng người dùng ra ngoài (open redirect). Đường dẫn hợp lệ phải bắt
 * đầu bằng đúng một dấu `/`.
 */
function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const config = {
  /*
   * Bỏ qua tài nguyên tĩnh và route xác thực:
   *  - api/verify        chính là nơi nhận mật mã, khoá lại thì không vào được
   *  - _next/static,
   *    _next/image       tài nguyên build; chặn ở đây sẽ làm vỡ giao diện
   *  - favicon, ảnh…     tệp trong thư mục public
   *  - sw.js, manifest   trình duyệt tải hai tệp này *trước* khi người dùng
   *                      đăng nhập; redirect chúng sang /verify thì không cài
   *                      được app lên máy
   */
  matcher: [
    "/((?!api/verify|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
