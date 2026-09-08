/**
 * Nhận mật mã và cấp cookie phiên.
 *
 * Mật mã chỉ được so khớp ở đây, trên máy chủ — nó không bao giờ đi xuống
 * trình duyệt. Cookie trả về chứa chữ ký HMAC, không chứa mật mã.
 */

import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE,
  expectedToken,
  isAuthEnabled,
  isPasscodeCorrect,
} from "@/lib/auth";

/** Trả lời chậm một nhịp để việc dò mật mã bằng máy trở nên tốn kém. */
function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true });
  }

  let passcode = "";
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "passcode" in body) {
      const value = (body as { passcode: unknown }).passcode;
      if (typeof value === "string") passcode = value;
    }
  } catch {
    // Body hỏng thì coi như nhập sai — rơi xuống nhánh từ chối bên dưới.
  }

  if (!isPasscodeCorrect(passcode)) {
    await delay();
    return NextResponse.json(
      { ok: false, message: "Mật mã không đúng." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    // Chỉ bắt buộc HTTPS khi chạy production; localhost dùng http nên bật cờ
    // này lúc phát triển sẽ khiến trình duyệt bỏ qua cookie.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return response;
}
