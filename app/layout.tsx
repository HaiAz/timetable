import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/app-frame";
import { ServiceWorker } from "@/components/service-worker";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_SCRIPT } from "@/lib/themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lịch dạy — Quản lý lịch dạy & học phí",
  description:
    "Quản lý thời khoá biểu dạy kèm 1-1 và tính học phí. Dữ liệu đồng bộ qua Firebase.",
  // iOS bỏ qua manifest khi thêm vào màn hình chính, phải khai báo riêng.
  appleWebApp: {
    capable: true,
    title: "Lịch dạy",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom must stay available for accessibility.
  maximumScale: 5,
  themeColor: "#0068E8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The inline script below sets the theme class before paint; the server
      // markup deliberately has no class, so silence the attribute warning.
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint — no flash, no mismatch. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ServiceWorker />
        <ToastProvider>
          <AppFrame>{children}</AppFrame>
        </ToastProvider>
      </body>
    </html>
  );
}
