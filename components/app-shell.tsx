"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useData } from "./data-provider";
import { outstandingDebts } from "@/lib/billing";
import { currentMonth } from "@/lib/date";
import { StorageErrorBanner } from "./storage-error-banner";

/**
 * Application chrome.
 *
 * Desktop: a persistent left sidebar — this is a tool used repeatedly, so the
 * destinations stay visible rather than hiding behind a hamburger.
 * Mobile: a bottom tab bar, within thumb reach, with 44px+ targets.
 */

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Thời khoá biểu",
    shortLabel: "Lịch",
    icon: (
      <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
        <rect x="2.75" y="4.25" width="14.5" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.75 8.25h14.5M7 2.75v3M13 2.75v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/hoc-sinh",
    label: "Học sinh",
    shortLabel: "Học sinh",
    icon: (
      <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
        <circle cx="7.5" cy="6.75" r="2.9" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M2.25 16.5a5.25 5.25 0 0 1 10.5 0M13.5 4.4a2.9 2.9 0 0 1 0 4.7M15 11.8a5.25 5.25 0 0 1 2.75 4.7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/thu-hoc-phi",
    label: "Thu học phí",
    shortLabel: "Thu phí",
    icon: (
      <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
        <rect x="2.25" y="5" width="15.5" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.25 8.75h15.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="14.25" cy="12.75" r="1.1" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/no-hoc-phi",
    label: "Nợ học phí",
    shortLabel: "Nợ",
    icon: (
      <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 5.75v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="10" cy="13.6" r="0.95" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/cong-viec",
    label: "Việc cần làm",
    shortLabel: "Việc",
    icon: (
      <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
        <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="m6.5 10 2 2 4-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/cai-dat",
    label: "Cài đặt",
    shortLabel: "Cài đặt",
    icon: (
      <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.15 1.15M14.15 14.15l1.15 1.15M15.3 4.7l-1.15 1.15M5.85 14.15L4.7 15.3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data, isLoading } = useData();

  // Badge the debt tab so money owed is visible from anywhere in the app.
  const debtCount = isLoading
    ? 0
    : outstandingDebts(currentMonth(), data.students, data.sessions, data.bills).length;

  return (
    // Khoá shell đúng một khung nhìn: sidebar luôn cao hết màn hình, không
    // co lại theo nội dung từng trang. Phần cuộn nằm ở <main> bên dưới.
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      {/* Skip link — first stop for keyboard users. */}
      <a
        href="#main"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:left-3 focus:top-3 focus:z-[70]",
          "focus:rounded-md focus:bg-primary focus:px-3 focus:py-2",
          "focus:text-sm focus:font-medium focus:text-primary-fg",
        )}
      >
        Bỏ qua, tới nội dung chính
      </a>

      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-fg">
              Lịch dạy
            </p>
            <p className="truncate text-2xs text-fg-subtle">Quản lý &amp; học phí</p>
          </div>
        </div>

        <nav
          aria-label="Điều hướng chính"
          className="flex flex-1 flex-col gap-0.5 px-2 pb-3"
        >
          {NAV.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              badge={item.href === "/no-hoc-phi" ? debtCount : 0}
            />
          ))}
        </nav>
      </aside>

      {/* ---------------- Mobile header ---------------- */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-2.5 lg:hidden">
        <BrandMark />
        <span className="text-base font-semibold tracking-tight text-fg">Lịch dạy</span>
      </header>

      {/* ---------------- Main ---------------- */}
      {/* min-h-0 cho phép con cuộn được bên trong flex container cao cố định. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <StorageErrorBanner />
        <main
          id="main"
          // Vùng cuộn duy nhất của trang. Bottom padding chừa chỗ cho tab bar.
          className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pb-24 pt-4 sm:px-5 lg:px-7 lg:pb-8"
        >
          {children}
        </main>
      </div>

      {/* ---------------- Mobile tab bar ---------------- */}
      <nav
        aria-label="Điều hướng chính"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface lg:hidden",
          // Respect the iOS home-indicator inset.
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        {NAV.map((item) => (
          <TabLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            badge={item.href === "/no-hoc-phi" ? debtCount : 0}
          />
        ))}
      </nav>
    </div>
  );
}

/** "/" matches only itself; other routes also match their subpaths. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-base font-medium",
        "transition-colors duration-(--dur-fast)",
        active
          ? "bg-primary-bg text-primary"
          : "text-fg-muted hover:bg-surface-hover hover:text-fg",
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "text-fg-subtle")}>
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge > 0 && <CountBadge count={badge} />}
    </Link>
  );
}

function TabLink({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5",
        "text-2xs font-medium transition-colors duration-(--dur-fast)",
        active ? "text-primary" : "text-fg-subtle",
      )}
    >
      <span className="relative">
        {item.icon}
        {badge > 0 && (
          <span
            className="absolute -right-2 -top-1 flex min-w-4 items-center justify-center rounded-full bg-overdue px-1 text-[0.625rem] font-bold leading-4 text-white"
            aria-hidden="true"
          >
            {badge}
          </span>
        )}
      </span>
      <span className="truncate">{item.shortLabel}</span>
      {active && (
        <span
          className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="flex min-w-5 items-center justify-center rounded-full bg-overdue-bg px-1.5 py-0.5 text-2xs font-bold text-overdue-fg">
      {count}
      <span className="sr-only"> học sinh đang nợ</span>
    </span>
  );
}

function BrandMark() {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-fg"
      aria-hidden="true"
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="none">
        <rect x="3" y="4.5" width="14" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 8.5h14" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="m7.5 12.25 1.75 1.75 3.25-3.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
