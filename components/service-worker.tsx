"use client";

import { useEffect } from "react";

/**
 * Đăng ký service worker — thứ trình duyệt bắt buộc phải có thì mới cho phép
 * cài app lên máy.
 *
 * Chỉ chạy ở production: `next dev` phục vụ file không hash, cache lại sẽ làm
 * hot reload hiện code cũ.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Cài app là tính năng cộng thêm; hỏng thì web vẫn chạy bình thường.
    });
  }, []);

  return null;
}
