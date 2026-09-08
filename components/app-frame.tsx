"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DataProvider } from "./data-provider";
import { AppShell } from "./app-shell";
import { VERIFY_PATH } from "@/lib/auth-shared";

/**
 * Chọn khung bao quanh nội dung theo từng trang.
 *
 * Trang nhập mật mã đứng ngoài ứng dụng: nó không có sidebar, và quan trọng
 * hơn là không được bọc trong `DataProvider` — nếu bọc, trình duyệt sẽ mở kết
 * nối Firestore ngay ở màn hình đăng nhập, trước cả khi người dùng được xác
 * thực. Vừa thừa, vừa sai về mặt thứ tự.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === VERIFY_PATH) return <>{children}</>;

  return (
    <DataProvider>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
